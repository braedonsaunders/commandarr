import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { StatusBadge } from '../../components/integrations/StatusBadge';
import {
  Tv, Film, Monitor, Plug, Search, X, ChevronDown,
  PlayCircle, HardDrive, Download, DownloadCloud, BarChart2,
  BookOpen, EyeOff, ArrowDownCircle, Flame, Music, Home,
  Package, Inbox,
} from 'lucide-react';

const cardContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
};

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  configured: boolean;
  healthy: boolean;
  status: string;
  toolCount: number;
}

type StatusFilter = 'all' | 'configured' | 'healthy' | 'unhealthy' | 'unconfigured';
type CategoryFilter = 'all' | 'media-servers' | 'media-management' | 'download-clients' | 'indexers-requests' | 'monitoring' | 'smart-home';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  tv: Tv,
  film: Film,
  monitor: Monitor,
  'play-circle': PlayCircle,
  'hard-drive': HardDrive,
  download: Download,
  'download-cloud': DownloadCloud,
  'bar-chart-2': BarChart2,
  'book-open': BookOpen,
  'eye-off': EyeOff,
  'arrow-down-circle': ArrowDownCircle,
  flame: Flame,
  music: Music,
  home: Home,
  package: Package,
  inbox: Inbox,
  search: Search,
};

const CATEGORY_MAP: Record<string, CategoryFilter> = {
  plex: 'media-servers',
  jellyfin: 'media-servers',
  emby: 'media-servers',
  radarr: 'media-management',
  sonarr: 'media-management',
  lidarr: 'media-management',
  readarr: 'media-management',
  whisparr: 'media-management',
  bazarr: 'media-management',
  sabnzbd: 'download-clients',
  nzbget: 'download-clients',
  qbittorrent: 'download-clients',
  transmission: 'download-clients',
  deluge: 'download-clients',
  unpackerr: 'download-clients',
  prowlarr: 'indexers-requests',
  seerr: 'indexers-requests',
  tautulli: 'monitoring',
  homeassistant: 'smart-home',
};

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  'all': 'All',
  'media-servers': 'Media Servers',
  'media-management': 'Media Management',
  'download-clients': 'Download Clients',
  'indexers-requests': 'Indexers & Requests',
  'monitoring': 'Monitoring',
  'smart-home': 'Smart Home',
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All Status',
  configured: 'Configured',
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  unconfigured: 'Not Configured',
};

function getCategory(id: string): CategoryFilter {
  return CATEGORY_MAP[id] || 'monitoring';
}

function getStatus(i: Integration): 'healthy' | 'unhealthy' | 'unconfigured' {
  if (!i.configured) return 'unconfigured';
  return i.healthy ? 'healthy' : 'unhealthy';
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(data => { setIntegrations(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return integrations.filter(i => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        if (
          !i.name.toLowerCase().includes(q) &&
          !i.description.toLowerCase().includes(q) &&
          !i.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all') {
        const status = getStatus(i);
        if (statusFilter === 'configured' && !i.configured) return false;
        if (statusFilter === 'healthy' && status !== 'healthy') return false;
        if (statusFilter === 'unhealthy' && status !== 'unhealthy') return false;
        if (statusFilter === 'unconfigured' && status !== 'unconfigured') return false;
      }

      // Category
      if (categoryFilter !== 'all' && getCategory(i.id) !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [integrations, search, statusFilter, categoryFilter]);

  // Stats for the summary bar
  const stats = useMemo(() => {
    const total = integrations.length;
    const configured = integrations.filter(i => i.configured).length;
    const healthy = integrations.filter(i => i.configured && i.healthy).length;
    const unhealthy = integrations.filter(i => i.configured && !i.healthy).length;
    return { total, configured, healthy, unhealthy, unconfigured: total - configured };
  }, [integrations]);

  // Categories with counts for the filter pills
  const categoryCountMap = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: integrations.length,
      'media-servers': 0,
      'media-management': 0,
      'download-clients': 0,
      'indexers-requests': 0,
      monitoring: 0,
      'smart-home': 0,
    };
    for (const i of integrations) {
      const cat = getCategory(i.id);
      counts[cat]++;
    }
    return counts;
  }, [integrations]);

  const hasActiveFilters = search !== '' || statusFilter !== 'all' || categoryFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Integrations</h1>
          <p className="text-sm text-gray-400 mt-1">Connect and manage your media services</p>
        </div>

        {!loading && (
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {stats.healthy} healthy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {stats.unhealthy} unhealthy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              {stats.unconfigured} not configured
            </span>
          </div>
        )}
      </div>

      {/* Search + filter toggle */}
      {!loading && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search integrations..."
                className="w-full h-10 pl-9 pr-9 bg-slate-800 border border-slate-700 rounded-lg text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-3 rounded-lg border text-sm flex items-center gap-1.5 transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-gray-400 hover:text-gray-300'
              }`}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              Filters
              {hasActiveFilters && !showFilters && (
                <span className="ml-1 h-4 w-4 rounded-full bg-amber-500 text-[10px] text-black font-bold flex items-center justify-center">
                  {(statusFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
                  {/* Status filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(STATUS_LABELS) as [StatusFilter, string][]).map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => setStatusFilter(value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            statusFilter === value
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-gray-400 border border-slate-700 hover:text-gray-300 hover:border-slate-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Category</label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.entries(CATEGORY_LABELS) as [CategoryFilter, string][]).map(([value, label]) => {
                        const count = categoryCountMap[value];
                        return (
                          <button
                            key={value}
                            onClick={() => setCategoryFilter(value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              categoryFilter === value
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-gray-400 border border-slate-700 hover:text-gray-300 hover:border-slate-600'
                            }`}
                          >
                            {label}
                            <span className="ml-1.5 opacity-60">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active filter summary */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>
                Showing {filtered.length} of {integrations.length} integrations
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-gray-400 text-center py-20">Loading integrations...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="text-gray-500 text-4xl">
            <Search className="w-10 h-10 mx-auto opacity-30" />
          </div>
          <p className="text-gray-400">No integrations match your filters</p>
          <button
            onClick={clearFilters}
            className="text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={cardContainerVariants}
          initial="hidden"
          animate="show"
          key={`${statusFilter}-${categoryFilter}-${search}`}
        >
          {filtered.map(integration => {
            const IconComponent = ICON_MAP[integration.icon] || Plug;
            const status = getStatus(integration);
            const category = CATEGORY_LABELS[getCategory(integration.id)];

            return (
              <motion.a
                key={integration.id}
                href={`/integrations/${integration.id}`}
                className="block p-5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-600 transition-all hover:shadow-lg group"
                variants={cardVariants}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                layout
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
                  <StatusBadge status={status} />
                </div>
                <h3 className="text-lg font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                  {integration.name}
                </h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{integration.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{integration.toolCount} tools</span>
                  <span className="text-gray-600">{category}</span>
                </div>
              </motion.a>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
