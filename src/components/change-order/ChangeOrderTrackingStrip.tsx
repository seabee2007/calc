import React from 'react';
import type { ChangeOrder, ChangeOrderStatus } from '../../types/changeOrder';
import FieldRecordStatusBadge from '../field/FieldRecordStatusBadge';

const STATUS_LABEL: Record<ChangeOrderStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  declined: 'Declined',
  void: 'Void',
};

function formatTs(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function ChangeOrderTrackingStrip({
  order,
  onRefresh,
  refreshing,
}: {
  order: ChangeOrder;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const rows: { label: string; value: string }[] = [];
  const sent = formatTs(order.sentAt);
  const viewed = formatTs(order.viewedAt ?? order.openedAt);
  const accepted = formatTs(order.acceptedAt);
  const declined = formatTs(order.declinedAt);

  if (sent) rows.push({ label: 'Sent', value: sent });
  if (viewed) rows.push({ label: 'Opened', value: viewed });
  if (accepted) rows.push({ label: 'Accepted', value: accepted });
  if (declined) rows.push({ label: 'Declined', value: declined });

  if (order.status === 'draft' && rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">
            Client tracking
          </span>
          <FieldRecordStatusBadge status={STATUS_LABEL[order.status] ?? order.status} />
        </div>
        {onRefresh && order.status !== 'draft' && order.status !== 'accepted' && order.status !== 'declined' && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="text-xs font-medium text-cyan-700 hover:underline disabled:opacity-50 dark:text-cyan-400"
          >
            {refreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
        )}
      </div>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-slate-400">
          {rows.map((r) => (
            <li key={r.label}>
              <span className="font-medium text-gray-700 dark:text-slate-300">{r.label}:</span>{' '}
              {r.value}
            </li>
          ))}
        </ul>
      )}
      {order.status === 'sent' && rows.length <= 1 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-500">
          Waiting for client to open the link.
        </p>
      )}
    </div>
  );
}
