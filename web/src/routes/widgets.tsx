import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Puzzle, Plus, Trash2, Sparkles, RefreshCw, Power, PowerOff, Clock, Zap } from 'lucide-react';
import { WidgetFrame } from '../components/dashboard/WidgetFrame';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

// ─── Types ───────────────────────────────────────────────────────────

interface Widget {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  html: string;
  css: string;
  js: string;
  capabilities: string[];
  controls: WidgetControl[];
  prompt: string | null;
  revision: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface WidgetControl {
  id: string;
  label: string;
  description?: string;
  kind: string;
  parameters: unknown[];
  execution: { kind: string };
  danger?: boolean;
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
};

// ─── Component ───────────────────────────────────────────────────────

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ name: '', prompt: '' });
  const [preview, setPreview] = useState<{ html: string; css: string; js: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/widgets')
      .then((r) => r.json())
      .then((data) => {
        setWidgets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    if (!form.prompt) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/widgets/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: form.prompt }),
      });
      const data = await res.json();
      setPreview({ html: data.html || '', css: data.css || '', js: data.js || '' });
    } catch {
      alert('Failed to generate widget');
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!form.prompt) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: form.prompt, name: form.name || 'Widget' }),
      });
      const data = await res.json();
      if (data.id) {
        // Reload full list
        const all = await fetch('/api/widgets').then((r) => r.json());
        setWidgets(all);
      }
      setShowCreate(false);
      setForm({ name: '', prompt: '' });
      setPreview(null);
    } catch {
      alert('Failed to save widget');
    }
    setGenerating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this widget? It will also be removed from all dashboard pages.')) return;
    await fetch(`/api/widgets/${id}`, { method: 'DELETE' });
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const handleToggleStatus = async (widget: Widget) => {
    const newStatus = widget.status === 'active' ? 'disabled' : 'active';
    await fetch(`/api/widgets/${widget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setWidgets((prev) =>
      prev.map((w) => (w.id === widget.id ? { ...w, status: newStatus } : w)),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Widgets</h1>
          <p className="mt-1 text-sm text-gray-400">AI-generated dashboard widgets</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} />
          Create Widget
        </Button>
      </div>

      {/* Create widget panel */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-gray-100">
                  AI Widget Generator
                </h2>
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-300">
                  Widget Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="My Widget"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-300">
                  Describe your widget
                </label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
                  placeholder="e.g., Show my Plex library sizes as a bar chart with download queue status"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={generating || !form.prompt}
                >
                  {generating ? 'Generating...' : 'Preview'}
                </Button>
                <Button onClick={handleSave} disabled={generating || !form.prompt}>
                  {generating ? 'Saving...' : 'Save Widget'}
                </Button>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setPreview(null);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>

              {/* Preview */}
              {preview && (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-medium text-gray-300">
                    Preview
                  </h3>
                  <div
                    className="overflow-hidden rounded-lg border border-slate-700"
                    style={{ height: 300 }}
                  >
                    <WidgetFrame
                      widgetId="preview"
                      html={preview.html}
                      css={preview.css}
                      js={preview.js}
                      className="h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget list */}
      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading widgets...</div>
      ) : widgets.length === 0 && !showCreate ? (
        <div className="py-20 text-center">
          <Puzzle className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <p className="text-gray-400">No widgets yet</p>
          <p className="text-sm text-gray-500">
            Create AI-powered widgets for your dashboard
          </p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {widgets.map((widget) => (
            <motion.div
              key={widget.id}
              className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
              variants={cardVariants}
            >
              {/* Preview */}
              <div className="h-48 border-b border-slate-800">
                <WidgetFrame
                  widgetId={widget.id}
                  html={widget.html}
                  css={widget.css ?? ''}
                  js={widget.js ?? ''}
                  capabilities={widget.capabilities}
                  controls={widget.controls}
                  className="h-full"
                  pointerEventsDisabled
                />
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium text-gray-100">
                        {widget.name}
                      </h3>
                      <Badge
                        variant={widget.status === 'active' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {widget.status}
                      </Badge>
                    </div>
                    {widget.description && (
                      <p className="mt-0.5 truncate text-xs text-gray-400">
                        {widget.description}
                      </p>
                    )}
                  </div>

                  <div className="ml-2 flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(widget)}
                      className="rounded p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
                      title={widget.status === 'active' ? 'Disable' : 'Enable'}
                    >
                      {widget.status === 'active' ? (
                        <Power size={14} />
                      ) : (
                        <PowerOff size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(widget.id)}
                      className="rounded p-1.5 text-gray-500 opacity-0 hover:text-red-400 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Zap size={10} />
                    Rev {widget.revision ?? 1}
                  </span>
                  {widget.capabilities?.length > 0 && (
                    <span>
                      {widget.capabilities.join(', ')}
                    </span>
                  )}
                  {widget.controls?.length > 0 && (
                    <span>
                      {widget.controls.length} control{widget.controls.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Expandable details */}
                <button
                  onClick={() =>
                    setExpandedId(expandedId === widget.id ? null : widget.id)
                  }
                  className="mt-2 text-xs text-amber-500 hover:text-amber-400"
                >
                  {expandedId === widget.id ? 'Hide details' : 'Show details'}
                </button>

                <AnimatePresence>
                  {expandedId === widget.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                        {widget.prompt && (
                          <div>
                            <div className="text-xs font-medium text-gray-400">
                              Prompt
                            </div>
                            <p className="text-xs text-gray-500">{widget.prompt}</p>
                          </div>
                        )}

                        {widget.controls?.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-400">
                              Controls
                            </div>
                            <div className="mt-1 space-y-1">
                              {widget.controls.map((ctrl) => (
                                <div
                                  key={ctrl.id}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-gray-400">
                                    {ctrl.kind}
                                  </span>
                                  <span className="text-gray-300">{ctrl.label}</span>
                                  {ctrl.danger && (
                                    <span className="text-red-400">danger</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-600">
                          Created{' '}
                          {widget.createdAt
                            ? new Date(widget.createdAt).toLocaleDateString()
                            : 'Unknown'}
                          {widget.createdBy && ` by ${widget.createdBy}`}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
