import { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// ─── Router context ──────────────────────────────────────────────────

interface RouterCtx {
  path: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterCtx>({ path: '/', navigate: () => {} });

export function useRouter() {
  return useContext(RouterContext);
}

// ─── Page imports ───────────────────────────────────────────────────

import DashboardPage from './routes/index';
import ChatPage from './routes/chat';
import IntegrationsPage from './routes/integrations/index';
import IntegrationDetailPage from './routes/integrations/detail';
import AutomationsPage from './routes/automations';
import WidgetsPage from './routes/widgets';
import SettingsPage from './routes/settings/index';
import LogsPage from './routes/logs';

// ─── Page title map ────────────────────────────────────────────────

function getPageTitle(path: string): string {
  if (path === '/' || path === '') return 'Dashboard';
  if (path === '/chat') return 'Chat';
  if (path === '/integrations') return 'Integrations';
  if (path.startsWith('/integrations/')) return 'Integration';
  if (path === '/automations') return 'Automations';
  if (path === '/widgets') return 'Widgets';
  if (path.startsWith('/settings')) return 'Settings';
  if (path === '/logs') return 'Logs';
  return 'Dashboard';
}

// ─── Router component ───────────────────────────────────────────────

function PageContent({ path }: { path: string }) {
  if (path === '/' || path === '') return <DashboardPage />;
  if (path === '/chat') return <ChatPage />;
  if (path === '/integrations') return <IntegrationsPage />;
  if (path.startsWith('/integrations/')) return <IntegrationDetailPage />;
  if (path === '/automations') return <AutomationsPage />;
  if (path === '/widgets') return <WidgetsPage />;
  if (path.startsWith('/settings')) return <SettingsPage />;
  if (path === '/logs') return <LogsPage />;
  return <DashboardPage />;
}

// ─── App ─────────────────────────────────────────────────────────────

export function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
    [],
  );

  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, '', to);
    setPath(to);
  }, []);

  // Intercept anchor clicks for SPA navigation
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (
        anchor &&
        anchor.href &&
        anchor.origin === window.location.origin &&
        !anchor.hasAttribute('target') &&
        !anchor.hasAttribute('download') &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        e.preventDefault();
        navigate(anchor.pathname);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterContext.Provider value={{ path, navigate }}>
        <div className="flex h-screen bg-slate-950 text-gray-100">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header title={getPageTitle(path)} />
            <AnimatePresence mode="wait">
              <motion.main
                key={path}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex-1 overflow-y-auto p-6"
              >
                <PageContent path={path} />
              </motion.main>
            </AnimatePresence>
          </div>
        </div>
      </RouterContext.Provider>
    </QueryClientProvider>
  );
}
