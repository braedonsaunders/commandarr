import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  docsUrl?: string;
  value?: string;
}

interface CredentialFormProps {
  fields: CredentialField[];
  values?: Record<string, string>;
  onSave: (values: Record<string, string>) => void;
  onTest?: () => void;
  saving?: boolean;
  testing?: boolean;
  testResult?: { success: boolean; message: string } | null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function CredentialForm({
  fields,
  values: initialValues,
  onSave,
  onTest,
  saving = false,
  testing = false,
  testResult,
}: CredentialFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, string> = { ...initialValues };
    for (const field of fields) {
      if (field.value && !initial[field.key]) {
        initial[field.key] = field.value;
      }
    }
    setValues(initial);
  }, [fields, initialValues]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleReveal = (key: string) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <label
            htmlFor={field.key}
            className="block text-sm font-medium text-gray-300"
          >
            {field.label}
            {field.required && <span className="ml-1 text-red-400">*</span>}
          </label>

          <div className="relative">
            <input
              id={field.key}
              type={
                field.type === 'password' && !revealed[field.key]
                  ? 'password'
                  : field.type === 'number'
                    ? 'number'
                    : 'text'
              }
              required={field.required}
              placeholder={field.placeholder}
              value={values[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              className={cn(
                'flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-gray-100',
                'placeholder:text-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
                field.type === 'password' && 'pr-10',
              )}
            />

            {field.type === 'password' && (
              <button
                type="button"
                onClick={() => toggleReveal(field.key)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {revealed[field.key] ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
              </button>
            )}
          </div>

          {field.helpText && (
            <p className="text-xs text-gray-500">{field.helpText}</p>
          )}

          {field.docsUrl && (
            <a
              href={field.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <ExternalLink size={12} />
              View documentation
            </a>
          )}
        </div>
      ))}

      {/* Test result banner */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                'rounded-lg border p-3 text-sm',
                testResult.success
                  ? 'border-green-500/20 bg-green-500/10 text-green-400'
                  : 'border-red-500/20 bg-red-500/10 text-red-400',
              )}
            >
              {testResult.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={saving}>
          Save Credentials
        </Button>
        {onTest && (
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            loading={testing}
          >
            Test Connection
          </Button>
        )}
      </div>
    </form>
  );
}
