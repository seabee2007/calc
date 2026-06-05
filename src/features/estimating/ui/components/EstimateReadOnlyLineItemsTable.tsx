import type { EstimateDomainTask } from '../../infrastructure/estimateDbTypes';
import {
  formatEstimateBlank,
  formatEstimateCurrency,
  formatEstimateHours,
  formatEstimateNumber,
  laborHoursFromTask,
  lineDirectCostFromTask,
  unitFromTask,
} from '../estimateFormatters';
import {
  PLANNER_MUTED,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_ROW,
  PLANNER_TABLE_WRAPPER,
  TEXT_FOREGROUND,
} from '../estimateWorkspaceTheme';

interface Props {
  lineItems: EstimateDomainTask[];
  emptyMessage?: string;
  caption?: string;
}

const COLUMNS = [
  'CSI Division',
  'Scope',
  'Task',
  'Quantity',
  'Unit',
  'Labor Hours',
  'Total',
] as const;

export default function EstimateReadOnlyLineItemsTable({
  lineItems,
  emptyMessage = 'No line items in this version.',
  caption,
}: Props) {
  return (
    <div className="space-y-2">
      {caption ? (
        <p className={`text-xs font-semibold uppercase tracking-wide ${PLANNER_MUTED}`}>{caption}</p>
      ) : null}
      <div className={PLANNER_TABLE_WRAPPER}>
      <table className={PLANNER_TABLE}>
        <thead className={PLANNER_TABLE_HEAD}>
          <tr>
            {COLUMNS.map((col) => (
              <th key={col} className="px-4 py-3 font-semibold whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineItems.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className={`px-4 py-8 text-center text-sm ${PLANNER_MUTED}`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            lineItems.map((task) => (
              <tr key={task.id} className={PLANNER_TABLE_ROW}>
                <td className={`px-4 py-3 whitespace-nowrap ${TEXT_FOREGROUND}`}>
                  {formatEstimateBlank(task.lineItem.csiDivision)}
                </td>
                <td className={`px-4 py-3 ${TEXT_FOREGROUND}`}>
                  {formatEstimateBlank(task.scopeName)}
                </td>
                <td className={`px-4 py-3 font-medium ${TEXT_FOREGROUND}`}>
                  {formatEstimateBlank(task.title || task.lineItem.description)}
                </td>
                <td className={`px-4 py-3 tabular-nums ${TEXT_FOREGROUND}`}>
                  {formatEstimateNumber(task.lineItem.quantity.quantity, { decimals: 2 })}
                </td>
                <td className={`px-4 py-3 ${PLANNER_MUTED}`}>
                  {formatEstimateBlank(unitFromTask(task))}
                </td>
                <td className={`px-4 py-3 tabular-nums ${TEXT_FOREGROUND}`}>
                  {formatEstimateHours(laborHoursFromTask(task))}
                </td>
                <td className={`px-4 py-3 tabular-nums font-medium ${TEXT_FOREGROUND}`}>
                  {formatEstimateCurrency(lineDirectCostFromTask(task))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
