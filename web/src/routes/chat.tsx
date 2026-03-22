import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, MessageSquare, PanelLeftOpen, PanelLeftClose,
  CheckCircle2, XCircle, ChevronDown, Loader2, Activity,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
  useAssistantToolUI,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from '@assistant-ui/react';

// ─── Types ───────────────────────────────────────────────────────────

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

// ─── Tool icon/label metadata (reused from ToolCallCard) ─────────────

const TOOL_META: Record<string, { color: string; label: string }> = {
  plex_health_check:  { color: '#E5A00D', label: 'Plex Health Check' },
  plex_now_playing:   { color: '#E5A00D', label: 'Now Playing' },
  plex_libraries:     { color: '#E5A00D', label: 'Plex Libraries' },
  plex_search:        { color: '#E5A00D', label: 'Plex Search' },
  plex_restart:       { color: '#E5A00D', label: 'Restart Plex' },
  radarr_search:      { color: '#FFC230', label: 'Movie Search' },
  radarr_add:         { color: '#FFC230', label: 'Add Movie' },
  radarr_queue:       { color: '#FFC230', label: 'Download Queue' },
  radarr_calendar:    { color: '#FFC230', label: 'Upcoming Movies' },
  radarr_profiles:    { color: '#FFC230', label: 'Quality Profiles' },
  sonarr_search:      { color: '#35C5F4', label: 'Show Search' },
  sonarr_add:         { color: '#35C5F4', label: 'Add Show' },
  sonarr_queue:       { color: '#35C5F4', label: 'Download Queue' },
  sonarr_calendar:    { color: '#35C5F4', label: 'Upcoming Episodes' },
  sonarr_profiles:    { color: '#35C5F4', label: 'Quality Profiles' },
};

function getToolMeta(name: string) {
  return TOOL_META[name] || { color: '#888', label: name.replace(/_/g, ' ') };
}

// ─── Helpers ─────────────────────────────────────────────────────────

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

// ─── Sidebar ─────────────────────────────────────────────────────────

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

// ─── Chat Model Adapter (WebSocket streaming) ────────────────────────

interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  argsText: string;
  result?: unknown;
  isError?: boolean;
}

type QueueItem =
  | { kind: 'message'; data: Record<string, unknown> }
  | { kind: 'close' }
  | { kind: 'error'; error: string };

