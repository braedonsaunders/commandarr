import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, description, error, id, type = 'text', ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
            {props.required && <span className="ml-1 text-red-400">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            'flex h-10 w-full rounded-lg border bg-slate-800 px-3 py-2 text-sm text-gray-100',
            'placeholder:text-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-red-500' : 'border-slate-700',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : description
                ? `${inputId}-desc`
                : undefined
          }
          {...props}
        />

        {description && !error && (
          <p id={`${inputId}-desc`} className="text-xs text-gray-500">
            {description}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
