import type { LLMProvider, Model, Message, ToolDef, StreamChunk, ChatOptions } from '../provider';
import { parseSSE } from './openai';

export class OpenRouterProvider implements LLMProvider {
  id = 'openrouter';
  name = 'OpenRouter';

  private apiKey = '';
  private model = 'openai/gpt-4o';
  private baseUrl = 'https://openrouter.ai/api/v1';

  configSchema: LLMProvider['configSchema'] = {
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
        placeholder: 'sk-or-...',
        helpText: 'Your OpenRouter API key from openrouter.ai/keys',
      },
      {
        key: 'model',
        label: 'Model',
        type: 'select',
        required: true,
        default: 'openai/gpt-4o',
        options: [
          { label: 'GPT-4o (OpenAI)', value: 'openai/gpt-4o' },
          { label: 'GPT-4o Mini (OpenAI)', value: 'openai/gpt-4o-mini' },
          { label: 'Claude 3.5 Sonnet (Anthropic)', value: 'anthropic/claude-3.5-sonnet' },
          { label: 'Claude 3 Haiku (Anthropic)', value: 'anthropic/claude-3-haiku' },
          { label: 'Gemini Pro 1.5 (Google)', value: 'google/gemini-pro-1.5' },
          { label: 'Llama 3.1 70B (Meta)', value: 'meta-llama/llama-3.1-70b-instruct' },
          { label: 'Mixtral 8x7B (Mistral)', value: 'mistralai/mixtral-8x7b-instruct' },
          { label: 'DeepSeek V3 (DeepSeek)', value: 'deepseek/deepseek-chat' },
        ],
      },
    ],
    testPrompt: 'Say "hello" in one word.',
  };

  configure(config: Record<string, string>): void {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'openai/gpt-4o';
  }

  async *chat(messages: Message[], tools?: ToolDef[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    if (!this.apiKey) {
      yield { type: 'error', error: 'OpenRouter API key is not configured' };
      return;
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://commandarr.app',
          'X-Title': 'Commandarr',
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      yield { type: 'error', error: `OpenRouter request failed: ${err.message}` };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      yield { type: 'error', error: `OpenRouter API error ${response.status}: ${errorText}` };
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
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!response.ok) return [];

      const data = await response.json() as {
        data?: {
          id: string;
          name: string;
          context_length?: number;
          description?: string;
        }[];
      };

      return (data.data || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length,
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
