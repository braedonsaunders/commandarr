import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useRouter } from '@/App';

interface LayoutProps {
  children: ReactNode;
  pageTitle: string;
}

export function Layout({ children, pageTitle }: LayoutProps) {
  const { path } = useRouter();

  return (
    <div className="flex h-screen bg-slate-950 text-gray-100">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={pageTitle} />

        <AnimatePresence mode="wait">
          <motion.main
            key={path}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-1 overflow-y-auto p-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
