import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle } from 'lucide-react';

export const ESTIMATE_WORKSPACE_TOAST_DURATION_MS = 2500;

export type EstimateWorkspaceToastVariant = 'success' | 'error';

const TOAST_VARIANT_CLASS: Record<EstimateWorkspaceToastVariant, string> = {
  success:
    'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/90 dark:text-green-200',
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/90 dark:text-red-200',
};

interface Props {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  variant?: EstimateWorkspaceToastVariant;
  zIndexClass?: string;
}

export default function EstimateWorkspaceToast({
  message,
  onDismiss,
  durationMs = ESTIMATE_WORKSPACE_TOAST_DURATION_MS,
  variant = 'success',
  zIndexClass = 'z-[100]',
}: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  const Icon = variant === 'error' ? AlertCircle : CheckCircle;

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className={`pointer-events-none fixed bottom-6 right-6 ${zIndexClass} flex max-w-xs items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium shadow-lg ${TOAST_VARIANT_CLASS[variant]}`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{message}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
