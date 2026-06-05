import type { EstimateScheduleDatePlanSummary } from '../estimateScheduleDisplay';
import EstimateSummaryCard from './EstimateSummaryCard';

interface Props {
  summary: EstimateScheduleDatePlanSummary;
  loading?: boolean;
}

const SUMMARY_CARDS = [
  { key: 'plannedProjectStartDisplay', label: 'Planned project start' },
  { key: 'plannedProjectFinishDisplay', label: 'Planned project finish' },
  { key: 'totalPlannedDurationDaysDisplay', label: 'Total planned duration' },
  { key: 'scheduledTaskCountDisplay', label: 'Scheduled tasks' },
  { key: 'excludedTaskCountDisplay', label: 'Excluded tasks' },
] as const;

export default function EstimateSchedulePlanSummary({ summary, loading = false }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {SUMMARY_CARDS.map((card) => (
        <EstimateSummaryCard
          key={card.key}
          label={card.label}
          value={summary[card.key]}
          loading={loading}
        />
      ))}
    </div>
  );
}
