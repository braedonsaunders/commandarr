import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const variantStyles = {
  default:
    'bg-amber-500 text-gray-900 hover:bg-amber-400 font-semibold shadow-sm',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  outline:
    'border border-slate-700 bg-transparent text-gray-300 hover:bg-slate-800 hover:text-gray-100',
  ghost:
    'bg-transparent text-gray-400 hover:bg-slate-800 hover:text-gray-100',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  default: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
  icon: 'h-10 w-10 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <Loader2
          className={cn(
            'animate-spin',
            size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
          )}
        />
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
