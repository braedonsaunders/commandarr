import { type TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
            {props.required && <span className="ml-1 text-red-400">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-gray-100',
            'placeholder:text-gray-500 resize-y',
            'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-red-500' : 'border-slate-700',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${textareaId}-error`
              : description
                ? `${textareaId}-desc`
                : undefined
          }
          {...props}
        />

        {description && !error && (
          <p id={`${textareaId}-desc`} className="text-xs text-gray-500">
            {description}
          </p>
        )}
        {error && (
          <p id={`${textareaId}-error`} className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
