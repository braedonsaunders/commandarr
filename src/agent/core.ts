import type { StreamChunk, Message, ToolCall } from '../llm/provider';
import type { ToolDefinition } from '../integrations/_base';
import { buildSystemPrompt } from './system-prompt';
import { executeTool, toolsToLLMFormat } from './tool-executor';
import { getDb } from '../db/index';
import { conversations, auditLog } from '../db/schema';
import { logger } from '../utils/logger';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

/** Maximum number of tool-call round-trips before forcing a text response. */
const MAX_TOOL_ROUNDS = 10;

/** Re-export StreamChunk so consumers can reference it from a single location. */
export type { StreamChunk };

/**
 * Dynamically import the registry and router to avoid circular deps
 * and allow these modules to be loaded lazily.
 */
async function getRegistry() {
  return await import('../integrations/registry');
}

async function getRouter() {
  return await import('../llm/router');
}

/**
 * Gather current integration statuses and the full set of available tools.
 */
async function gatherIntegrationContext() {
  const registry = await getRegistry();
  const loaded = registry.getIntegrations();

  const integrationStatuses = loaded.map((int) => ({
    manifest: int.manifest,
    healthy: int.status === 'healthy',
    configured: int.status !== 'unconfigured',
  }));

  const tools: ToolDefinition[] = [];
  for (const int of loaded) {
    if (int.status === 'healthy') {
      tools.push(...int.tools);
    }
  }

  return { integrationStatuses, tools };
}

// ---------------------------------------------------------------------------
// Conversation persistence
// ---------------------------------------------------------------------------

interface StoredConversation {
  id: string;
  platform: 'web' | 'telegram' | 'discord';
  messages: Message[];
}

async function loadConversation(
  conversationId: string,
  platform: 'web' | 'telegram' | 'discord',
): Promise<StoredConversation> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (rows.length > 0 && rows[0].messages) {
    try {
      const messages = JSON.parse(rows[0].messages) as Message[];
      return { id: conversationId, platform, messages };
    } catch {
      // Corrupted JSON - start fresh
    }
  }

  return { id: conversationId, platform, messages: [] };
}

async function saveConversation(conv: StoredConversation): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const serialized = JSON.stringify(conv.messages);

  const existing = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conv.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(conversations)
      .set({ messages: serialized, updatedAt: now })
      .where(eq(conversations.id, conv.id));
  } else {
    await db.insert(conversations).values({
      id: conv.id,
      platform: conv.platform,
      platformChatId: conv.id,
      messages: serialized,
      createdAt: now,
      updatedAt: now,
    });
  }
}

// ---------------------------------------------------------------------------
// Core agent loop
// ---------------------------------------------------------------------------

/**
 * Process an incoming user message through the agent.
 * Returns an AsyncGenerator that yields StreamChunks (text, tool_call, done, error).
 *
 * The generator handles the full agent loop:
 *  1. Load conversation history
 *  2. Build system prompt with current integration state
 *  3. Send to LLM (with streaming)
 *  4. If the LLM requests tool calls, execute them and loop back
 *  5. Save conversation and emit done
 */
