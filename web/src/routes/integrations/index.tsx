import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { StatusBadge } from '../../components/integrations/StatusBadge';
import { Button } from '../../components/ui/Button';
import {
  Tv, Film, Monitor, Plug, Search, X, ChevronDown,
  PlayCircle, HardDrive, Download, DownloadCloud, BarChart2,
  BookOpen, EyeOff, ArrowDownCircle, Flame, Music, Home,
  Package, Inbox, Plus, Sparkles, Upload, Store, FolderOpen, Loader2, Power,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from '@/App';

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
  enabled: boolean;
  status: string;
  toolCount: number;
  webUrl?: string;
}

type StatusFilter = 'all' | 'configured' | 'healthy' | 'unhealthy' | 'unconfigured' | 'disabled';
type CategoryFilter = 'all' | 'media-servers' | 'media-management' | 'download-clients' | 'indexers-requests' | 'monitoring' | 'smart-home';
type CreateMode = null | 'prompt' | 'import' | 'marketplace';

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
  disabled: 'Disabled',
};

function getCategory(id: string): CategoryFilter {
  return CATEGORY_MAP[id] || 'monitoring';
}

function getStatus(i: Integration): 'healthy' | 'unhealthy' | 'unconfigured' | 'disabled' {
  if (!i.configured) return 'unconfigured';
  if (!i.enabled) return 'disabled';
  return i.healthy ? 'healthy' : 'unhealthy';
}

// ─── Add Integration Modal ────────────────────────────────────────────

