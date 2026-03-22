import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GripVertical,
  Maximize2,
  Minimize2,
  Trash2,
  Lock,
  Unlock,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { WidgetFrame } from './WidgetFrame';
import {
  GRID_COLUMNS,
  GRID_ROW_HEIGHT_PX,
  GRID_GAP_PX,
  normalizeColumnSpan,
  normalizeRowSpan,
  resolveGridLayout,
} from '@/lib/dashboard-grid';
import type { DashboardGridItem } from '@/lib/dashboard-grid';

// ─── Types ───────────────────────────────────────────────────────────

export interface WidgetPageItem {
  id: string; // page item ID
  widgetId: string;
  title?: string;
  columnStart: number;
  columnSpan: number;
  rowStart: number;
  rowSpan: number;
  sortOrder: number;
  createdAt: string;
  widget: {
    widgetId: string;
    widgetSlug?: string;
    widgetName: string;
    widgetDescription?: string;
    widgetStatus: string;
    capabilities: string[];
  };
  // The actual widget data (html/css/js) loaded separately
  html?: string;
  css?: string;
  js?: string;
  controls?: unknown[];
}

interface WidgetGridProps {
  items: WidgetPageItem[];
  onMoveItem?: (itemId: string, columnStart: number, rowStart: number) => void;
  onResizeItem?: (itemId: string, columnSpan: number, rowSpan: number) => void;
  onRemoveItem?: (itemId: string) => void;
  className?: string;
}

type GestureKind = 'drag' | 'resize';

interface GestureState {
  kind: GestureKind;
  itemId: string;
  startX: number;
  startY: number;
  startColumnStart: number;
  startRowStart: number;
  startColumnSpan: number;
  startRowSpan: number;
  previewColumnStart: number;
  previewRowStart: number;
  previewColumnSpan: number;
  previewRowSpan: number;
}

// ─── Component ───────────────────────────────────────────────────────

