import React from 'react';
import {
  BORDER_DEFAULT,
  PLANNER_TABLE,
  PLANNER_TABLE_HEAD,
  PLANNER_TABLE_ROW,
  PLANNER_TABLE_WRAPPER,
  SURFACE_MUTED,
  TEXT_MUTED,
} from '../../theme/appTheme';
import EmptyState from './EmptyState';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: EmptyStateProps['action'];
  className?: string;
}

type EmptyStateProps = React.ComponentProps<typeof EmptyState>;

function TableSkeleton({ colCount }: { colCount: number }) {
  return (
    <tbody>
      {[1, 2, 3].map((row) => (
        <tr key={row} className={PLANNER_TABLE_ROW}>
          {Array.from({ length: colCount }).map((_, i) => (
            <td key={i} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function DataTableInner<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction,
  className = '',
}: DataTableProps<T>) {
  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={`${PLANNER_TABLE_WRAPPER} ${className}`}>
      <table className={PLANNER_TABLE}>
        <thead className={PLANNER_TABLE_HEAD}>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 font-medium ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        {loading ? (
          <TableSkeleton colCount={columns.length} />
        ) : (
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={`${PLANNER_TABLE_ROW} transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 ${TEXT_MUTED} ${col.className ?? ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

const DataTable = DataTableInner as typeof DataTableInner;

export default DataTable;