function AddIntegrationPanel({
  mode,
  setMode,
  onClose,
  onSuccess,
}: {
  mode: CreateMode;
  setMode: (m: CreateMode) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ success: boolean; id?: string; summary?: string; error?: string } | null>(null);
  const [importPath, setImportPath] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; id?: string; error?: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const res = await fetch('/api/integrations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.success) {
        setGenResult({ success: true, id: data.id, summary: data.summary });
        onSuccess();
      } else {
        setGenResult({ success: false, error: data.error || 'Generation failed' });
      }
    } catch (e) {
      setGenResult({ success: false, error: 'Network error' });
    }
    setGenerating(false);
  };

  const handleImportFolder = async () => {
    if (!importPath.trim()) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await fetch('/api/integrations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: importPath }),
      });
      const data = await res.json();
      if (data.success) {
        setImportResult({ success: true, id: data.id });
        onSuccess();
      } else {
        setImportResult({ success: false, error: data.error || 'Import failed' });
      }
    } catch (e) {
      setImportResult({ success: false, error: 'Network error' });
    }
    setImporting(false);
  };

  const handleImportZip = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/integrations/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setImportResult({ success: true, id: data.id });
        onSuccess();
      } else {
        setImportResult({ success: false, error: data.error || 'Import failed' });
      }
    } catch (e) {
      setImportResult({ success: false, error: 'Network error' });
    }
    setImporting(false);
  };

  // Mode selector
  if (!mode) {
    return (
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-100">Add Integration</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-gray-400">Choose how you want to add a new integration</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setMode('prompt')}
            className="p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/30 rounded-xl text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="font-medium text-gray-100 group-hover:text-amber-400 transition-colors">AI Generate</h3>
            <p className="text-xs text-gray-500 mt-1">Describe what you need and AI will build a complete integration</p>
          </button>

          <button
            onClick={() => setMode('import')}
            className="p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/30 rounded-xl text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-medium text-gray-100 group-hover:text-blue-400 transition-colors">Import</h3>
            <p className="text-xs text-gray-500 mt-1">Import from a ZIP file or local folder</p>
          </button>

          <button
            onClick={() => setMode('marketplace')}
            className="p-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-purple-500/30 rounded-xl text-left transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
              <Store className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="font-medium text-gray-100 group-hover:text-purple-400 transition-colors">Marketplace</h3>
            <p className="text-xs text-gray-500 mt-1">Browse community integrations</p>
          </button>
        </div>
      </div>
    );
  }

  // AI Generate mode
  if (mode === 'prompt') {
    return (
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-gray-100">AI Integration Generator</h2>
          </div>
          <button onClick={() => { setMode(null); setGenResult(null); }} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-400">
          Describe the service you want to integrate. The AI will research its API and generate a complete integration with tools and widgets.
        </p>

        <div>
          <label className="mb-1 block text-sm text-gray-300">Service or Integration</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g., Tdarr - media transcoding/health checking tool&#10;e.g., Notifiarr - notification relay for arr stack&#10;e.g., Portainer - Docker container management"
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
            disabled={generating}
          />
        </div>

        {genResult && (
          <div className={`p-3 rounded-lg text-sm ${genResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {genResult.success ? (
              <>
                <span className="font-medium">Integration created!</span>
                <span className="text-green-300 ml-2">{genResult.summary}</span>
                {genResult.id && (
                  <a href={`/integrations/${genResult.id}`} className="block mt-1 text-amber-400 hover:text-amber-300 underline underline-offset-2">
                    Configure {genResult.id} →
                  </a>
                )}
              </>
            ) : (
              <span>{genResult.error}</span>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} loading={generating}>
            {generating ? 'Generating...' : 'Generate Integration'}
          </Button>
          <button
            onClick={() => { setMode(null); setGenResult(null); }}
            className="px-4 py-2 text-gray-400 hover:text-gray-200"
          >
            Back
          </button>
        </div>

        {generating && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Researching API and generating code... this may take a minute</span>
          </div>
        )}
      </div>
    );
  }

  // Import mode
  if (mode === 'import') {
    return (
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-100">Import Integration</h2>
          </div>
          <button onClick={() => { setMode(null); setImportResult(null); }} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ZIP upload */}
        <div>
          <label className="mb-1 block text-sm text-gray-300">Upload ZIP File</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleImportZip(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full p-4 border-2 border-dashed border-slate-700 hover:border-blue-500/30 rounded-xl text-center transition-colors"
          >
            <Upload className="w-6 h-6 text-gray-500 mx-auto mb-2" />
            <span className="text-sm text-gray-400">Click to upload a .zip file</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="flex-1 h-px bg-slate-700" />
          <span>OR</span>
          <span className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Folder path */}
        <div>
          <label className="mb-1 block text-sm text-gray-300">Local Folder Path</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={importPath}
                onChange={e => setImportPath(e.target.value)}
                placeholder="/path/to/integration-folder"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                disabled={importing}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleImportFolder}
              disabled={importing || !importPath.trim()}
              loading={importing}
            >
              Import
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Folder must contain manifest.ts and client.ts</p>
        </div>

        {importResult && (
          <div className={`p-3 rounded-lg text-sm ${importResult.success ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {importResult.success ? (
              <>
                <span className="font-medium">Integration imported!</span>
                {importResult.id && (
                  <a href={`/integrations/${importResult.id}`} className="block mt-1 text-amber-400 hover:text-amber-300 underline underline-offset-2">
                    Configure {importResult.id} →
                  </a>
                )}
              </>
            ) : (
              <span>{importResult.error}</span>
            )}
          </div>
        )}

        <button
          onClick={() => { setMode(null); setImportResult(null); }}
          className="text-sm text-gray-400 hover:text-gray-200"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Marketplace mode (placeholder)
  if (mode === 'marketplace') {
    return (
      <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-gray-100">Marketplace</h2>
          </div>
          <button onClick={() => setMode(null)} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-12 text-center">
          <Store className="w-12 h-12 text-purple-400/30 mx-auto mb-3" />
          <h3 className="text-gray-300 font-medium">Coming Soon</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Browse and install community-built integrations from the Commandarr marketplace.
          </p>
        </div>

        <button
          onClick={() => setMode(null)}
          className="text-sm text-gray-400 hover:text-gray-200"
        >
          ← Back
        </button>
      </div>
    );
  }

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────

function WebUIButton({ integration, navigate }: { integration: Integration; navigate: (to: string) => void }) {
  if (!integration.webUrl || !integration.configured || !integration.enabled) return null;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/integrations/${integration.id}/webui`);
      }}
      className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/30 transition-all"
      title={`Open ${integration.name} WebUI`}
    >
      <ExternalLink className="w-3 h-3" />
      WebUI
    </button>
  );
}

export default function IntegrationsPage() {
  const { navigate } = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(null);

  const loadIntegrations = () => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(data => { setIntegrations(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadIntegrations(); }, []);

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
        if (statusFilter === 'disabled' && status !== 'disabled') return false;
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

        <div className="flex items-center gap-3">
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
          <Button
            onClick={() => {
              setShowCreate(!showCreate);
              if (!showCreate) setCreateMode(null);
            }}
          >
            <Plus size={16} />
            Add Integration
          </Button>
        </div>
      </div>

      {/* Create integration panel */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <AddIntegrationPanel
              mode={createMode}
              setMode={setCreateMode}
              onClose={() => { setShowCreate(false); setCreateMode(null); }}
              onSuccess={loadIntegrations}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
            const isDisabled = status === 'disabled';

            return (
              <motion.a
                key={integration.id}
                href={`/integrations/${integration.id}`}
                className={`block p-5 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-600 transition-all hover:shadow-lg group ${isDisabled ? 'opacity-50' : ''}`}
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
                  <div className="flex items-center gap-2">
                    {integration.configured && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          fetch(`/api/integrations/${integration.id}/enabled`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enabled: !integration.enabled }),
                          }).then(() => loadIntegrations());
                        }}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          integration.enabled
                            ? 'bg-green-500/80 hover:bg-green-500'
                            : 'bg-gray-600 hover:bg-gray-500'
                        }`}
                        title={integration.enabled ? 'Disable integration' : 'Enable integration'}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            integration.enabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                    <StatusBadge status={status} />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                  {integration.name}
                </h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{integration.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{integration.toolCount} tools</span>
                  <div className="flex items-center gap-2">
                    <WebUIButton integration={integration} navigate={navigate} />
                    <span className="text-gray-600">{category}</span>
                  </div>
                </div>
              </motion.a>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
