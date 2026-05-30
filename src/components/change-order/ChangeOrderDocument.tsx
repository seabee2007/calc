import React from 'react';
import type { ChangeOrder } from '../../types/changeOrder';
import {
  computeChangeOrderBreakdown,
  formatChangeOrderMoney,
} from '../../utils/changeOrderFinancials';

function DocumentTextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4 min-w-0 max-w-full">
      <p className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-gray-900 dark:text-slate-100">
        {text}
      </p>
    </div>
  );
}

function SignatureDisplay({
  role,
  name,
  signature,
  signedAt,
}: {
  role: string;
  name: string | null;
  signature: string | null;
  signedAt: string | null;
}) {
  const ts = signedAt
    ? new Date(signedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">{role}</p>
      {name?.trim() ? (
        <p className="mt-1 text-sm text-gray-900 dark:text-slate-100">
          <span className="font-medium">Name:</span> {name}
        </p>
      ) : (
        <p className="mt-1 text-sm italic text-gray-400 dark:text-slate-500">Not signed</p>
      )}
      {signature?.startsWith('data:image') ? (
        <img src={signature} alt={`${role} signature`} className="mt-2 max-h-16 object-contain" />
      ) : signature?.trim() ? (
        <p className="mt-2 font-serif text-lg italic text-gray-900 dark:text-white">{signature}</p>
      ) : null}
      {ts && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Signed {ts}</p>}
    </div>
  );
}

function ClientTotalRow({ label, value, grand }: { label: string; value: string; grand?: boolean }) {
  return (
    <div
      className={[
        'flex justify-between gap-4 border-b border-gray-100 py-3 dark:border-gray-800',
        grand ? 'border-t-2 border-gray-300 dark:border-gray-600 pt-4 mt-2 font-bold text-lg' : 'text-sm',
      ].join(' ')}
    >
      <span className={grand ? 'text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-slate-300'}>
        {label}
      </span>
      <span className="tabular-nums text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

export default function ChangeOrderDocument({
  order,
  audience = 'client',
}: {
  order: ChangeOrder;
  audience?: 'client' | 'internal';
}) {
  const breakdown = computeChangeOrderBreakdown(
    order.laborItems,
    order.materialItems,
    order.equipmentItems,
    {
      feesAmount: order.feesAmount,
      permitsAmount: order.permitsAmount,
      overheadPercent: order.overheadPercent,
      profitPercent: order.profitPercent,
      markupPercent: order.markupPercent,
    },
  );

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden p-6 text-gray-900 dark:text-gray-100">
      <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
        {order.displayNumber ?? 'Change Order'}
      </p>
      <h1 className="mt-1 break-words text-2xl font-bold [overflow-wrap:anywhere]">{order.title}</h1>
      {order.scopeDescription.trim() ? (
        <DocumentTextBlock label="Scope of change" text={order.scopeDescription} />
      ) : null}
      {order.reasonForChange.trim() ? (
        <DocumentTextBlock label="Reason for change" text={order.reasonForChange} />
      ) : null}
      {order.scheduleImpact?.trim() ? (
        <DocumentTextBlock label="Schedule impact" text={order.scheduleImpact} />
      ) : null}

      <div className="mt-8">
        {audience === 'client' ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden px-4">
            <ClientTotalRow
              label="Total Direct Costs"
              value={formatChangeOrderMoney(breakdown.directCost)}
            />
            <ClientTotalRow
              label="Total Indirect costs"
              value={formatChangeOrderMoney(breakdown.indirectCost)}
            />
            <ClientTotalRow
              label="Total Change Order"
              value={formatChangeOrderMoney(breakdown.totalPrice)}
              grand
            />
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Direct costs</span>
              <span>{formatChangeOrderMoney(breakdown.directCost)}</span>
            </div>
            <div className="flex justify-between">
              <span>Indirect costs</span>
              <span>{formatChangeOrderMoney(breakdown.indirectCost)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatChangeOrderMoney(breakdown.totalPrice)}</span>
            </div>
          </div>
        )}
      </div>

      {order.terms?.trim() ? (
        <DocumentTextBlock label="Terms" text={order.terms} />
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <SignatureDisplay
          role="Contractor"
          name={order.contractorName}
          signature={order.contractorSignature}
          signedAt={order.contractorSignedAt}
        />
        <SignatureDisplay
          role="Client"
          name={order.clientName}
          signature={order.clientSignature}
          signedAt={order.clientSignedAt}
        />
      </div>
    </div>
  );
}
