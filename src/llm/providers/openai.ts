import type { LLMProvider, ConfigField, Model, Message, ToolDef, StreamChunk, ToolCall, ChatOptions } from '../provider';

/**
 * Parse an SSE stream from an OpenAI-compatible API response.
 * Yields parsed JSON objects for each `data:` line (except `[DONE]`).
 */
async function* parseSSE(response: Response): AsyncGenerator<any> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

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
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          try {
            yield JSON.parse(data);
          } catch {
            // skip unparseable lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class OpenAIProvider implements LLMProvider {
  id = 'openai';
  name = 'OpenAI';

  private apiKey = '';
  private model = 'gpt-4o';
  private orgId = '';
  private baseUrl = 'https://api.openai.com/v1';

  configSchema: LLMProvider['configSchema'] = {
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-...',
        helpText: 'Your OpenAI API key from platform.openai.com',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        default: 'gpt-4o',
        options: [
          { label: 'GPT-4o', value: 'gpt-4o' },
          { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
          { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
          { label: 'GPT-4', value: 'gpt-4' },
          { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
          { label: 'o1', value: 'o1' },
          { label: 'o1 Mini', value: 'o1-mini' },
          { label: 'o3 Mini', value: 'o3-mini' },
        ],
      },
      {
        key: 'orgId',
        label: 'Organization ID',
        type: 'text',
        required: false,
        placeholder: 'org-...',
        helpText: 'Optional OpenAI organization ID',
      },
    ],
    testPrompt: 'Say "hello" in one word.',
  };

  configure(config: Record<string, string>): void {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o';
    this.orgId = config.orgId || '';
    if (config.baseUrl) this.baseUrl = config.baseUrl;
  }

  async *chat(messages: Message[], tools?: ToolDef[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    if (!this.apiKey) {
      yield { type: 'error', error: 'OpenAI API key is not configured' };
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.orgId) headers['OpenAI-Organization'] = this.orgId;

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = { role: m.role, content: m.content };
        if (m.name) msg.name = m.name;
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        return msg;
      }),
      stream: true,
    };
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (tools && tools.length > 0) body.tools = tools;

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      yield { type: 'error', error: `OpenAI request failed: ${err.message}` };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `OpenAI API error ${response.status}: ${errorText}` };
      return;
    }

    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of parseSSE(response)) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) {
        // Check for usage in the final chunk
        if (chunk.usage) {
          yield {
            type: 'done',
            usage: {
              promptTokens: chunk.usage.prompt_tokens || 0,
              completionTokens: chunk.usage.completion_tokens || 0,
            },
          };
        }
        continue;
      }

      // Text content
      if (delta.content) {
        yield { type: 'text', text: delta.content };
      }

      // Tool calls (streamed incrementally)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (tc.id) {
            pendingToolCalls.set(idx, {
              id: tc.id,
              name: tc.function?.name || '',
              arguments: tc.function?.arguments || '',
            });
          } else {
            const existing = pendingToolCalls.get(idx);
            if (existing) {
              if (tc.function?.name) existing.name += tc.function.name;
              if (tc.function?.arguments) existing.arguments += tc.function.arguments;
            }
          }
        }
      }

      // Check if this choice is finished
      const finishReason = chunk.choices?.[0]?.finish_reason;
      if (finishReason === 'tool_calls' || finishReason === 'stop') {
        // Emit completed tool calls
        for (const [, tc] of pendingToolCalls) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            },
          };
        }
        pendingToolCalls.clear();
      }
    }

    yield { type: 'done' };
  }

  async listModels(): Promise<Model[]> {
    if (!this.apiKey) return [];

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.orgId) headers['OpenAI-Organization'] = this.orgId;

    try {
      const response = await fetch(`${this.baseUrl}/models`, { headers });
      if (!response.ok) return [];

      const data = await response.json() as { data?: { id: string; owned_by?: string }[] };
      return (data.data || [])
        .filter((m) => m.id.startsWith('gpt-') || m.id.startsWith('o1') || m.id.startsWith('o3'))
        .map((m) => ({
          id: m.id,
          name: m.id,
          supportsTools: !m.id.includes('instruct'),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch {
      return [];
    }
  }

  supportsToolUse(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return true;
  }
}

export { parseSSE };
