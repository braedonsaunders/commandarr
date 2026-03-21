import { processMessage, clearConversation, getConversationHistory } from '../agent/core';
import type { StreamChunk } from '../llm/provider';
import { logger } from '../utils/logger';
import { nanoid } from 'nanoid';

/**
 * Message types sent over the WebSocket.
 */
interface WSIncoming {
  type: 'message' | 'clear' | 'history';
  conversationId?: string;
  content?: string;
}

interface WSOutgoing {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'history' | 'cleared';
  text?: string;
  toolCall?: StreamChunk['toolCall'];
  messages?: unknown[];
  error?: string;
  usage?: StreamChunk['usage'];
  conversationId?: string;
}

/**
 * Handle a WebSocket connection for web-based chat.
 * The caller (Hono route) upgrades the connection and passes the WebSocket here.
 *
 * Protocol:
 *   Client sends JSON { type: "message", conversationId: "...", content: "..." }
 *   Server streams JSON chunks: { type: "text"|"tool_call"|"done"|"error", ... }
 *
 *   Client sends { type: "clear", conversationId: "..." } to reset history.
 *   Client sends { type: "history", conversationId: "..." } to retrieve history.
 */
export function handleWebChat(ws: WebSocket, conversationId?: string): void {
  const defaultConvId = conversationId || `web_${nanoid(12)}`;

  // Send the assigned conversation ID to the client immediately
  sendJSON(ws, { type: 'text', conversationId: defaultConvId });

  ws.addEventListener('message', async (event) => {
    let incoming: WSIncoming;

    try {
      const raw = typeof event.data === 'string' ? event.data : event.data.toString();
      incoming = JSON.parse(raw);
    } catch {
      sendJSON(ws, { type: 'error', error: 'Invalid JSON message' });
      return;
    }

    const convId = incoming.conversationId || defaultConvId;

    try {
      switch (incoming.type) {
        case 'message':
          await handleUserMessage(ws, convId, incoming.content || '');
          break;

        case 'clear':
          await clearConversation(convId);
          sendJSON(ws, { type: 'cleared', conversationId: convId });
          break;

        case 'history':
          const messages = await getConversationHistory(convId);
          sendJSON(ws, { type: 'history', conversationId: convId, messages });
          break;

        default:
          sendJSON(ws, { type: 'error', error: `Unknown message type: ${(incoming as any).type}` });
      }
    } catch (err: any) {
      logger.error('chat', `Web chat error: ${err.message}`, err);
      sendJSON(ws, { type: 'error', error: err.message });
    }
  });

  ws.addEventListener('close', () => {
    logger.debug('chat', `WebSocket closed for conversation ${defaultConvId}`);
  });

  ws.addEventListener('error', (event) => {
    logger.error('chat', `WebSocket error for conversation ${defaultConvId}`, event);
  });
}

/**
 * Process a user message and stream results back over the WebSocket.
 */
async function handleUserMessage(
  ws: WebSocket,
  conversationId: string,
  content: string,
): Promise<void> {
  if (!content.trim()) {
    sendJSON(ws, { type: 'error', error: 'Empty message' });
    return;
  }

  logger.info('chat', `Web message [${conversationId}]: ${content.slice(0, 100)}`);

  const stream = processMessage(content, conversationId, 'web');

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'text':
        sendJSON(ws, { type: 'text', text: chunk.text, conversationId });
        break;

      case 'tool_call':
        if (chunk.toolCall) {
          sendJSON(ws, {
            type: chunk.text ? 'tool_result' : 'tool_call',
            toolCall: chunk.toolCall,
            text: chunk.text,
            conversationId,
          });
        }
        break;

      case 'done':
        sendJSON(ws, { type: 'done', usage: chunk.usage, conversationId });
        break;

      case 'error':
        sendJSON(ws, { type: 'error', error: chunk.error, conversationId });
        break;
    }
  }
}

/**
 * Safely send a JSON message over a WebSocket.
 */
function sendJSON(ws: WebSocket, data: WSOutgoing): void {
  try {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  } catch (err) {
    logger.error('chat', 'Failed to send WebSocket message', err);
  }
}
