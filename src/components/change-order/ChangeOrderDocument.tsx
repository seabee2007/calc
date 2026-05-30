import React from 'react';
import type { ChangeOrder } from '../../types/changeOrder';

function LineTable({
  title,
  items,
}: {
  title: string;
  items: ChangeOrder['laborItems'];
}) {
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
            <th className="py-1 pr-2">Description</th>
            <th className="py-1 pr-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1.5 pr-2">{row.description || '—'}</td>
              <td className="py-1.5 text-right">
                ${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChangeOrderDocument({ order }: { order: ChangeOrder }) {
  return (
    <div className="p-6 text-gray-900 dark:text-gray-100">
      <p className="text-xs uppercase tracking-wide text-cyan-700 dark:text-cyan-400">
        {order.displayNumber ?? 'Change Order'}
      </p>
      <h1 className="text-2xl font-bold mt-1">{order.title}</h1>
      <p className="mt-4 text-sm whitespace-pre-wrap">{order.scopeDescription}</p>
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase">Reason for change</p>
        <p className="text-sm mt-1">{order.reasonForChange}</p>
      </div>
      {order.scheduleImpact && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase">Schedule impact</p>
          <p className="text-sm mt-1">{order.scheduleImpact}</p>
        </div>
      )}
      <div className="mt-6">
        <LineTable title="Labor" items={order.laborItems} />
        <LineTable title="Material" items={order.materialItems} />
        <LineTable title="Equipment" items={order.equipmentItems} />
      </div>
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${order.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        {order.markupPercent > 0 && (
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Markup ({order.markupPercent}%)</span>
            <span>
              $
              {(
                order.total - order.subtotal
              ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
      {order.terms && (
        <div className="mt-6">
          <p className="text-xs font-semibold text-gray-500 uppercase">Terms</p>
          <p className="text-sm mt-1 whitespace-pre-wrap">{order.terms}</p>
        </div>
      )}
    </div>
  );
}
