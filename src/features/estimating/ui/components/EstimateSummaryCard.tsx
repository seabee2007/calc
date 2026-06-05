import Card from '../../../../components/ui/Card';
import { PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

import { ESTIMATE_BLANK } from '../estimateFormatters';

interface Props {
  label: string;
  value?: string;
  loading?: boolean;
}

export default function EstimateSummaryCard({
  label,
  value = ESTIMATE_BLANK,
  loading = false,
}: Props) {
  return (
    <Card variant="panel" shadow="sm" className="min-w-0 p-4">
      <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>{label}</p>
      {loading ? (
        <div className="mt-3 h-6 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      ) : (
        <p className={`mt-2 truncate text-lg font-semibold tabular-nums ${TEXT_FOREGROUND}`}>
          {value}
        </p>
      )}
    </Card>
  );
}
