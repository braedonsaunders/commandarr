import {
  type ReactNode,
  type MouseEvent,
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface DialogCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<DialogCtx>({ open: false, setOpen: () => {} });

/* ------------------------------------------------------------------ */
/*  Dialog (root)                                                      */
/* ------------------------------------------------------------------ */

interface DialogProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({ children, open: controlledOpen, onOpenChange }: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange],
  );

  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

/* ------------------------------------------------------------------ */
/*  DialogTrigger                                                      */
/* ------------------------------------------------------------------ */

export function DialogTrigger({
  children,
  asChild,
  className,
}: {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
}) {
  const { setOpen } = useContext(Ctx);

  if (asChild) {
    return (
      <span className={className} onClick={() => setOpen(true)}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => setOpen(true)}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  DialogContent                                                      */
/* ------------------------------------------------------------------ */

export function DialogContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { open, setOpen } = useContext(Ctx);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    },
    [setOpen],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) setOpen(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Content */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl',
          'max-h-[90vh] overflow-y-auto',
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

export function DialogHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('mb-4 pr-6', className)}>{children}</div>;
}

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn('text-lg font-semibold text-gray-100', className)}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('mt-1 text-sm text-gray-400', className)}>{children}</p>
  );
}

export function DialogFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mt-6 flex items-center justify-end gap-3', className)}>
      {children}
    </div>
  );
}
