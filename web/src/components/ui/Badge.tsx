import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const variantStyles = {
  default: 'bg-slate-700/60 text-gray-300 border-slate-600',
  success: 'bg-green-500/15 text-green-400 border-green-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  destructive: 'bg-red-500/15 text-red-400 border-red-500/30',
  outline: 'bg-transparent text-gray-300 border-slate-600',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variantStyles;
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
