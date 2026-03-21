import { useEffect, useRef, useCallback, useState } from 'react';

export interface WSMessage {
  type: string;
  data: unknown;
}

interface UseWebSocketOptions {
  onMessage?: (msg: WSMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export function useWebSocket(path: string, options: UseWebSocketOptions = {}) {
  const {
    onMessage,
    onOpen,
    onClose,
    onError,
    autoReconnect = true,
    reconnectInterval = 3000,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${path}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      onOpen?.();
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        onMessage?.(msg);
      } catch {
        onMessage?.({ type: 'raw', data: event.data });
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      onClose?.();
      if (autoReconnect && mountedRef.current) {
        reconnectTimer.current = setTimeout(connect, reconnectInterval);
      }
    };

    ws.onerror = (err) => {
      if (!mountedRef.current) return;
      onError?.(err);
    };

    wsRef.current = ws;
  }, [path, onMessage, onOpen, onClose, onError, autoReconnect, reconnectInterval]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return { connected, send, disconnect, reconnect: connect };
}

// Chat-specific WebSocket hook
export interface ChatStreamChunk {
  type: 'content' | 'tool_call_start' | 'tool_call_result' | 'done' | 'error';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    params: Record<string, unknown>;
  };
  toolResult?: {
    id: string;
    result: unknown;
    status: 'success' | 'error';
  };
  error?: string;
}

export function useChatStream(onChunk: (chunk: ChatStreamChunk) => void) {
  const handleMessage = useCallback((msg: WSMessage) => {
    onChunk(msg as unknown as ChatStreamChunk);
  }, [onChunk]);

  return useWebSocket('/ws/chat', { onMessage: handleMessage });
}

// Log streaming WebSocket hook
export interface LogStreamEntry {
  type: 'log';
  data: {
    id: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    source: string;
    message: string;
    timestamp: string;
    meta?: Record<string, unknown>;
  };
}

export function useLogStream(onLog: (entry: LogStreamEntry['data']) => void) {
  const handleMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'log') {
      onLog(msg.data as LogStreamEntry['data']);
    }
  }, [onLog]);

  return useWebSocket('/ws/logs', { onMessage: handleMessage });
}
