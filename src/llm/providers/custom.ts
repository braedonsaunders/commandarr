import type { LLMProvider, Model, Message, ToolDef, StreamChunk, ChatOptions } from '../provider';
import { parseSSE } from './openai';

export class CustomProvider implements LLMProvider {
  id = 'custom';
  name = 'Custom (OpenAI-compatible)';

  private baseUrl = '';
  private apiKey = '';
  private model = '';

  configSchema: LLMProvider['configSchema'] = {
    fields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'url',
        required: true,
        placeholder: 'https://your-api.example.com/v1',
        helpText: 'Base URL of your OpenAI-compatible API (include /v1 if needed)',
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: false,
        placeholder: 'sk-...',
        helpText: 'API key for authentication (leave blank if not required)',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        required: true,
        placeholder: 'model-name',
        helpText: 'Model identifier to use',
      },
    ],
    testPrompt: 'Say "hello" in one word.',
  };

  configure(config: Record<string, string>): void {
    this.baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
  }

  async *chat(messages: Message[], tools?: ToolDef[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    if (!this.baseUrl) {
      yield { type: 'error', error: 'Custom provider base URL is not configured' };
      return;
    }
    if (!this.model) {
      yield { type: 'error', error: 'Custom provider model is not configured' };
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

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
      yield { type: 'error', error: `Custom provider request failed: ${err.message}` };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `Custom provider API error ${response.status}: ${errorText}` };
      return;
    }

    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of parseSSE(response)) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) {
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

      if (delta.content) {
        yield { type: 'text', text: delta.content };
      }

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

      const finishReason = chunk.choices?.[0]?.finish_reason;
      if (finishReason === 'tool_calls' || finishReason === 'stop') {
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
    if (!this.baseUrl) return [];

    const headers: Record<string, string> = {};
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, { headers });
      if (!response.ok) return [];

      const data = await response.json() as { data?: { id: string }[] };
      return (data.data || []).map((m) => ({
        id: m.id,
        name: m.id,
        supportsTools: true,
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