export function WidgetGrid({
  items,
  onMoveItem,
  onResizeItem,
  onRemoveItem,
  className,
}: WidgetGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [editMode, setEditMode] = useState(false);
  const [gesture, setGesture] = useState<GestureState | null>(null);
  const [widgetStatuses, setWidgetStatuses] = useState<Record<string, string>>({});
  const [readyWidgets, setReadyWidgets] = useState<Set<string>>(new Set());
  const [fullscreenItemId, setFullscreenItemId] = useState<string | null>(null);

  // Resolve layout with collision detection
  const gridItems: DashboardGridItem[] = items.map((item) => ({
    id: item.id,
    columnStart: item.columnStart,
    columnSpan: item.columnSpan,
    rowStart: item.rowStart,
    rowSpan: item.rowSpan,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
  }));
  const resolvedLayout = resolveGridLayout(gridItems);
  const layoutMap = new Map(resolvedLayout.map((item) => [item.id, item]));

  // Calculate grid height
  const maxRowEnd = resolvedLayout.reduce(
    (max, item) => Math.max(max, item.rowStart + item.rowSpan - 1),
    0,
  );
  const gridHeight = maxRowEnd > 0
    ? maxRowEnd * GRID_ROW_HEIGHT_PX + (maxRowEnd - 1) * GRID_GAP_PX + GRID_GAP_PX
    : 400;

  // ─── Fullscreen escape key ────────────────────────────────────────
  useEffect(() => {
    if (!fullscreenItemId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenItemId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenItemId]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (fullscreenItemId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [fullscreenItemId]);

  // ─── Grid Coordinate Helpers ─────────────────────────────────────

  const getGridPosition = useCallback(
    (clientX: number, clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return { col: 1, row: 1 };

      const rect = grid.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      const colWidth = (rect.width - (GRID_COLUMNS - 1) * GRID_GAP_PX) / GRID_COLUMNS;
      const col = Math.max(1, Math.min(GRID_COLUMNS, Math.floor(relX / (colWidth + GRID_GAP_PX)) + 1));
      const row = Math.max(1, Math.floor(relY / (GRID_ROW_HEIGHT_PX + GRID_GAP_PX)) + 1);

      return { col, row };
    },
    [],
  );

  // ─── Drag Handlers ───────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.PointerEvent, item: WidgetPageItem) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const layout = layoutMap.get(item.id);
      if (!layout) return;

      setGesture({
        kind: 'drag',
        itemId: item.id,
        startX: e.clientX,
        startY: e.clientY,
        startColumnStart: layout.columnStart,
        startRowStart: layout.rowStart,
        startColumnSpan: layout.columnSpan,
        startRowSpan: layout.rowSpan,
        previewColumnStart: layout.columnStart,
        previewRowStart: layout.rowStart,
        previewColumnSpan: layout.columnSpan,
        previewRowSpan: layout.rowSpan,
      });
    },
    [editMode, layoutMap],
  );

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, item: WidgetPageItem) => {
      if (!editMode) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const layout = layoutMap.get(item.id);
      if (!layout) return;

      setGesture({
        kind: 'resize',
        itemId: item.id,
        startX: e.clientX,
        startY: e.clientY,
        startColumnStart: layout.columnStart,
        startRowStart: layout.rowStart,
        startColumnSpan: layout.columnSpan,
        startRowSpan: layout.rowSpan,
        previewColumnStart: layout.columnStart,
        previewRowStart: layout.rowStart,
        previewColumnSpan: layout.columnSpan,
        previewRowSpan: layout.rowSpan,
      });
    },
    [editMode, layoutMap],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!gesture) return;

      if (gesture.kind === 'drag') {
        const { col, row } = getGridPosition(e.clientX, e.clientY);
        const maxCol = GRID_COLUMNS - gesture.startColumnSpan + 1;
        setGesture((prev) =>
          prev
            ? {
                ...prev,
                previewColumnStart: Math.max(1, Math.min(maxCol, col)),
                previewRowStart: Math.max(1, row),
              }
            : null,
        );
      } else if (gesture.kind === 'resize') {
        const grid = gridRef.current;
        if (!grid) return;

        const rect = grid.getBoundingClientRect();
        const colWidth = (rect.width - (GRID_COLUMNS - 1) * GRID_GAP_PX) / GRID_COLUMNS;

        const deltaX = e.clientX - gesture.startX;
        const deltaY = e.clientY - gesture.startY;

        const deltaCols = Math.round(deltaX / (colWidth + GRID_GAP_PX));
        const deltaRows = Math.round(deltaY / (GRID_ROW_HEIGHT_PX + GRID_GAP_PX));

        const newColSpan = normalizeColumnSpan(gesture.startColumnSpan + deltaCols);
        const newRowSpan = normalizeRowSpan(gesture.startRowSpan + deltaRows);

        // Ensure doesn't exceed grid width
        const maxSpan = GRID_COLUMNS - gesture.startColumnStart + 1;
        const clampedColSpan = Math.min(newColSpan, maxSpan);

        setGesture((prev) =>
          prev
            ? { ...prev, previewColumnSpan: clampedColSpan, previewRowSpan: newRowSpan }
            : null,
        );
      }
    },
    [gesture, getGridPosition],
  );

  const handlePointerUp = useCallback(() => {
    if (!gesture) return;

    if (gesture.kind === 'drag') {
      if (
        gesture.previewColumnStart !== gesture.startColumnStart ||
        gesture.previewRowStart !== gesture.startRowStart
      ) {
        onMoveItem?.(gesture.itemId, gesture.previewColumnStart, gesture.previewRowStart);
      }
    } else if (gesture.kind === 'resize') {
      if (
        gesture.previewColumnSpan !== gesture.startColumnSpan ||
        gesture.previewRowSpan !== gesture.startRowSpan
      ) {
        onResizeItem?.(gesture.itemId, gesture.previewColumnSpan, gesture.previewRowSpan);
      }
    }

    setGesture(null);
  }, [gesture, onMoveItem, onResizeItem]);

  // ─── Fullscreen Overlay ───────────────────────────────────────────

  const fullscreenItem = fullscreenItemId
    ? items.find((item) => item.id === fullscreenItemId)
    : null;

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-3', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            editMode
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-slate-800 text-gray-400 hover:text-gray-300 border border-slate-700',
          )}
        >
          {editMode ? <Unlock size={14} /> : <Lock size={14} />}
          {editMode ? 'Done Editing' : 'Edit Layout'}
        </button>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="relative"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
          gridAutoRows: `${GRID_ROW_HEIGHT_PX}px`,
          gap: `${GRID_GAP_PX}px`,
          minHeight: gridHeight,
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Grid lines (edit mode) */}
        {editMode && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
              gridAutoRows: `${GRID_ROW_HEIGHT_PX}px`,
              gap: `${GRID_GAP_PX}px`,
            }}
          >
            {Array.from({ length: GRID_COLUMNS * Math.max(maxRowEnd, 4) }).map((_, i) => (
              <div
                key={i}
                className="rounded border border-dashed border-slate-800/50"
              />
            ))}
          </div>
        )}

        {/* Widget Items */}
        {items.map((item) => {
          const layout = layoutMap.get(item.id);
          if (!layout) return null;

          const isGestureTarget = gesture?.itemId === item.id;
          const displayLayout = isGestureTarget
            ? {
                columnStart: gesture!.previewColumnStart,
                columnSpan: gesture!.previewColumnSpan,
                rowStart: gesture!.previewRowStart,
                rowSpan: gesture!.previewRowSpan,
              }
            : layout;

          const status = widgetStatuses[item.id] ?? '';

          return (
            <motion.div
              key={item.id}
              className={cn(
                'relative group',
                isGestureTarget && 'z-20 opacity-90',
                editMode && 'ring-1 ring-slate-700 rounded-lg',
              )}
              style={{
                gridColumn: `${displayLayout.columnStart} / span ${displayLayout.columnSpan}`,
                gridRow: `${displayLayout.rowStart} / span ${displayLayout.rowSpan}`,
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Widget title bar */}
              <div
                className={cn(
                  'flex items-center gap-2 rounded-t-lg border border-b-0 border-slate-800 bg-slate-900/90 px-3 py-1.5',
                  editMode && 'cursor-grab active:cursor-grabbing',
                )}
                onPointerDown={(e) => handleDragStart(e, item)}
              >
                {editMode && (
                  <GripVertical size={14} className="text-gray-600 flex-shrink-0" />
                )}
                <span className="truncate text-xs font-medium text-gray-300">
                  {item.title ?? item.widget.widgetName}
                </span>
                {status && (
                  <span className="ml-auto truncate text-xs text-gray-500">{status}</span>
                )}

                {/* Actions — always visible on hover */}
                <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Fullscreen */}
                  <button
                    onClick={() => setFullscreenItemId(item.id)}
                    className="rounded p-1 text-gray-500 hover:bg-slate-700 hover:text-gray-300 transition-colors"
                    title="Fullscreen"
                  >
                    <Maximize2 size={12} />
                  </button>

                  {/* Remove (edit mode only) */}
                  {onRemoveItem && editMode && (
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="rounded p-1 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="Remove from dashboard"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Widget content */}
              <div className="h-[calc(100%-32px)]">
                <WidgetFrame
                  widgetId={item.widgetId}
                  html={item.html ?? ''}
                  css={item.css}
                  js={item.js}
                  title={item.title ?? item.widget.widgetName}
                  capabilities={item.widget.capabilities}
                  controls={item.controls}
                  className="h-full rounded-t-none"
                  pointerEventsDisabled={editMode}
                  onReady={() => setReadyWidgets((prev) => new Set(prev).add(item.id))}
                  onStatus={(text) =>
                    setWidgetStatuses((prev) => ({ ...prev, [item.id]: text }))
                  }
                />
              </div>

              {/* Resize handle (edit mode) */}
              {editMode && (
                <div
                  className="absolute bottom-0 right-0 z-10 h-6 w-6 cursor-se-resize flex items-end justify-end p-1"
                  onPointerDown={(e) => handleResizeStart(e, item)}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    className="text-gray-600"
                  >
                    <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M9 5v4H5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50 py-16 text-center">
          <p className="text-sm text-gray-500">
            No widgets on this page. Click "Add Widget" to get started.
          </p>
        </div>
      )}

      {/* ─── Fullscreen Overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {fullscreenItem && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Fullscreen title bar */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
              <span className="text-sm font-medium text-gray-200">
                {fullscreenItem.title ?? fullscreenItem.widget.widgetName}
              </span>
              <div className="flex items-center gap-2">
                {widgetStatuses[fullscreenItem.id] && (
                  <span className="text-xs text-gray-500">
                    {widgetStatuses[fullscreenItem.id]}
                  </span>
                )}
                <button
                  onClick={() => setFullscreenItemId(null)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  <Minimize2 size={14} />
                  Exit
                </button>
              </div>
            </div>

            {/* Fullscreen widget content */}
            <div className="flex-1 min-h-0">
              <WidgetFrame
                widgetId={fullscreenItem.widgetId}
                html={fullscreenItem.html ?? ''}
                css={fullscreenItem.css}
                js={fullscreenItem.js}
                title={fullscreenItem.title ?? fullscreenItem.widget.widgetName}
                capabilities={fullscreenItem.widget.capabilities}
                controls={fullscreenItem.controls}
                className="h-full rounded-none border-0"
                onReady={() => setReadyWidgets((prev) => new Set(prev).add(fullscreenItem.id))}
                onStatus={(text) =>
                  setWidgetStatuses((prev) => ({ ...prev, [fullscreenItem.id]: text }))
                }
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
