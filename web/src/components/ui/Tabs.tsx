import {
  type ReactNode,
  createContext,
  useContext,
  useState,
  useCallback,
} from 'react';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface TabsCtx {
  value: string;
  onValueChange: (value: string) => void;
}

const Ctx = createContext<TabsCtx>({ value: '', onValueChange: () => {} });

/* ------------------------------------------------------------------ */
/*  Tabs (root)                                                        */
/* ------------------------------------------------------------------ */

interface TabsProps {
  children: ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export function Tabs({
  children,
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  className,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleChange = useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange],
  );

  return (
    <Ctx.Provider value={{ value, onValueChange: handleChange }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  TabsList                                                           */
/* ------------------------------------------------------------------ */

export function TabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex border-b border-slate-800',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TabsTrigger                                                        */
/* ------------------------------------------------------------------ */

export function TabsTrigger({
  children,
  value,
  className,
}: {
  children: ReactNode;
  value: string;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  const isActive = ctx.value === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
        isActive
          ? 'border-amber-500 text-amber-400'
          : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  TabsContent                                                        */
/* ------------------------------------------------------------------ */

export function TabsContent({
  children,
  value,
  className,
}: {
  children: ReactNode;
  value: string;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  if (ctx.value !== value) return null;

  return (
    <div role="tabpanel" className={cn('mt-4', className)}>
      {children}
    </div>
  );
}
