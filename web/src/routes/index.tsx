import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Layout, Trash2, ChevronDown, Sparkles, Package } from 'lucide-react';
import { WidgetGrid } from '../components/dashboard/WidgetGrid';
import type { WidgetPageItem } from '../components/dashboard/WidgetGrid';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

// ─── Types ───────────────────────────────────────────────────────────

interface DashboardPage {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  items: DashboardPageItemRaw[];
}

interface DashboardPageItemRaw {
  id: string;
  pageId: string;
  widgetId: string;
  title: string | null;
  columnStart: number;
  columnSpan: number;
  rowStart: number;
  rowSpan: number;
  sortOrder: number;
  createdAt: string;
  widget: {
    widgetId: string;
    widgetSlug: string;
    widgetName: string;
    widgetDescription?: string;
    widgetStatus: string;
    widgetRevision: number;
    capabilities: string[];
    updatedAt: string;
  };
}

interface WidgetInventoryEntry {
  widgetId: string;
  widgetSlug: string;
  widgetName: string;
  widgetDescription?: string;
  widgetStatus: string;
  capabilities: string[];
}

interface WidgetDetail {
  id: string;
  html: string;
  css: string;
  js: string;
  controls: unknown[];
  capabilities: string[];
}

// ─── Dashboard Page ──────────────────────────────────────────────────

