import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../components/layout/Layout';
import { Puzzle, Plus, Trash2, Sparkles } from 'lucide-react';

const widgetContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const widgetCardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3 } },
};

interface Widget {
  id: string;
  name: string;
  description: string | null;
  html: string;
  prompt: string | null;
  createdAt: string;
}

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ name: '', prompt: '' });
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/widgets')
      .then(r => r.json())
      .then(data => { setWidgets(data); setLoading(false); })
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
      setPreview(data.html);
    } catch {
      alert('Failed to generate widget');
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!form.prompt) return;
    try {
      const res = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: form.prompt, name: form.name || 'Widget' }),
      });
      const data = await res.json();
      setWidgets(prev => [...prev, data]);
      setShowCreate(false);
      setForm({ name: '', prompt: '' });
      setPreview(null);
    } catch {
      alert('Failed to save widget');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this widget?')) return;
    await fetch(`/api/widgets/${id}`, { method: 'DELETE' });
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  return (
    <Layout pageTitle="Widgets">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Widgets</h1>
            <p className="text-sm text-gray-400 mt-1">AI-generated dashboard widgets</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Widget
          </button>
        </div>

        <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
          <div className="p-6 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-semibold text-gray-100">AI Widget Generator</h2>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Widget Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="My Widget"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Describe your widget</label>
              <textarea
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                placeholder="e.g., Show my Plex library sizes as a bar chart"
                rows={3}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleGenerate} disabled={generating || !form.prompt} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-gray-200 rounded-lg transition-colors disabled:opacity-50">
                {generating ? 'Generating...' : 'Preview'}
              </button>
              <button onClick={handleSave} disabled={!form.prompt} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors disabled:opacity-50">
                Save Widget
              </button>
              <button onClick={() => { setShowCreate(false); setPreview(null); }} className="px-4 py-2 text-gray-400 hover:text-gray-200">Cancel</button>
            </div>
            {preview && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Preview</h3>
                <div className="border border-slate-700 rounded-lg overflow-hidden" style={{ height: 300 }}>
                  <iframe srcDoc={preview} className="w-full h-full border-0" sandbox="allow-scripts" />
                </div>
              </div>
            )}
          </div>
          </motion.div>
        )}
        </AnimatePresence>

        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading widgets...</div>
        ) : widgets.length === 0 && !showCreate ? (
          <div className="text-center py-20">
            <Puzzle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No widgets yet</p>
            <p className="text-gray-500 text-sm">Create AI-powered widgets for your dashboard</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={widgetContainerVariants}
            initial="hidden"
            animate="show"
          >
            {widgets.map(widget => (
              <motion.div
                key={widget.id}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden group"
                variants={widgetCardVariants}
                whileHover={{ scale: 1.02 }}
              >
                <div className="h-48 border-b border-slate-800">
                  <iframe srcDoc={widget.html} className="w-full h-full border-0 pointer-events-none" sandbox="allow-scripts" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-100">{widget.name}</h3>
                      {widget.description && <p className="text-xs text-gray-400 mt-0.5">{widget.description}</p>}
                    </div>
                    <button onClick={() => handleDelete(widget.id)} className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{widget.createdAt ? new Date(widget.createdAt).toLocaleDateString() : ''}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
