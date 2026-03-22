import type { ServerWebSocket } from 'bun';
import { processMessage } from '../agent/core';
import { logger, type LogEntry } from '../utils/logger';
import { nanoid } from 'nanoid';

interface WSData {
  type: 'chat' | 'logs' | 'widget';
  conversationId?: string;
  widgetId?: string;
}

// Track active WebSocket connections
const chatClients = new Set<ServerWebSocket<WSData>>();
const logClients = new Set<ServerWebSocket<WSData>>();

export function handleWSUpgrade(req: Request, server: any): boolean {
  const url = new URL(req.url);

  if (url.pathname === '/ws/chat') {
    const conversationId = url.searchParams.get('conversationId') || `web_${nanoid()}`;
    const success = server.upgrade(req, {
      data: { type: 'chat', conversationId } as WSData,
    });
    return !!success;
  }

  if (url.pathname === '/ws/logs') {
    const success = server.upgrade(req, {
      data: { type: 'logs' } as WSData,
    });
    return !!success;
  }

  if (url.pathname.startsWith('/ws/widget/')) {
    const widgetId = url.pathname.split('/ws/widget/')[1];
    const success = server.upgrade(req, {
      data: { type: 'widget', widgetId } as WSData,
    });
    return !!success;
  }

  return false;
}

export const wsHandlers = {
  open(ws: ServerWebSocket<WSData>) {
    const data = ws.data;
    if (data.type === 'chat') {
      chatClients.add(ws);
      ws.send(JSON.stringify({
        type: 'connected',
        conversationId: data.conversationId,
      }));
    } else if (data.type === 'logs') {
      logClients.add(ws);
      // Send recent logs
      const recent = logger.getRecentLogs(50);
      ws.send(JSON.stringify({ type: 'history', logs: recent }));
    }
  },

  async message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
    const data = ws.data;
    const msg = JSON.parse(typeof message === 'string' ? message : message.toString());

    if (data.type === 'chat') {
      await handleChatMessage(ws, data, msg);
    }
  },

  close(ws: ServerWebSocket<WSData>) {
    chatClients.delete(ws);
    logClients.delete(ws);
  },
};

async function handleChatMessage(
  ws: ServerWebSocket<WSData>,
  data: WSData,
  msg: { type: string; message?: string; conversationId?: string },
) {
  if (msg.type !== 'message' || !msg.message) return;

  const conversationId = msg.conversationId || data.conversationId || `web_${nanoid()}`;

  try {
    const stream = processMessage(msg.message, conversationId, 'web');

    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.text) {
        ws.send(JSON.stringify({
          type: 'text',
          text: chunk.text,
          conversationId,
        }));
      } else if (chunk.type === 'tool_call' && chunk.toolCall) {
        ws.send(JSON.stringify({
          type: 'tool_call',
          toolCall: chunk.toolCall,
          text: chunk.text,
          conversationId,
        }));
      } else if (chunk.type === 'done') {
        ws.send(JSON.stringify({
          type: 'done',
          conversationId,
          usage: chunk.usage,
        }));
      } else if (chunk.type === 'error') {
        ws.send(JSON.stringify({
          type: 'error',
          error: chunk.error,
          conversationId,
        }));
      }
    }

    ws.send(JSON.stringify({ type: 'done', conversationId }));
  } catch (e) {
    ws.send(JSON.stringify({
      type: 'error',
      error: e instanceof Error ? e.message : 'Unknown error',
      conversationId,
    }));
  }
}

// Set up log broadcasting
export function initLogBroadcast() {
  logger.subscribe((entry: LogEntry) => {
    const message = JSON.stringify({ type: 'log', ...entry });
    for (const client of logClients) {
      try {
        client.send(message);
      } catch {
        logClients.delete(client);
      }
    }
  });
}
