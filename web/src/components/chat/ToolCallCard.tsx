import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, ChevronDown, Tv, Film, Monitor, Activity,
  Search, Plus, ListOrdered, Calendar, Settings2, Loader2, HardDrive,
  Play, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ToolCallData {
  name: string;
  parameters: Record<string, unknown>;
  result?: string;
  error?: boolean;
}

// Map tool names to icons and colors
const TOOL_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  plex_health_check:  { icon: Activity,    color: '#E5A00D', label: 'Plex Health Check' },
  plex_now_playing:   { icon: Play,        color: '#E5A00D', label: 'Now Playing' },
  plex_libraries:     { icon: HardDrive,   color: '#E5A00D', label: 'Plex Libraries' },
  plex_search:        { icon: Search,      color: '#E5A00D', label: 'Plex Search' },
  plex_restart:       { icon: RefreshCw,   color: '#E5A00D', label: 'Restart Plex' },
  radarr_search:      { icon: Search,      color: '#FFC230', label: 'Movie Search' },
  radarr_add:         { icon: Plus,        color: '#FFC230', label: 'Add Movie' },
  radarr_queue:       { icon: ListOrdered, color: '#FFC230', label: 'Download Queue' },
  radarr_calendar:    { icon: Calendar,    color: '#FFC230', label: 'Upcoming Movies' },
  radarr_profiles:    { icon: Settings2,   color: '#FFC230', label: 'Quality Profiles' },
  sonarr_search:      { icon: Search,      color: '#35C5F4', label: 'Show Search' },
  sonarr_add:         { icon: Plus,        color: '#35C5F4', label: 'Add Show' },
  sonarr_queue:       { icon: ListOrdered, color: '#35C5F4', label: 'Download Queue' },
  sonarr_calendar:    { icon: Calendar,    color: '#35C5F4', label: 'Upcoming Episodes' },
  sonarr_profiles:    { icon: Settings2,   color: '#35C5F4', label: 'Quality Profiles' },
};

function getToolMeta(name: string) {
  return TOOL_META[name] || { icon: Activity, color: '#888', label: name.replace(/_/g, ' ') };
}

// Try to parse result as structured data for rich rendering
function parseResult(result?: string): { parsed: any; raw: string } | null {
  if (!result) return null;
  try {
    return { parsed: JSON.parse(result), raw: result };
  } catch {
    return { parsed: null, raw: result };
  }
}

