import type { LLMProvider, Model, Message, ToolDef, StreamChunk, ChatOptions } from '../provider';
import { parseSSE } from './openai';

export class LMStudioProvider implements LLMProvider {
  id = 'lmstudio';
  name = 'LM Studio';

  private baseUrl = 'http://localhost:1234';
  private model = '';

  configSchema: LLMProvider['configSchema'] = {
    fields: [
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'url',
        required: false,
        default: 'http://localhost:1234',
        placeholder: 'http://localhost:1234',
        helpText: 'LM Studio server address',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'text',
        required: true,
        placeholder: 'loaded model name',
        helpText: 'Model identifier loaded in LM Studio. Leave empty to use the currently loaded model.',
      },
    ],
    testPrompt: 'Say "hello" in one word.',
  };

  configure(config: Record<string, string>): void {
    this.baseUrl = (config.baseUrl || 'http://localhost:1234').replace(/\/+$/, '');
    this.model = config.model || '';
  }

  async *chat(messages: Message[], tools?: ToolDef[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: this.model || 'default',
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
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      yield {
        type: 'error',
        error: `LM Studio connection failed: ${err.message}. Is LM Studio running at ${this.baseUrl}?`,
      };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `LM Studio API error ${response.status}: ${errorText}` };
      return;
    }

    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const chunk of parseSSE(response)) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

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
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`);
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
    // LM Studio tool support depends on the loaded model
    return true;
  }

  supportsStreaming(): boolean {
    return true;
  }
}
