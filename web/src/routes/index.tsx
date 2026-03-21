import React, { useState, useEffect } from 'react';
import { Layout } from '../components/layout/Layout';
import { WidgetGrid } from '../components/dashboard/WidgetGrid';

interface Widget {
  id: string;
  name: string;
  description: string | null;
  html: string;
  position: { x: number; y: number; w: number; h: number } | null;
  refreshInterval: number | null;
}

export default function DashboardPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/widgets')
      .then(r => r.json())
      .then(data => { setWidgets(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleAddWidget = () => {
    const prompt = window.prompt('Describe the widget you want to create:');
    if (!prompt) return;
    const name = window.prompt('Widget name:', 'My Widget') || 'My Widget';

    fetch('/api/widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, name }),
    })
      .then(r => r.json())
      .then(w => setWidgets(prev => [...prev, w]))
      .catch(e => alert('Failed to generate widget: ' + e.message));
  };

  const handleDeleteWidget = (id: string) => {
    fetch(`/api/widgets/${id}`, { method: 'DELETE' })
      .then(() => setWidgets(prev => prev.filter(w => w.id !== id)))
      .catch(() => {});
  };

  return (
    <Layout pageTitle="Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Your media stack at a glance</p>
          </div>
          <button
            onClick={handleAddWidget}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
          >
            + Add Widget
          </button>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-20">Loading widgets...</div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-500 text-lg mb-2">No widgets yet</div>
            <p className="text-gray-600 text-sm mb-4">
              Add widgets to monitor your media stack
            </p>
            <button
              onClick={handleAddWidget}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
            >
              Create Your First Widget
            </button>
          </div>
        ) : (
          <WidgetGrid
            widgets={widgets.map(w => ({ id: w.id, title: w.name, html: w.html }))}
            onAddWidget={handleAddWidget}
          />
        )}
      </div>
    </Layout>
  );
}