export async function* processMessage(
  message: string,
  conversationId: string,
  platform: 'web' | 'telegram' | 'discord',
): AsyncGenerator<StreamChunk> {
  const router = await getRouter();
  const { integrationStatuses, tools } = await gatherIntegrationContext();

  // Build system prompt
  const systemPrompt = buildSystemPrompt(integrationStatuses, tools);
  const llmTools = toolsToLLMFormat(tools);

  // Load or create conversation
  const conv = await loadConversation(conversationId, platform);

  // Add user message and persist immediately so it survives conversation switches
  conv.messages.push({ role: 'user', content: message });
  await saveConversation(conv);

  // Log the incoming message
  await logChat(conversationId, platform, 'user', message);

  // Ensure conversation starts with the system prompt.
  // We always put a fresh system message at index 0 so the LLM sees the latest
  // integration state / tool list.
  const messagesForLLM = buildLLMMessages(systemPrompt, conv.messages);

  let toolRounds = 0;
  let currentMessages = messagesForLLM;

  while (toolRounds < MAX_TOOL_ROUNDS) {
    // Accumulate the full assistant response across the stream
    let assistantText = '';
    const toolCalls: ToolCall[] = [];
    let lastUsage: StreamChunk['usage'] | undefined;

    try {
      const stream = router.chatWithFallback(currentMessages, llmTools.length > 0 ? llmTools : undefined);

      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          assistantText += chunk.text;
          yield chunk;
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          toolCalls.push(chunk.toolCall);
          yield chunk;
        } else if (chunk.type === 'error') {
          logger.error('agent', 'LLM error', chunk.error);
          yield chunk;
          // Save what we have and bail out
          if (assistantText) {
            conv.messages.push({ role: 'assistant', content: assistantText });
          }
          await saveConversation(conv);
          return;
        } else if (chunk.type === 'done') {
          lastUsage = chunk.usage;
        }
      }
    } catch (err: any) {
      logger.error('agent', 'LLM stream error', err);
      yield { type: 'error', error: `LLM error: ${err.message}` };
      await saveConversation(conv);
      return;
    }

    // If no tool calls were made, we're done
    if (toolCalls.length === 0) {
      conv.messages.push({ role: 'assistant', content: assistantText });
      await saveConversation(conv);
      await logChat(conversationId, platform, 'assistant', assistantText);
      yield { type: 'done', usage: lastUsage };
      return;
    }

    // --- Tool call round ---
    toolRounds++;

    // Add the assistant message with tool calls to history
    const assistantMsg: Message = {
      role: 'assistant',
      content: assistantText || '',
      tool_calls: toolCalls,
    };
    conv.messages.push(assistantMsg);
    currentMessages.push(assistantMsg);

    // Execute each tool call and add results
    for (const tc of toolCalls) {
      let params: Record<string, any>;
      try {
        params = JSON.parse(tc.function.arguments);
      } catch {
        params = {};
      }

      logger.info('agent', `Calling tool: ${tc.function.name}`, params);

      const result = await executeTool(tc.function.name, params);

      const toolResultMsg: Message = {
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: tc.id,
        name: tc.function.name,
      };
      conv.messages.push(toolResultMsg);
      currentMessages.push(toolResultMsg);

      // Yield tool result so the consumer knows what happened
      yield {
        type: 'tool_call',
        toolCall: tc,
        text: JSON.stringify(result),
      };
    }

    // Loop back to call the LLM again with tool results
  }

  // If we exhaust tool rounds, force a final response
  logger.warn('agent', `Conversation ${conversationId} hit max tool rounds (${MAX_TOOL_ROUNDS})`);
  conv.messages.push({
    role: 'assistant',
    content: 'I have reached the maximum number of tool calls for this turn. Please let me know if you need anything else.',
  });
  await saveConversation(conv);
  yield {
    type: 'text',
    text: 'I have reached the maximum number of tool calls for this turn. Please let me know if you need anything else.',
  };
  yield { type: 'done' };
}

/**
 * Retrieve conversation history for a given conversation ID.
 */
export async function getConversationHistory(conversationId: string): Promise<Message[]> {
  const conv = await loadConversation(conversationId, 'web');
  return conv.messages;
}

/**
 * Clear all messages for a given conversation.
 */
export async function clearConversation(conversationId: string): Promise<void> {
  const db = await getDb();
  await db.delete(conversations).where(eq(conversations.id, conversationId));
  logger.info('agent', `Cleared conversation: ${conversationId}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the messages array for the LLM. Ensures a system message is at index 0
 * and trims history if it gets too long (keep last N messages to avoid token overflow).
 */
function buildLLMMessages(systemPrompt: string, conversationMessages: Message[]): Message[] {
  const systemMsg: Message = { role: 'system', content: systemPrompt };

  // Filter out any previous system messages from stored history
  const history = conversationMessages.filter((m) => m.role !== 'system');

  // Keep a reasonable window of history (last 50 messages)
  const maxHistory = 50;
  const trimmed = history.length > maxHistory ? history.slice(-maxHistory) : history;

  return [systemMsg, ...trimmed];
}

/**
 * Write a chat message to the audit log.
 */
async function logChat(
  conversationId: string,
  platform: string,
  role: string,
  content: string,
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLog).values({
      id: nanoid(),
      timestamp: new Date(),
      source: 'agent',
      action: `chat:${role}`,
      integration: null,
      input: JSON.stringify({ conversationId, platform }),
      output: content.slice(0, 2000), // Truncate large messages for audit
      level: 'info',
    });
  } catch (err) {
    logger.error('agent', 'Failed to write chat audit log', err);
  }
}
