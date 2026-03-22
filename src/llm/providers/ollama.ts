import type { LLMProvider, Model, Message, ToolDef, StreamChunk, ChatOptions } from '../provider';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: { name: string; arguments: Record<string, unknown> };
  }>;
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class OllamaProvider implements LLMProvider {
  id = 'ollama';
  name = 'Ollama';

  private baseUrl = 'http://localhost:11434';
  private model = 'llama3.1';

  configSchema: LLMProvider['configSchema'] = {
    fields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'url',
        required: false,
        default: 'http://localhost:11434',
        placeholder: 'http://localhost:11434',
        helpText: 'Ollama server address',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        required: true,
        default: 'llama3.1',
        placeholder: 'llama3.1',
        helpText: 'Ollama model name (run "ollama list" to see available models)',
      },
    ],
    testPrompt: 'Say "hello" in one word.',
  };

  configure(config: Record<string, string>): void {
    this.baseUrl = (config.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    this.model = config.model || 'llama3.1';
  }

  async *chat(messages: Message[], tools?: ToolDef[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const ollamaMessages: OllamaMessage[] = messages.map((m) => {
      const msg: OllamaMessage = { role: m.role, content: m.content };
      if (m.tool_calls) {
        msg.tool_calls = m.tool_calls.map((tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            // keep empty
          }
          return {
            function: { name: tc.function.name, arguments: args },
          };
        });
      }
      return msg;
    });

    const ollamaOptions: Record<string, unknown> = {};
    if (options?.maxTokens !== undefined) ollamaOptions.num_predict = options.maxTokens;
    if (options?.temperature !== undefined) ollamaOptions.temperature = options.temperature;

    const body: Record<string, unknown> = {
      model: this.model,
      messages: ollamaMessages,
      stream: true,
    };
    if (Object.keys(ollamaOptions).length > 0) body.options = ollamaOptions;
    if (tools && tools.length > 0) {
      body.tools = tools as OllamaTool[];
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      yield {
        type: 'error',
        error: `Ollama connection failed: ${err.message}. Is Ollama running at ${this.baseUrl}?`,
      };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `Ollama API error ${response.status}: ${errorText}` };
      return;
    }

    // Ollama streams newline-delimited JSON (not SSE)
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let toolCallCounter = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            continue;
          }

          // Ollama streams message content in message.content
          if (parsed.message) {
            if (parsed.message.content) {
              yield { type: 'text', text: parsed.message.content };
            }

            // Tool calls from Ollama
            if (parsed.message.tool_calls) {
              for (const tc of parsed.message.tool_calls) {
                toolCallCounter++;
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: `call_ollama_${toolCallCounter}`,
                    type: 'function',
                    function: {
                      name: tc.function.name,
                      arguments: JSON.stringify(tc.function.arguments || {}),
                    },
                  },
                };
              }
            }
          }

          // When done is true, collect usage stats
          if (parsed.done) {
            promptTokens = parsed.prompt_eval_count || 0;
            completionTokens = parsed.eval_count || 0;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done', usage: { promptTokens, completionTokens } };
  }

  async listModels(): Promise<Model[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json() as {
        models?: Array<{
          name: string;
          details?: {
            parameter_size?: string;
            family?: string;
          };
        }>;
      };

      return (data.models || []).map((m) => ({
        id: m.name,
        name: m.name,
        supportsTools: true, // Newer Ollama versions support tools for many models
      }));
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
