import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        'flex items-end gap-2 border-t border-slate-800 bg-slate-900 p-4',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask Commandarr..."
        rows={1}
        className={cn(
          'flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-gray-100',
          'placeholder:text-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50',
          value.trim() && !disabled
            ? 'bg-amber-500 text-gray-900 hover:bg-amber-400'
            : 'bg-slate-800 text-gray-600 cursor-not-allowed',
        )}
        aria-label="Send message"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