function RichResult({ data }: { data: any }) {
  if (!data) return null;

  // Success/failure with message
  if (typeof data === 'object' && 'success' in data && 'message' in data) {
    return (
      <div className={cn(
        'rounded-lg p-3 text-sm',
        data.success ? 'bg-green-500/5 border border-green-500/20' : 'bg-red-500/5 border border-red-500/20',
      )}>
        <div className="flex items-center gap-2 mb-1">
          {data.success
            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
          <span className={data.success ? 'text-green-300' : 'text-red-300'}>{data.message}</span>
        </div>
        {data.data && <ResultData data={data.data} />}
      </div>
    );
  }

  return <ResultData data={data} />;
}

function ResultData({ data }: { data: any }) {
  if (!data) return null;

  // Array of items — render as a compact list/table
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0];

    // Sessions / now playing
    if ('title' in first && ('user' in first || 'player' in first)) {
      return (
        <div className="space-y-1.5 mt-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg">
              <Play className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">{item.grandparentTitle ? `${item.grandparentTitle} — ` : ''}{item.title}</div>
                <div className="text-xs text-gray-500">{item.user && `${item.user} · `}{item.player || ''}{item.progress ? ` · ${item.progress}%` : ''}</div>
              </div>
              {item.transcoding && <span className="text-xs text-amber-400/70 bg-amber-400/10 px-1.5 py-0.5 rounded">Transcode</span>}
            </div>
          ))}
        </div>
      );
    }

    // Libraries
    if ('name' in first && 'type' in first && !('year' in first)) {
      return (
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {data.map((lib: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
              {lib.type === 'movie' ? <Film className="w-4 h-4 text-amber-400 shrink-0" /> : <Tv className="w-4 h-4 text-blue-400 shrink-0" />}
              <div className="min-w-0">
                <div className="text-sm text-gray-200 truncate">{lib.name}</div>
                {lib.count != null && <div className="text-xs text-gray-500">{lib.count} items</div>}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Search results (movies/shows)
    if ('title' in first && ('year' in first || 'tmdbId' in first || 'tvdbId' in first)) {
      return (
        <div className="space-y-1.5 mt-2">
          {data.slice(0, 8).map((item: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg">
              <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center shrink-0">
                {item.tvdbId ? <Monitor className="w-4 h-4 text-blue-400" /> : <Film className="w-4 h-4 text-amber-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">{item.title}</div>
                <div className="text-xs text-gray-500">
                  {item.year && `${item.year}`}
                  {item.rating && ` · ⭐ ${item.rating}`}
                  {item.overview && ` · ${item.overview.slice(0, 60)}...`}
                </div>
              </div>
            </div>
          ))}
          {data.length > 8 && <div className="text-xs text-gray-500 text-center">+{data.length - 8} more results</div>}
        </div>
      );
    }

    // Queue items
    if ('title' in first && ('status' in first || 'progress' in first || 'sizeleft' in first)) {
      return (
        <div className="space-y-1.5 mt-2">
          {data.map((item: any, i: number) => (
            <div key={i} className="px-3 py-2 bg-slate-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-200 truncate">{item.title}</span>
                <span className="text-xs text-gray-500 shrink-0 ml-2">{item.status}</span>
              </div>
              {(item.progress != null || (item.size && item.sizeleft != null)) && (
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{
                    width: `${item.progress != null ? item.progress : Math.round((1 - item.sizeleft / item.size) * 100)}%`
                  }} />
                </div>
              )}
              {item.eta && <div className="text-xs text-gray-500 mt-1">ETA: {item.eta}</div>}
            </div>
          ))}
        </div>
      );
    }

    // Calendar items
    if ('title' in first && ('airDate' in first || 'inCinemas' in first || 'digitalRelease' in first || 'physicalRelease' in first)) {
      return (
        <div className="space-y-1.5 mt-2">
          {data.slice(0, 10).map((item: any, i: number) => {
            const date = item.airDate || item.inCinemas || item.digitalRelease || item.physicalRelease || '';
            return (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg">
                <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200 truncate">{item.title}</div>
                  {date && <div className="text-xs text-gray-500">{new Date(date).toLocaleDateString()}</div>}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Quality profiles
    if ('name' in first && 'id' in first && !('title' in first)) {
      return (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {data.map((p: any, i: number) => (
            <span key={i} className="px-2.5 py-1 bg-slate-800/50 rounded-lg text-xs text-gray-300">
              {p.name}
            </span>
          ))}
        </div>
      );
    }
  }

  // Server info object
  if (typeof data === 'object' && ('serverName' in data || 'version' in data)) {
    return (
      <div className="flex items-center gap-3 mt-2 px-3 py-2 bg-slate-800/50 rounded-lg">
        <Activity className="w-4 h-4 text-green-400 shrink-0" />
        <div>
          {data.serverName && <div className="text-sm text-gray-200">{data.serverName}</div>}
          {data.version && <div className="text-xs text-gray-500">v{data.version}</div>}
        </div>
      </div>
    );
  }

  // Fallback: compact JSON
  return (
    <pre className="mt-2 overflow-x-auto rounded bg-slate-800/50 p-2 text-xs text-gray-400 font-mono max-h-32 overflow-y-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function ToolCallCard({ toolCall }: { toolCall: ToolCallData }) {
  const [expanded, setExpanded] = useState(true);
  const meta = getToolMeta(toolCall.name);
  const Icon = meta.icon;
  const isError = toolCall.error === true;
  const parsed = parseResult(toolCall.result);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        isError ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700/50 bg-slate-850',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${meta.color}15` }}>
          <Icon className="w-4 h-4" style={{ color: meta.color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-200">{meta.label}</div>
          {Object.keys(toolCall.parameters).length > 0 && (
            <div className="text-xs text-gray-500 truncate">
              {Object.entries(toolCall.parameters).map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </div>
          )}
        </div>

        {isError
          ? <XCircle className="w-4 h-4 text-red-400 shrink-0" />
          : toolCall.result
            ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            : <Loader2 className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />}

        <ChevronDown className={cn('w-4 h-4 text-gray-500 transition-transform shrink-0', expanded && 'rotate-180')} />
      </button>

      {/* Result body */}
      <AnimatePresence>
        {expanded && parsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800/50 px-4 py-3">
              {parsed.parsed ? <RichResult data={parsed.parsed} /> : (
                <p className="text-sm text-gray-300">{parsed.raw}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