// We store the current conversation ID in a ref accessible to the adapter.
// The adapter factory is re-created when the conversation ID changes.
function createChatModelAdapter(
  conversationIdRef: React.MutableRefObject<string | null>,
  setConversationId: (id: string) => void,
  onDone: () => void,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }): AsyncGenerator<ChatModelRunResult, void> {
      // Extract the last user message text
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (!lastUserMessage) return;

      let userText = '';
      if ('content' in lastUserMessage) {
        for (const part of lastUserMessage.content) {
          if (part.type === 'text') {
            userText = part.text;
            break;
          }
        }
      }

      if (!userText) return;

      // Open WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const convParam = conversationIdRef.current
        ? `?conversationId=${conversationIdRef.current}`
        : '';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/ws/chat${convParam}`
      );

      // Track accumulated state
      let fullText = '';
      const toolCalls: ToolCallPart[] = [];
      let toolCallCounter = 0;
      let done = false;
      let error: string | null = null;

      // Create a promise-based message queue
      const queue: QueueItem[] = [];
      let resolveWait: (() => void) | null = null;

      function enqueue(item: QueueItem) {
        queue.push(item);
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      }

      function waitForNext(): Promise<void> {
        if (queue.length > 0) return Promise.resolve();
        return new Promise(r => { resolveWait = r; });
      }

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'message',
          message: userText,
          conversationId: conversationIdRef.current,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          enqueue({ kind: 'message', data: parsed });
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        enqueue({ kind: 'close' });
      };

      ws.onerror = () => {
        enqueue({ kind: 'error', error: 'WebSocket connection error' });
      };

      // Handle abort
      const onAbort = () => {
        ws.close();
        enqueue({ kind: 'close' });
      };
      abortSignal.addEventListener('abort', onAbort);

      try {
        while (!done) {
          await waitForNext();

          while (queue.length > 0) {
            const item = queue.shift()!;

            if (item.kind === 'close') {
              done = true;
              break;
            }

            if (item.kind === 'error') {
              error = item.error;
              done = true;
              break;
            }

            const data = item.data;

            if (data.type === 'connected') {
              const newConvId = data.conversationId as string;
              if (newConvId) {
                conversationIdRef.current = newConvId;
                setConversationId(newConvId);
              }
            } else if (data.type === 'text') {
              fullText += data.text as string;
            } else if (data.type === 'tool_call') {
              const tc = data.toolCall as {
                function?: { name?: string; arguments?: string };
                name?: string;
              };
              let tcArgs: Record<string, unknown> = {};
              let argsText = '';
              try {
                argsText = tc.function?.arguments || '{}';
                tcArgs = JSON.parse(argsText);
              } catch {
                // use empty args
              }

              let tcResult: unknown = undefined;
              let tcIsError = false;
              if (data.text) {
                const textStr = data.text as string;
                try {
                  tcResult = JSON.parse(textStr);
                  tcIsError = textStr.startsWith('Error');
                } catch {
                  tcResult = textStr;
                  tcIsError = textStr.startsWith('Error');
                }
              }

              toolCallCounter++;
              toolCalls.push({
                type: 'tool-call',
                toolCallId: `tc_${toolCallCounter}`,
                toolName: tc.function?.name || tc.name || 'unknown',
                args: tcArgs,
                argsText,
                result: tcResult,
                isError: tcIsError,
              });
            } else if (data.type === 'done') {
              done = true;
              onDone();
              break;
            } else if (data.type === 'error') {
              error = data.error as string;
              done = true;
              break;
            }
          }

          // Build content parts for current state
          const contentParts: Array<{ type: 'text'; text: string } | ToolCallPart> = [];

          // Add tool calls first
          for (const tc of toolCalls) {
            contentParts.push(tc);
          }

          // Add text
          if (fullText) {
            contentParts.push({ type: 'text', text: fullText });
          }

          if (contentParts.length > 0) {
            const status = done
              ? error
                ? { type: 'incomplete' as const, reason: 'error' as const, error }
                : { type: 'complete' as const, reason: 'stop' as const }
              : { type: 'running' as const };

            yield { content: contentParts as unknown as ChatModelRunResult['content'], status };
          }
        }

        // Final yield if we exited with error and haven't yielded yet
        if (error && fullText === '' && toolCalls.length === 0) {
          yield {
            content: [{ type: 'text' as const, text: `Error: ${error}` }] as unknown as ChatModelRunResult['content'],
            status: { type: 'incomplete' as const, reason: 'error' as const, error },
          };
        }
      } finally {
        abortSignal.removeEventListener('abort', onAbort);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    },
  };
}

// ─── Tool Call UI Component ──────────────────────────────────────────

function ToolCallFallbackUI({ toolName, args, result, isError }: {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  addResult: (result: unknown) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = getToolMeta(toolName);
  const hasResult = result !== undefined;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden my-2',
        isError ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50 bg-slate-850',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${meta.color}15` }}
        >
          <Activity className="w-4 h-4" style={{ color: meta.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-200">{meta.label}</div>
          {Object.keys(args).length > 0 && (
            <div className="text-xs text-gray-500 truncate">
              {Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(' \u00b7 ')}
            </div>
          )}
        </div>

        {isError ? (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : hasResult ? (
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
        )}

        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 transition-transform shrink-0',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {/* Result body */}
      {expanded && hasResult && (
        <div className="border-t border-slate-800/50 px-4 py-3">
          {typeof result === 'object' && result !== null ? (
            <pre className="overflow-x-auto rounded bg-slate-800/50 p-2 text-xs text-gray-400 font-mono max-h-48 overflow-y-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-gray-300">{String(result)}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Custom Message Components ───────────────────────────────────────

function UserMessage() {
  return (
    <div className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] bg-amber-500 text-slate-950 rounded-2xl rounded-br-sm px-4 py-2.5 font-medium text-sm">
        <MessagePrimitive.Content
          components={{
            Text: ({ text }) => <p className="whitespace-pre-wrap">{text}</p>,
          }}
        />
      </div>
    </div>
  );
}

function AssistantMessage() {
  return (
    <div className="flex justify-start px-4 py-2">
      <div className="max-w-[85%]">
        <MessagePrimitive.Content
          components={{
            Text: ({ text }) => (
              <div className="bg-slate-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm">
                <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
              </div>
            ),
            tools: {
              Fallback: ToolCallFallbackUI,
            },
          }}
        />
      </div>
    </div>
  );
}

// ─── Quick Action Suggestions ────────────────────────────────────────

const QUICK_ACTIONS = [
  "What's currently playing on Plex?",
  "Check download queue",
  "What movies are coming out this week?",
  "Is everything running?",
];

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="text-4xl mb-4">&#x1F6F0;&#xFE0F;</div>
      <h2 className="text-xl font-semibold text-gray-200 mb-2">Commandarr</h2>
      <p className="text-gray-400 mb-6 max-w-md">
        Ask me anything about your media stack. I can check what&apos;s playing,
        manage downloads, add movies and shows, and more.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {QUICK_ACTIONS.map((action, index) => (
          <ThreadPrimitive.Suggestion
            key={action}
            prompt={action}
            autoSend
            asChild
          >
            <motion.button
              className="px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-lg border border-slate-700 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {action}
            </motion.button>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
}

// ─── Thread Component ────────────────────────────────────────────────

function ChatThread() {
  // Register a fallback tool UI so all tool calls render with our component
  useAssistantToolUI({
    toolName: '*',
    render: ToolCallFallbackUI,
  });

  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
        <ThreadPrimitive.Empty>
          <WelcomeScreen />
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <div className="p-4 border-t border-slate-800">
        <ComposerPrimitive.Root className="flex items-end gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2">
          <ComposerPrimitive.Input
            placeholder="Ask about your media stack..."
            className="flex-1 bg-transparent text-gray-100 text-sm outline-none resize-none min-h-[2.5rem] max-h-[10rem] placeholder:text-slate-500"
            autoFocus
          />
          <ThreadPrimitive.If running={false}>
            <ComposerPrimitive.Send className="shrink-0 w-8 h-8 flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </ComposerPrimitive.Send>
          </ThreadPrimitive.If>
          <ThreadPrimitive.If running>
            <ComposerPrimitive.Cancel className="shrink-0 w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
            </ComposerPrimitive.Cancel>
          </ThreadPrimitive.If>
        </ComposerPrimitive.Root>
      </div>
    </ThreadPrimitive.Root>
  );
}

// ─── Chat Page ───────────────────────────────────────────────────────

export default function ChatPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  // Keep ref in sync
  conversationIdRef.current = conversationId;

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

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ─── Chat model adapter ──────────────────────────────────────────
  const adapter = useMemo(
    () => createChatModelAdapter(conversationIdRef, setConversationId, fetchHistory),
    [fetchHistory]
  );

  const runtime = useLocalRuntime(adapter, {
    maxSteps: 5,
  });

  // ─── Handlers ────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setConversationId(null);
    conversationIdRef.current = null;
    setSidebarOpen(false);
    // Reset the thread in the runtime
    runtime.thread.reset();
  }, [runtime]);

  const handleSelectConversation = useCallback((conv: Conversation) => {
    if (conv.id === conversationIdRef.current) return;

    setConversationId(conv.id);
    conversationIdRef.current = conv.id;
    setSidebarOpen(false);

    // Load conversation messages into the runtime
    const threadMessages = (conv.messages || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    runtime.thread.reset(threadMessages);
  }, [runtime]);

  const handleDeleteConversation = useCallback((id: string) => {
    fetch(`/api/chat/history/${id}`, { method: 'DELETE' })
      .then(() => {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (id === conversationIdRef.current) {
          handleNewChat();
        }
      })
      .catch(() => {});
  }, [handleNewChat]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
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
            <button
              onClick={handleNewChat}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              New Chat
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
            <ChatThread />
          </div>
        </div>
      </div>
    </AssistantRuntimeProvider>
  );
}
