import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ */
/*  Card                                                               */
/* ------------------------------------------------------------------ */

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-slate-800 bg-slate-900 text-gray-100 shadow-sm',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

/* ------------------------------------------------------------------ */
/*  CardHeader                                                         */
/* ------------------------------------------------------------------ */

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  CardTitle                                                          */
/* ------------------------------------------------------------------ */

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-gray-100',
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  CardDescription                                                    */
/* ------------------------------------------------------------------ */

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-gray-400', className)} {...props} />
  );
}

/* ------------------------------------------------------------------ */
/*  CardContent                                                        */
/* ------------------------------------------------------------------ */

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6', className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/*  CardFooter                                                         */
/* ------------------------------------------------------------------ */

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center p-6 pt-0', className)}
      {...props}
    />
  );
}
