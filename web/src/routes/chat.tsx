import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import type { ToolCallData } from '../components/chat/ToolCallCard';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallData[];
}

const QUICK_ACTIONS = [
  "What's currently playing on Plex?",
  "Check download queue",
  "What movies are coming out this week?",
  "Is everything running?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallData[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const convParam = conversationId ? `?conversationId=${conversationId}` : '';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat${convParam}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'connected') {
        setConversationId(data.conversationId);
      } else if (data.type === 'text') {
        setStreamText(prev => prev + data.text);
      } else if (data.type === 'tool_call') {
        // Parse tool call data
        const tc = data.toolCall;
        let params: Record<string, unknown> = {};
        let result: string | undefined;
        try { params = JSON.parse(tc.function?.arguments || '{}'); } catch {}
        // The text field contains the tool result JSON
        if (data.text) {
          try {
            const parsed = JSON.parse(data.text);
            result = parsed.message || data.text;
          } catch {
            result = data.text;
          }
        }
        setPendingToolCalls(prev => [...prev, {
          name: tc.function?.name || tc.name || 'unknown',
          parameters: params,
          result,
          error: result?.startsWith('Error') || false,
        }]);
      } else if (data.type === 'done') {
        // Finalize: commit stream text + tool calls as a message
        setStreamText(prev => {
          setPendingToolCalls(prevTC => {
            const toolCalls = prevTC.length > 0 ? [...prevTC] : undefined;
            if (prev || toolCalls) {
              setMessages(msgs => [...msgs, {
                role: 'assistant',
                content: prev,
                toolCalls,
              }]);
            }
            return [];
          });
          return '';
        });
        setSending(false);
      } else if (data.type === 'error') {
        setMessages(msgs => [...msgs, { role: 'assistant', content: `Error: ${data.error}` }]);
        setStreamText('');
        setPendingToolCalls([]);
        setSending(false);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWs, 3000);
    };

    wsRef.current = ws;
  }, [conversationId]);

  useEffect(() => {
    connectWs();
    return () => { wsRef.current?.close(); };
  }, []);

  const handleSend = (message: string) => {
    if (!message.trim() || sending) return;

    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setSending(true);
    setStreamText('');
    setPendingToolCalls([]);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', message, conversationId }));
    } else {
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId }),
      })
        .then(r => r.json())
        .then(data => {
          setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
          if (data.conversationId) setConversationId(data.conversationId);
          setSending(false);
        })
        .catch(e => {
          setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
          setSending(false);
        });
    }
  };

  const handleClear = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Chat</h1>
            <p className="text-sm text-gray-400">Talk to your media stack</p>
          </div>
          {messages.length > 0 && (
            <button onClick={handleClear}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
              Clear Chat
            </button>
          )}
        </div>

        <div className="flex-1 overflow-hidden bg-slate-900/50 rounded-xl border border-slate-800">
          {messages.length === 0 && !streamText && !sending ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-4xl mb-4">🛰️</div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">Commandarr</h2>
              <p className="text-gray-400 mb-6 max-w-md">
                Ask me anything about your media stack. I can check what's playing,
                manage downloads, add movies and shows, and more.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {QUICK_ACTIONS.map((action, index) => (
                  <motion.button key={action} onClick={() => handleSend(action)}
                    className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700 transition-colors"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    {action}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              streamText={streamText}
              isThinking={sending && !streamText && pendingToolCalls.length === 0}
              pendingToolCalls={pendingToolCalls}
            />
          )}
        </div>

        <div className="mt-4">
          <ChatInput onSend={handleSend} disabled={sending} />
        </div>
      </div>
    </>
  );
}
