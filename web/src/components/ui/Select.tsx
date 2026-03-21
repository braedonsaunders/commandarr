import { type SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  description?: string;
  error?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, label, description, error, options, placeholder, id, ...props },
    ref,
  ) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
            {props.required && <span className="ml-1 text-red-400">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'flex h-10 w-full appearance-none rounded-lg border bg-slate-800 px-3 py-2 pr-9 text-sm text-gray-100',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-red-500' : 'border-slate-700',
              className,
            )}
            aria-invalid={!!error}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
        </div>

        {description && !error && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
