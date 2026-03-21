import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { StatusBadge } from '../../components/integrations/StatusBadge';
import { Tv, Film, Monitor, Plug } from 'lucide-react';

const cardContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
};

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  configured: boolean;
  healthy: boolean;
  toolCount: number;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  tv: Tv,
  film: Film,
  monitor: Monitor,
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(data => { setIntegrations(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const getStatus = (i: Integration) => {
    if (!i.configured) return 'unconfigured';
    return i.healthy ? 'healthy' : 'unhealthy';
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Integrations</h1>
          <p className="text-sm text-gray-400 mt-1">Connect and manage your media services</p>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading integrations...</div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={cardContainerVariants}
            initial="hidden"
            animate="show"
          >
            {integrations.map(integration => {
              const IconComponent = ICON_MAP[integration.icon] || Plug;
              return (
                <motion.a
                  key={integration.id}
                  href={`/integrations/${integration.id}`}
                  className="block p-5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-600 transition-all hover:shadow-lg group"
                  variants={cardVariants}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${integration.color}20` }}
                    >
                      <IconComponent
                        className="w-5 h-5"
                        color={integration.color}
                      />
                    </div>
                    <StatusBadge status={getStatus(integration)} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                    {integration.name}
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">{integration.description}</p>
                  <div className="mt-3 text-xs text-gray-500">
                    {integration.toolCount} tools available
                  </div>
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </div>
    </>
  );
}
