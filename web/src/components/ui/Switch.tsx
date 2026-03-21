import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, label, id, ...props }, ref) => {
    const switchId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    const toggle = (
      <button
        ref={ref}
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-amber-500' : 'bg-slate-700',
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    );

    if (!label) return toggle;

    return (
      <div className="flex items-center gap-3">
        {toggle}
        <label
          htmlFor={switchId}
          className="text-sm font-medium text-gray-300 cursor-pointer select-none"
        >
          {label}
        </label>
      </div>
    );
  },
);

Switch.displayName = 'Switch';
