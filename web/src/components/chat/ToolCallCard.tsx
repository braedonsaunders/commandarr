import { useState } from 'react';
import { ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ToolCallData {
  name: string;
  parameters: Record<string, unknown>;
  result?: string;
  error?: boolean;
}

interface ToolCallCardProps {
  toolCall: ToolCallData;
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isError = toolCall.error === true;

  return (
    <div
      className={cn(
        'rounded-lg border bg-slate-900 overflow-hidden',
        isError
          ? 'border-l-4 border-l-red-500 border-slate-800'
          : 'border-l-4 border-l-green-500 border-slate-800',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
      >
        {isError ? (
          <XCircle size={16} className="shrink-0 text-red-400" />
        ) : (
          <CheckCircle2 size={16} className="shrink-0 text-green-400" />
        )}

        <span className="flex-1 text-sm font-mono font-medium text-gray-200">
          {toolCall.name}
        </span>

        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-gray-500 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {/* Expandable body */}
      {expanded && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-3">
          {/* Parameters */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
              Parameters
            </p>
            <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-gray-300 font-mono">
              {JSON.stringify(toolCall.parameters, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {toolCall.result !== undefined && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
                Result
              </p>
              <pre
                className={cn(
                  'overflow-x-auto rounded p-3 text-xs font-mono',
                  isError
                    ? 'bg-red-950/30 text-red-300'
                    : 'bg-slate-950 text-gray-300',
                )}
              >
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
