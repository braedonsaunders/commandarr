import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

type Status = 'healthy' | 'unhealthy' | 'unknown' | 'unconfigured' | 'disabled';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { dot: string; label: string }> = {
  healthy: { dot: 'bg-green-500', label: 'Healthy' },
  unhealthy: { dot: 'bg-red-500', label: 'Unhealthy' },
  unknown: { dot: 'bg-gray-500', label: 'Unknown' },
  unconfigured: { dot: 'bg-yellow-500', label: 'Unconfigured' },
  disabled: { dot: 'bg-gray-500', label: 'Disabled' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status];

  return (
    <div className={cn('inline-flex items-center gap-2 text-sm', className)}>
      {status === 'healthy' ? (
        <motion.span
          className={cn('h-2.5 w-2.5 rounded-full shadow-sm', cfg.dot)}
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <span
          className={cn('h-2.5 w-2.5 rounded-full shadow-sm', cfg.dot)}
        />
      )}
      <span className="text-gray-400">{cfg.label}</span>
    </div>
  );
}
