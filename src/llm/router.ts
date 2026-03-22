import { eq, desc, asc } from 'drizzle-orm';
import { getDb } from '../db/index';
import { llmProviders } from '../db/schema';
import { decrypt } from '../utils/crypto';
import type { LLMProvider, Message, ToolDef, StreamChunk, ChatOptions } from './provider';
import { OpenAIProvider } from './providers/openai';
import { OpenRouterProvider } from './providers/openrouter';
import { AnthropicProvider } from './providers/anthropic';
import { GoogleProvider } from './providers/google';
import { LMStudioProvider } from './providers/lmstudio';
import { OllamaProvider } from './providers/ollama';
import { CustomProvider } from './providers/custom';

/**
 * Registry of all available provider constructors.
 */
const providerFactories: Record<string, () => LLMProvider> = {
  openai: () => new OpenAIProvider(),
  openrouter: () => new OpenRouterProvider(),
  anthropic: () => new AnthropicProvider(),
  google: () => new GoogleProvider(),
  lmstudio: () => new LMStudioProvider(),
  ollama: () => new OllamaProvider(),
  custom: () => new CustomProvider(),
};

interface ConfiguredProvider {
  provider: LLMProvider;
  priority: number;
  enabled: boolean;
  dbId: string;
}

let configuredProviders: ConfiguredProvider[] = [];

/**
 * Load provider configurations from the database and instantiate providers.
 */
export async function initProviders(): Promise<void> {
  const db = await getDb();
  const rows = await db.select().from(llmProviders).orderBy(asc(llmProviders.priority));

  configuredProviders = [];

  for (const row of rows) {
    const factory = providerFactories[row.providerId];
    if (!factory) {
      console.warn(`[LLM Router] Unknown provider type: ${row.providerId}`);
      continue;
    }

    const provider = factory();

    // Decrypt and parse stored config
    let config: Record<string, string> = {};
    if (row.config) {
      try {
        const decrypted = decrypt(row.config);
        config = JSON.parse(decrypted);
      } catch {
        console.warn(`[LLM Router] Invalid config for provider ${row.id}`);
        continue;
      }
    }

    // The model field in the DB can override the config model
    if (row.model) {
      config.model = row.model;
    }

    provider.configure(config);

    configuredProviders.push({
      provider,
      priority: row.priority ?? 0,
      enabled: row.enabled !== false,
      dbId: row.id,
    });
  }

  // Sort by priority ascending (lower number = higher priority)
  configuredProviders.sort((a, b) => a.priority - b.priority);

  console.log(
    `[LLM Router] Loaded ${configuredProviders.length} providers: ${configuredProviders.map((p) => `${p.provider.name} (priority ${p.priority}, ${p.enabled ? 'enabled' : 'disabled'})`).join(', ')}`
  );
}

/**
 * Get the highest priority enabled provider.
 */
export function getActiveProvider(): LLMProvider | null {
  const active = configuredProviders.find((p) => p.enabled);
  return active?.provider ?? null;
}

/**
 * Get a specific provider by its database ID.
 */
export function getProvider(id: string): LLMProvider | null {
  const found = configuredProviders.find((p) => p.dbId === id);
  return found?.provider ?? null;
}

/**
 * Get a provider by its provider type ID (e.g., 'openai', 'anthropic').
 */
export function getProviderByType(providerId: string): LLMProvider | null {
  const found = configuredProviders.find((p) => p.provider.id === providerId && p.enabled);
  return found?.provider ?? null;
}

/**
 * List all configured provider instances (both enabled and disabled).
 */
export function listProviders(): Array<{
  dbId: string;
  provider: LLMProvider;
  priority: number;
  enabled: boolean;
}> {
  return configuredProviders.map((p) => ({
    dbId: p.dbId,
    provider: p.provider,
    priority: p.priority,
    enabled: p.enabled,
  }));
}

/**
 * List all available provider types (for configuration UI).
 */
export function listAvailableProviderTypes(): Array<{
  id: string;
  name: string;
  configSchema: LLMProvider['configSchema'];
}> {
  return Object.entries(providerFactories).map(([id, factory]) => {
    const instance = factory();
    return {
      id,
      name: instance.name,
      configSchema: instance.configSchema,
    };
  });
}

/**
 * Chat with automatic fallback through the provider chain.
 * Tries each enabled provider in priority order; on failure, falls through to the next.
 */
export async function* chatWithFallback(
  messages: Message[],
  tools?: ToolDef[],
  options?: ChatOptions
): AsyncGenerator<StreamChunk> {
  const enabledProviders = configuredProviders.filter((p) => p.enabled);

  if (enabledProviders.length === 0) {
    yield {
      type: 'error',
      error: 'No LLM providers are configured. Please add a provider in Settings.',
    };
    return;
  }

  for (let i = 0; i < enabledProviders.length; i++) {
    const { provider } = enabledProviders[i];
    const isLast = i === enabledProviders.length - 1;

    try {
      let hadError = false;
      const chunks: StreamChunk[] = [];

      for await (const chunk of provider.chat(messages, tools, options)) {
        if (chunk.type === 'error') {
          console.warn(
            `[LLM Router] Provider ${provider.name} error: ${chunk.error}${isLast ? '' : ', trying next provider'}`
          );
          hadError = true;
          break;
        }
        chunks.push(chunk);
      }

      if (!hadError) {
        // Re-yield all accumulated chunks for the successful provider
        for (const chunk of chunks) {
          yield chunk;
        }
        return;
      }

      // If this was the last provider and it failed, yield the error
      if (isLast) {
        yield {
          type: 'error',
          error: `All ${enabledProviders.length} LLM providers failed. Last provider: ${provider.name}`,
        };
        return;
      }
    } catch (err: any) {
      console.error(`[LLM Router] Provider ${provider.name} threw: ${err.message}`);
      if (isLast) {
        yield {
          type: 'error',
          error: `All ${enabledProviders.length} LLM providers failed. Last error: ${err.message}`,
        };
        return;
      }
    }
  }
}

/**
 * Convenience: collect full text response from chatWithFallback.
 */
export async function chatWithFallbackSync(
  messages: Message[],
  tools?: ToolDef[],
  options?: ChatOptions
): Promise<{ text: string; toolCalls: StreamChunk['toolCall'][]; error?: string }> {
  let text = '';
  const toolCalls: StreamChunk['toolCall'][] = [];
  let error: string | undefined;

  for await (const chunk of chatWithFallback(messages, tools, options)) {
    switch (chunk.type) {
      case 'text':
        text += chunk.text || '';
        break;
      case 'tool_call':
        toolCalls.push(chunk.toolCall);
        break;
      case 'error':
        error = chunk.error;
        break;
    }
  }

  return { text, toolCalls, error };
}