export default function DashboardPage() {
  const [pages, setPages] = useState<DashboardPage[]>([]);
  const [inventory, setInventory] = useState<WidgetInventoryEntry[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [widgetDetails, setWidgetDetails] = useState<Map<string, WidgetDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [newPageName, setNewPageName] = useState('');

  // ─── Data Loading ────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/widgets');
      const data = await res.json();
      setPages(data.pages ?? []);
      setInventory(data.inventory ?? []);

      if (!activePageId && data.pages?.length > 0) {
        setActivePageId(data.pages[0].id);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [activePageId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load widget details for active page items
  const activePage = pages.find((p) => p.id === activePageId);

  useEffect(() => {
    if (!activePage) return;

    const missing = activePage.items.filter(
      (item) => !widgetDetails.has(item.widgetId),
    );

    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (item) => {
        try {
          const res = await fetch(`/api/widgets/${item.widgetId}`);
          const data = await res.json();
          return data as WidgetDetail;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      setWidgetDetails((prev) => {
        const next = new Map(prev);
        results.forEach((r) => {
          if (r) next.set(r.id, r);
        });
        return next;
      });
    });
  }, [activePage, widgetDetails]);

  // ─── Actions ─────────────────────────────────────────────────────

  const handleCreatePage = async () => {
    if (!newPageName.trim()) return;
    try {
      const res = await fetch('/api/dashboard/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPageName }),
      });
      const data = await res.json();
      setPages((prev) => [...prev, data.page]);
      setActivePageId(data.page.id);
      setShowCreatePage(false);
      setNewPageName('');
    } catch {}
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Delete this dashboard page and all its widget placements?')) return;
    await fetch(`/api/dashboard/widgets/pages/${pageId}`, { method: 'DELETE' });
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    if (activePageId === pageId) {
      setActivePageId(pages.find((p) => p.id !== pageId)?.id ?? null);
    }
  };

  const handleAddWidget = async (widgetId: string) => {
    if (!activePageId) return;
    try {
      await fetch(`/api/dashboard/widgets/pages/${activePageId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetId }),
      });
      await loadDashboard();
      setShowInventory(false);
    } catch {}
  };

  const handleMoveItem = async (itemId: string, columnStart: number, rowStart: number) => {
    await fetch(`/api/dashboard/widgets/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnStart, rowStart }),
    });
    await loadDashboard();
  };

  const handleResizeItem = async (itemId: string, columnSpan: number, rowSpan: number) => {
    await fetch(`/api/dashboard/widgets/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnSpan, rowSpan }),
    });
    await loadDashboard();
  };

  const handleRemoveItem = async (itemId: string) => {
    await fetch(`/api/dashboard/widgets/items/${itemId}`, { method: 'DELETE' });
    await loadDashboard();
  };

  // ─── Prepare widget items for grid ───────────────────────────────

  const gridItems: WidgetPageItem[] = (activePage?.items ?? []).map((item) => {
    const detail = widgetDetails.get(item.widgetId);
    return {
      id: item.id,
      widgetId: item.widgetId,
      title: item.title ?? undefined,
      columnStart: item.columnStart,
      columnSpan: item.columnSpan,
      rowStart: item.rowStart,
      rowSpan: item.rowSpan,
      sortOrder: item.sortOrder,
      createdAt: item.createdAt,
      widget: item.widget,
      html: detail?.html,
      css: detail?.css ?? '',
      js: detail?.js ?? '',
      controls: detail?.controls ?? [],
    };
  });

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Page tabs + action buttons */}
      <div className="flex items-center border-b border-slate-800 pb-1">
        {pages.length > 0 && (
          <div className="flex items-center gap-1">
            {pages.map((page) => (
              <div key={page.id} className="group flex items-center">
                <button
                  onClick={() => setActivePageId(page.id)}
                  className={cn(
                    'rounded-t-lg px-4 py-1.5 text-sm font-medium transition-colors',
                    activePageId === page.id
                      ? 'bg-slate-800 text-gray-100'
                      : 'text-gray-500 hover:text-gray-300',
                  )}
                >
                  {page.name}
                  <span className="ml-1.5 text-xs text-gray-600">
                    ({(page.items ?? []).length})
                  </span>
                </button>
                {pages.length > 1 && (
                  <button
                    onClick={() => handleDeletePage(page.id)}
                    className="p-1 text-gray-600 opacity-0 hover:text-red-400 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowInventory(!showInventory)}
          >
            <Plus size={16} />
            Add Widget
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreatePage(!showCreatePage)}
          >
            <Layout size={16} />
            New Page
          </Button>
        </div>
      </div>

      {/* Create page form */}
      <AnimatePresence>
        {showCreatePage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
              <input
                value={newPageName}
                onChange={(e) => setNewPageName(e.target.value)}
                placeholder="Page name..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-amber-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePage()}
                autoFocus
              />
              <Button size="sm" onClick={handleCreatePage}>
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCreatePage(false);
                  setNewPageName('');
                }}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Widget inventory panel */}
      <AnimatePresence>
        {showInventory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-200">
                <Package size={16} />
                Available Widgets
              </h3>
              {inventory.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No widgets available. Go to the Widgets page to create some.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {inventory.map((w) => {
                    const alreadyOnPage = activePage?.items.some(
                      (item) => item.widgetId === w.widgetId,
                    );
                    return (
                      <button
                        key={w.widgetId}
                        onClick={() => handleAddWidget(w.widgetId)}
                        disabled={alreadyOnPage || !activePageId}
                        className={cn(
                          'rounded-lg border border-slate-700 p-3 text-left transition-colors',
                          alreadyOnPage
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:border-amber-500/50 hover:bg-slate-800',
                        )}
                      >
                        <div className="text-sm font-medium text-gray-200">
                          {w.widgetName}
                        </div>
                        {w.widgetDescription && (
                          <div className="mt-0.5 truncate text-xs text-gray-500">
                            {w.widgetDescription}
                          </div>
                        )}
                        {alreadyOnPage && (
                          <div className="mt-1 text-xs text-amber-500">Already on page</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-create default page if none exist */}
      {pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50 py-20 text-center">
          <Layout className="mb-3 h-10 w-10 text-gray-600" />
          <p className="mb-2 text-gray-400">No dashboard pages yet</p>
          <p className="mb-4 text-sm text-gray-500">
            Create a page and add widgets to build your dashboard
          </p>
          <Button
            onClick={() => {
              setNewPageName('Main Dashboard');
              setShowCreatePage(true);
            }}
          >
            <Plus size={16} />
            Create Dashboard Page
          </Button>
        </div>
      ) : (
        /* Widget Grid */
        <WidgetGrid
          items={gridItems}
          onMoveItem={handleMoveItem}
          onResizeItem={handleResizeItem}
          onRemoveItem={handleRemoveItem}
        />
      )}
    </div>
  );
}
