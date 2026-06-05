import {
  PLANNER_MUTED,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_WRAPPER,
} from '../estimateWorkspaceTheme';

const COLUMNS = [
  'CSI Division',
  'Scope',
  'Task',
  'Quantity',
  'Unit',
  'Labor Hours',
  'Total',
] as const;

export default function EstimateLineItemsPlaceholder() {
  return (
    <div className="space-y-3">
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
            <tr>
              <td
                colSpan={COLUMNS.length}
                className={`px-4 py-8 text-center text-sm ${PLANNER_MUTED}`}
              >
                Line items will appear here after estimate creation is enabled.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={`text-xs ${PLANNER_MUTED}`}>
        Columns support CSI division, scope, task detail, quantities, labor hours, and line totals.
      </p>
    </div>
  );
}
