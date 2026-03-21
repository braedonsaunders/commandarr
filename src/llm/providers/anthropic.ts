import type { LLMProvider, Model, Message, ToolDef, StreamChunk, ToolCall } from '../provider';

interface AnthropicContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class AnthropicProvider implements LLMProvider {
  id = 'anthropic';
  name = 'Anthropic';

  private apiKey = '';
  private model = 'claude-sonnet-4-20250514';
  private baseUrl = 'https://api.anthropic.com';

  configSchema: LLMProvider['configSchema'] = {
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-ant-...',
        helpText: 'Your Anthropic API key from console.anthropic.com',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        default: 'claude-sonnet-4-20250514',
        options: [
          { label: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
          { label: 'Claude Sonnet 4', value: 'claude-sonnet-4-20250514' },
          { label: 'Claude 3.5 Haiku', value: 'claude-3-5-haiku-20241022' },
          { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
          { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
        ],
      },
    ],
    testPrompt: 'Say "hello" in one word.',
  };

  configure(config: Record<string, string>): void {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  /**
   * Convert OpenAI-style messages to Anthropic format.
   * Anthropic requires a separate system parameter and specific content block formatting.
   */
  private convertMessages(messages: Message[]): {
    system: string | undefined;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string | Array<Record<string, unknown>>;
    }>;
  } {
    let system: string | undefined;
    const converted: Array<{
      role: 'user' | 'assistant';
      content: string | Array<Record<string, unknown>>;
    }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = (system ? system + '\n' : '') + msg.content;
        continue;
      }

      if (msg.role === 'tool') {
        // Tool results in Anthropic are sent as user messages with tool_result content blocks
        converted.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id,
              content: msg.content,
            },
          ],
        });
        continue;
      }

      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls
        const content: Array<Record<string, unknown>> = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments);
          } catch {
            // keep empty object
          }
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input,
          });
        }
        converted.push({ role: 'assistant', content });
        continue;
      }

      const role = msg.role === 'user' ? 'user' : 'assistant';

      // Anthropic doesn't allow consecutive messages with the same role.
      // Merge if needed.
      const last = converted[converted.length - 1];
      if (last && last.role === role && typeof last.content === 'string' && typeof msg.content === 'string') {
        last.content += '\n' + msg.content;
      } else {
        converted.push({ role, content: msg.content });
      }
    }

    // Anthropic requires messages to start with a user message
    if (converted.length > 0 && converted[0].role !== 'user') {
      converted.unshift({ role: 'user', content: 'Hello.' });
    }

    return { system, messages: converted };
  }

  private convertTools(tools: ToolDef[]): AnthropicTool[] {
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  async *chat(messages: Message[], tools?: ToolDef[]): AsyncGenerator<StreamChunk> {
    if (!this.apiKey) {
      yield { type: 'error', error: 'Anthropic API key is not configured' };
      return;
    }

    const { system, messages: anthropicMessages } = this.convertMessages(messages);

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 8192,
      messages: anthropicMessages,
      stream: true,
    };
    if (system) body.system = system;
    if (tools && tools.length > 0) body.tools = this.convertTools(tools);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      yield { type: 'error', error: `Anthropic request failed: ${err.message}` };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `Anthropic API error ${response.status}: ${errorText}` };
      return;
    }

    // Parse Anthropic SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentToolId = '';
    let currentToolName = '';
    let currentToolArgs = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed.startsWith('event: ')) {
            // We'll handle events by the data that follows
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            let parsed: any;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }

            switch (parsed.type) {
              case 'message_start':
                if (parsed.message?.usage) {
                  promptTokens = parsed.message.usage.input_tokens || 0;
                }
                break;

              case 'content_block_start':
                if (parsed.content_block?.type === 'tool_use') {
                  currentToolId = parsed.content_block.id || '';
                  currentToolName = parsed.content_block.name || '';
                  currentToolArgs = '';
                }
                break;

              case 'content_block_delta':
                if (parsed.delta?.type === 'text_delta') {
                  yield { type: 'text', text: parsed.delta.text };
                } else if (parsed.delta?.type === 'input_json_delta') {
                  currentToolArgs += parsed.delta.partial_json || '';
                }
                break;

              case 'content_block_stop':
                if (currentToolId) {
                  yield {
                    type: 'tool_call',
                    toolCall: {
                      id: currentToolId,
                      type: 'function',
                      function: {
                        name: currentToolName,
                        arguments: currentToolArgs,
                      },
                    },
                  };
                  currentToolId = '';
                  currentToolName = '';
                  currentToolArgs = '';
                }
                break;

              case 'message_delta':
                if (parsed.usage) {
                  completionTokens = parsed.usage.output_tokens || 0;
                }
                break;

              case 'message_stop':
                yield {
                  type: 'done',
                  usage: { promptTokens, completionTokens },
                };
                break;

              case 'error':
                yield {
                  type: 'error',
                  error: parsed.error?.message || 'Unknown Anthropic stream error',
                };
                break;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // If we never got a message_stop event, still emit done
    yield { type: 'done', usage: { promptTokens, completionTokens } };
  }

  async listModels(): Promise<Model[]> {
    // Anthropic doesn't have a public models listing endpoint, return known models
    return [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextLength: 200000, supportsTools: true },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextLength: 200000, supportsTools: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextLength: 200000, supportsTools: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', contextLength: 200000, supportsTools: true },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', contextLength: 200000, supportsTools: true },
    ];
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return true;
  }
}
