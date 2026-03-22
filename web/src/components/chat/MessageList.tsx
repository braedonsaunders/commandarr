import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { ToolCallCard, type ToolCallData } from './ToolCallCard';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallData[];
}

interface MessageListProps {
  messages: ChatMessage[];
  streamText?: string;
  isThinking?: boolean;
  pendingToolCalls?: ToolCallData[];
  className?: string;
}

function ThinkingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start"
    >
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-slate-800 px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-amber-500/70"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-1">Thinking...</span>
      </div>
    </motion.div>
  );
}

export function MessageList({ messages, streamText, isThinking, pendingToolCalls, className }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText, isThinking, pendingToolCalls]);

  return (
    <div ref={scrollRef} className={cn('flex-1 overflow-y-auto space-y-3 p-4', className)}>
      {messages.map((msg, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="space-y-2"
        >
          <div className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              msg.role === 'user'
                ? 'bg-amber-500 text-gray-900 rounded-br-md'
                : 'bg-slate-800 text-gray-100 rounded-bl-md',
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>

          {/* Tool calls */}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <div className="space-y-2 max-w-[85%]">
              {msg.toolCalls.map((tc, tcIdx) => (
                <ToolCallCard key={tcIdx} toolCall={tc} />
              ))}
            </div>
          )}
        </motion.div>
      ))}

      {/* Pending tool calls (while streaming) */}
      <AnimatePresence>
        {pendingToolCalls && pendingToolCalls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2 max-w-[85%]"
          >
            {pendingToolCalls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thinking indicator */}
      <AnimatePresence>
        {isThinking && <ThinkingIndicator />}
      </AnimatePresence>

      {/* Streaming text */}
      {streamText && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-slate-800 text-gray-100 rounded-bl-md">
              <p className="whitespace-pre-wrap">{streamText}<span className="inline-block w-1.5 h-4 bg-amber-500/70 animate-pulse ml-0.5 align-middle rounded-sm" /></p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
