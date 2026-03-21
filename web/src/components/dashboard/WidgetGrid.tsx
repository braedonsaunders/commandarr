import { Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { WidgetFrame } from './WidgetFrame';
import { Button } from '@/components/ui/Button';

const gridContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const gridItemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export interface WidgetConfig {
  id: string;
  /** Widget display title. Falls back to `name` if not provided. */
  title?: string;
  /** Alias for title used by the backend API. */
  name?: string;
  html: string;
  /** CSS grid column span (default 1) */
  colSpan?: number;
  /** CSS grid row span (default 1) */
  rowSpan?: number;
  /** Allow any additional fields from the API. */
  [key: string]: unknown;
}

interface WidgetGridProps {
  widgets: WidgetConfig[];
  onAddWidget?: () => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function WidgetGrid({
  widgets,
  onAddWidget,
  onDelete,
  className,
}: WidgetGridProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      {onAddWidget && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">Widgets</h2>
          <Button size="sm" onClick={onAddWidget}>
            <Plus size={16} />
            Add Widget
          </Button>
        </div>
      )}

      {/* Grid */}
      <motion.div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        variants={gridContainerVariants}
        initial="hidden"
        animate="show"
      >
        {widgets.map((widget) => {
          const displayTitle = widget.title ?? widget.name;

          return (
            <motion.div
              key={widget.id}
              className="relative group min-h-[280px]"
              variants={gridItemVariants}
              style={{
                gridColumn:
                  widget.colSpan && widget.colSpan > 1
                    ? `span ${widget.colSpan}`
                    : undefined,
                gridRow:
                  widget.rowSpan && widget.rowSpan > 1
                    ? `span ${widget.rowSpan}`
                    : undefined,
              }}
            >
              <WidgetFrame
                html={widget.html}
                title={displayTitle}
                className="h-full"
              />

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(widget.id)}
                  className="absolute right-2 top-2 rounded-lg bg-slate-800/80 p-1.5 text-gray-400 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                  title="Delete widget"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Empty state */}
      {widgets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50 py-16 text-center">
          <p className="mb-4 text-sm text-gray-500">No widgets added yet.</p>
          {onAddWidget && (
            <Button variant="outline" size="sm" onClick={onAddWidget}>
              <Plus size={16} />
              Add Your First Widget
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
