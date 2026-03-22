import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import type { ToolCallData } from '../components/chat/ToolCallCard';
import { Plus, X, MessageSquare, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallData[];
}

interface Conversation {
  id: string;
  platform: string;
  messages: { role: string; content: string }[];
  createdAt: string;
  updatedAt: string;
}

interface GroupedConversations {
  label: string;
  conversations: Conversation[];
}

const QUICK_ACTIONS = [
  "What's currently playing on Plex?",
  "Check download queue",
  "What movies are coming out this week?",
  "Is everything running?",
];

// ─── Helpers ──────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getPreviewText(conv: Conversation): string {
  if (!conv.messages || conv.messages.length === 0) return 'Empty conversation';
  const firstUserMsg = conv.messages.find(m => m.role === 'user');
  return firstUserMsg?.content || conv.messages[0]?.content || 'Empty conversation';
}

function groupConversations(conversations: Conversation[]): GroupedConversations[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  };

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (date >= todayStart) groups.Today.push(conv);
    else if (date >= yesterdayStart) groups.Yesterday.push(conv);
    else if (date >= weekStart) groups['Previous 7 days'].push(conv);
    else groups.Older.push(conv);
  }

  return ['Today', 'Yesterday', 'Previous 7 days', 'Older']
    .filter(label => groups[label].length > 0)
    .map(label => ({ label, conversations: groups[label] }));
}

// ─── Sidebar ──────────────────────────────────────────────────────────

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (conv: Conversation) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onToggle,
}: ConversationSidebarProps) {
  const grouped = useMemo(() => groupConversations(conversations), [conversations]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800">
        <span className="text-sm font-semibold text-gray-300">Conversations</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            <Plus size={14} />
            New Chat
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-slate-800 transition-colors lg:hidden"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare size={24} className="mx-auto text-gray-600 mb-2" />
            <p className="text-xs text-gray-500">No conversations yet</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.label} className="mb-2">
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {group.label}
                </span>
              </div>
              <AnimatePresence initial={false}>
                {group.conversations.map(conv => (
                  <motion.div
                    key={conv.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={() => onSelect(conv)}
                      className={cn(
                        'group w-full text-left px-3 py-2 mx-0 flex items-start gap-2 transition-colors relative',
                        activeId === conv.id
                          ? 'bg-slate-800/80 text-gray-100'
                          : 'text-gray-400 hover:bg-slate-800/50 hover:text-gray-200'
                      )}
                    >
                      <MessageSquare size={14} className="mt-0.5 shrink-0 opacity-50" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate leading-snug">
                          {getPreviewText(conv)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {getRelativeTime(conv.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 rounded transition-all shrink-0"
                        aria-label="Delete conversation"
                      >
                        <X size={14} />
                      </button>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[260px] shrink-0 h-full">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={onToggle}
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed left-0 top-0 bottom-0 w-[260px] z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Chat page ────────────────────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCallData[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const fetchHistoryRef = useRef<() => void>(() => {});

  // ─── Fetch conversation history ──────────────────────────────────
  const fetchHistory = useCallback(() => {
    fetch('/api/chat/history')
      .then(r => r.json())
      .then((data: Conversation[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setConversations(sorted);
      })
      .catch(() => {});
  }, []);

  fetchHistoryRef.current = fetchHistory;

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ─── Shared WS message handler ───────────────────────────────────
  const createWsHandler = useCallback(() => {
    return (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'connected') {
        setConversationId(data.conversationId);
      } else if (data.type === 'text') {
        setStreamText(prev => prev + data.text);
      } else if (data.type === 'tool_call') {
        const tc = data.toolCall;
        let params: Record<string, unknown> = {};
        let result: string | undefined;
        try { params = JSON.parse(tc.function?.arguments || '{}'); } catch {}
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
        fetchHistoryRef.current();
      } else if (data.type === 'error') {
        setMessages(msgs => [...msgs, { role: 'assistant', content: `Error: ${data.error}` }]);
        setStreamText('');
        setPendingToolCalls([]);
        setSending(false);
      }
    };
  }, []);

  // ─── Connect WS ──────────────────────────────────────────────────
  const openWs = useCallback((convId: string | null) => {
    wsRef.current?.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const convParam = convId ? `?conversationId=${convId}` : '';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat${convParam}`);
    ws.onmessage = createWsHandler();
    ws.onclose = () => {
      // Only reconnect if this ws is still the active one
      if (wsRef.current === ws) {
        setTimeout(() => openWs(convId), 3000);
      }
    };
    wsRef.current = ws;
  }, [createWsHandler]);

  useEffect(() => {
    openWs(null);
    return () => { wsRef.current?.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────
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
          fetchHistory();
        })
        .catch(e => {
          setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
          setSending(false);
        });
    }
  };

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setStreamText('');
    setPendingToolCalls([]);
    setSending(false);
    openWs(null);
    setSidebarOpen(false);
  }, [openWs]);

  const handleSelectConversation = useCallback((conv: Conversation) => {
    if (conv.id === conversationId) return;

    const loadedMessages: ChatMessage[] = (conv.messages || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    setMessages(loadedMessages);
    setConversationId(conv.id);
    setStreamText('');
    setPendingToolCalls([]);
    setSending(false);
    openWs(conv.id);
    setSidebarOpen(false);
  }, [conversationId, openWs]);

  const handleDeleteConversation = useCallback((id: string) => {
    fetch(`/api/chat/history/${id}`, { method: 'DELETE' })
      .then(() => {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (id === conversationId) {
          handleNewChat();
        }
      })
      .catch(() => {});
  }, [conversationId, handleNewChat]);

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)]">
        {/* Conversation sidebar */}
        <ConversationSidebar
          conversations={conversations}
          activeId={conversationId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
        />

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(o => !o)}
                className="p-1.5 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-slate-800 transition-colors lg:hidden"
              >
                <PanelLeftOpen size={18} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-100">Chat</h1>
                <p className="text-sm text-gray-400">Talk to your media stack</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button onClick={handleNewChat}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors">
                New Chat
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
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
      </div>
    </>
  );
}
