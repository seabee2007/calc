import Card from '../../../../components/ui/Card';
import { PLANNER_MUTED, TEXT_FOREGROUND } from '../estimateWorkspaceTheme';

interface Props {
  label: string;
  value?: string;
}

export default function EstimateSummaryCard({ label, value = '—' }: Props) {
  return (
    <Card variant="panel" shadow="sm" className="p-4">
      <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>{label}</p>
      <p className={`mt-2 text-lg font-semibold tabular-nums ${TEXT_FOREGROUND}`}>{value}</p>
    </Card>
  );
}
