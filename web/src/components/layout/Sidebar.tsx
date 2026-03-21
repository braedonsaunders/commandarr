import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  MessageSquare,
  Plug,
  Zap,
  Puzzle,
  Brain,
  Settings,
  ScrollText,
  Satellite,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRouter } from '@/App';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Integrations', href: '/integrations', icon: Plug },
  { label: 'Automations', href: '/automations', icon: Zap },
  { label: 'Widgets', href: '/widgets', icon: Puzzle },
  { label: 'LLM Settings', href: '/settings/llm', icon: Brain },
  { label: 'Settings', href: '/settings/general', icon: Settings },
];

const bottomNavItems: NavItem[] = [
  { label: 'Logs', href: '/logs', icon: ScrollText },
];

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { path, navigate } = useRouter();
  const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
  const Icon = item.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(item.href);
    onNavigate();
  };

  return (
    <a
      href={item.href}
      onClick={handleClick}
      className={cn(
        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'text-amber-500'
          : 'text-gray-400 hover:bg-slate-800 hover:text-gray-200',
      )}
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-lg bg-amber-500/15"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <Icon size={18} className="relative z-10" />
      <span className="relative z-10">{item.label}</span>
    </a>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-lg bg-slate-900 p-2 text-gray-400 hover:text-gray-200 lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={closeMobile}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel – desktop: always visible, mobile: animated slide */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-950 border-r border-slate-800',
          'transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
          <Satellite size={22} className="text-amber-500" />
          <span className="text-lg font-bold text-gray-100 tracking-tight">
            Commandarr
          </span>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={closeMobile}
            className="ml-auto text-gray-500 hover:text-gray-300 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {mainNavItems.map((item, index) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
            >
              <NavLink item={item} onNavigate={closeMobile} />
            </motion.div>
          ))}
        </nav>

        {/* Bottom navigation */}
        <div className="border-t border-slate-800 px-3 py-3">
          {bottomNavItems.map((item, index) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (mainNavItems.length + index) * 0.03, duration: 0.25 }}
            >
              <NavLink item={item} onNavigate={closeMobile} />
            </motion.div>
          ))}
        </div>
      </aside>
    </>
  );
}
