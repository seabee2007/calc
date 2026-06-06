import { useCallback } from 'react';
import { PLANNER_MUTED } from '../estimateWorkspaceTheme';

interface Props {
  code?: string;
  className?: string;
}

export default function EstimateActivityCodeLabel({ code, className = '' }: Props) {
  const trimmed = code?.trim();
  const handleCopy = useCallback(async () => {
    if (!trimmed || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(trimmed);
    } catch {
      // Clipboard unavailable; ignore.
    }
  }, [trimmed]);

  if (!trimmed) return null;

  return (
    <button
      type="button"
      className={`mr-2 inline-flex shrink-0 font-mono text-xs tabular-nums ${PLANNER_MUTED} hover:text-cyan-700 dark:hover:text-cyan-300 ${className}`}
      title={`Copy activity code ${trimmed}`}
      onClick={handleCopy}
    >
      {trimmed}
    </button>
  );
}
