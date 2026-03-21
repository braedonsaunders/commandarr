import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
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
  className?: string;
}

export function MessageList({ messages, streamText, className }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamText]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-8 text-center', className)}>
        <div>
          <h3 className="mb-2 text-lg font-semibold text-gray-200">
            Commandarr Agent
          </h3>
          <p className="max-w-sm text-sm text-gray-500">
            Ask me anything about your media server. I can check
            what&apos;s playing, manage downloads, add movies, and more.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cn('flex-1 overflow-y-auto space-y-4 p-4', className)}
    >
      {messages.map((msg, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-amber-500 text-gray-900 rounded-br-md'
                  : 'bg-slate-800 text-gray-100 rounded-bl-md',
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>

          {/* Tool calls */}
          {msg.toolCalls && msg.toolCalls.length > 0 && (
            <div className="mt-2 ml-0 space-y-2 max-w-[80%]">
              {msg.toolCalls.map((tc, tcIdx) => (
                <ToolCallCard key={tcIdx} toolCall={tc} />
              ))}
            </div>
          )}
        </motion.div>
      ))}

      {/* Streaming text */}
      {streamText && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-slate-800 text-gray-100 rounded-bl-md">
              <p className="whitespace-pre-wrap">{streamText}</p>
              <span className="inline-block w-2 h-4 bg-amber-500/60 animate-pulse ml-0.5" />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
