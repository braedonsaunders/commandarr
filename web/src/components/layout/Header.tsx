import { cn } from '@/lib/cn';

interface HeaderProps {
  title: string;
  className?: string;
}

export function Header({ title, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900 px-6',
        className,
      )}
    >
      {/* Page title (with left margin on mobile for hamburger button) */}
      <h1 className="text-lg font-semibold text-gray-100 pl-10 lg:pl-0">
        {title}
      </h1>

      {/* Agent status */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <span className="text-sm text-gray-400">Agent Online</span>
      </div>
    </header>
  );
}
