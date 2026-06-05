import Card from '../../../../components/ui/Card';
import { PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

import { ESTIMATE_BLANK } from '../estimateFormatters';

interface Props {
  label: string;
  value?: string;
  loading?: boolean;
  /** Highlight key totals such as final sell price. */
  emphasis?: boolean;
}

export default function EstimateSummaryCard({
  label,
  value = ESTIMATE_BLANK,
  loading = false,
  emphasis = false,
}: Props) {
  const valueClass = emphasis
    ? 'mt-2 truncate text-2xl font-bold tabular-nums'
    : 'mt-2 truncate text-lg font-semibold tabular-nums';

  return (
    <Card
      variant="panel"
      shadow="sm"
      className={
        emphasis
          ? 'min-w-0 border-2 border-blue-500/40 bg-blue-50/30 p-4 dark:border-blue-400/40 dark:bg-blue-950/20'
          : 'min-w-0 p-4'
      }
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>{label}</p>
      {loading ? (
        <div
          className={`${emphasis ? 'mt-3 h-8' : 'mt-3 h-6'} w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700`}
        />
      ) : (
        <p className={`${valueClass} ${TEXT_FOREGROUND}`}>{value}</p>
      )}
    </Card>
  );
}
