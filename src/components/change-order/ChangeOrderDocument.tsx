import React from 'react';
import type { ChangeOrder, ChangeOrderLineItem, ChangeOrderLineItemCategory } from '../../types/changeOrder';
import {
  computePricingBreakdown,
  formatChangeOrderMoney,
  sumCategoryCost,
} from '../../utils/changeOrderFinancials';
import {
  CHANGE_ORDER_APPROVAL_STATEMENT,
  CHANGE_ORDER_STATUS_LABELS,
  type ChangeOrderDocumentContext,
} from '../../utils/changeOrderDocumentContext';
import { pricingParamsFromChangeOrder } from '../../utils/pricingParams';

function DocumentTextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-4 min-w-0 max-w-full">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere] text-gray-900 dark:text-slate-100">
        {text}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-2 last:border-0 dark:border-gray-800 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 sm:w-36">
        {label}
      </span>
      <span className="min-w-0 break-words text-sm text-gray-900 dark:text-slate-100">{value}</span>
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
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {role}
      </p>
      {name?.trim() ? (
        <p className="mt-2 text-sm text-gray-900 dark:text-slate-100">
          <span className="font-medium">Printed name:</span> {name}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-gray-400 dark:text-slate-500">Not signed</p>
      )}
      <div className="mt-3 min-h-[3rem] border-b border-gray-300 dark:border-gray-600">
        {signature?.startsWith('data:image') ? (
          <img src={signature} alt={`${role} signature`} className="max-h-16 object-contain" />
        ) : signature?.trim() ? (
          <p className="font-serif text-lg italic text-gray-900 dark:text-white">{signature}</p>
        ) : (
          <p className="text-xs text-gray-400 dark:text-slate-500">Signature</p>
        )}
      </div>
      {ts && <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Signed {ts}</p>}
    </div>
  );
}

function ClientTotalRow({
  label,
  value,
  grand,
}: {
  label: string;
  value: string;
  grand?: boolean;
}) {
  return (
    <div
      className={[
        'flex justify-between gap-4 border-b border-gray-100 py-3 dark:border-gray-800',
        grand
          ? 'mt-2 border-t-2 border-gray-300 pt-4 text-lg font-bold dark:border-gray-600'
          : 'text-sm',
      ].join(' ')}
    >
      <span
        className={
          grand ? 'text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-slate-300'
        }
      >
        {label}
      </span>
      <span className="tabular-nums text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function LineItemsTable({
  title,
  items,
  category,
}: {
  title: string;
  items: ChangeOrderLineItem[];
  category: ChangeOrderLineItemCategory;
}) {
  const filtered = items.filter((row) => row.description?.trim() || row.amount > 0);
  if (filtered.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {title}
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-slate-800/80 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr
                key={`${category}-${index}`}
                className="border-t border-gray-100 dark:border-gray-800"
              >
                <td className="px-3 py-2 text-gray-900 dark:text-slate-100">
                  {row.description?.trim() || '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-slate-100">
                  {formatChangeOrderMoney(
                    category === 'equipment'
                      ? row.amount
                      : row.amount,
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-200 bg-gray-50 font-medium dark:border-gray-700 dark:bg-slate-800/50">
              <td className="px-3 py-2 text-gray-700 dark:text-slate-300">Subtotal</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-white">
                {formatChangeOrderMoney(sumCategoryCost(items, category))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InternalPricingSection({
  breakdown,
}: {
  breakdown: ReturnType<typeof computePricingBreakdown>;
}) {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
        Internal pricing summary
      </p>
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm dark:border-slate-600 dark:bg-slate-800/50">
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span>Labor</span>
            <span className="tabular-nums">{formatChangeOrderMoney(breakdown.laborTotal)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Materials (adjusted)</span>
            <span className="tabular-nums">
              {formatChangeOrderMoney(breakdown.materialCostAdjusted)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Equipment</span>
            <span className="tabular-nums">
              {formatChangeOrderMoney(breakdown.equipmentTotal)}
            </span>
          </div>
          {breakdown.subcontractorTotal > 0 && (
            <div className="flex justify-between gap-4">
              <span>Subcontractors</span>
              <span className="tabular-nums">
                {formatChangeOrderMoney(breakdown.subcontractorTotal)}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4 font-medium">
            <span>Direct cost</span>
            <span className="tabular-nums">{formatChangeOrderMoney(breakdown.directCost)}</span>
          </div>
          <div className="flex justify-between gap-4 text-gray-600 dark:text-slate-400">
            <span>Total estimated cost</span>
            <span className="tabular-nums">
              {formatChangeOrderMoney(breakdown.totalEstimatedCost)}
            </span>
          </div>
          <div className="flex justify-between gap-4 text-gray-600 dark:text-slate-400">
            <span>Gross profit</span>
            <span className="tabular-nums">{formatChangeOrderMoney(breakdown.grossProfit)}</span>
          </div>
          <div className="flex justify-between gap-4 text-gray-600 dark:text-slate-400">
            <span>Gross margin</span>
            <span className="tabular-nums">{breakdown.grossMarginPercent}%</span>
          </div>
          <div className="flex justify-between gap-4 text-gray-600 dark:text-slate-400">
            <span>Markup %</span>
            <span className="tabular-nums">{breakdown.markupPercentReporting}%</span>
          </div>
          <div className="flex justify-between gap-4 border-t border-gray-200 pt-2 font-bold dark:border-gray-700">
            <span>Proposal price</span>
            <span className="tabular-nums">{formatChangeOrderMoney(breakdown.totalPrice)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChangeOrderDocument({
  order,
  audience = 'client',
  context,
}: {
  order: ChangeOrder;
  audience?: 'client' | 'internal';
  context?: ChangeOrderDocumentContext;
}) {
  const breakdown = computePricingBreakdown(
    order.laborItems,
    order.materialItems,
    order.equipmentItems,
    order.subcontractorItems ?? [],
    pricingParamsFromChangeOrder(order),
  );

  const company = context?.company;
  const project = context?.project;
  const contractValues = context?.contractValues;
  const documentDate = context?.documentDate;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden bg-white p-6 text-gray-900 print:bg-white print:text-black dark:bg-white dark:text-gray-900">
      <header className="border-b border-gray-200 pb-6 dark:border-gray-300">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {company?.logoUrl ? (
              <img
                src={company.logoUrl}
                alt=""
                className="mb-3 max-h-14 max-w-[200px] object-contain"
              />
            ) : null}
            <p className="text-lg font-bold text-gray-900">{company?.name ?? 'Contractor'}</p>
            {company?.address ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{company.address}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              {company?.phone ? <span>{company.phone}</span> : null}
              {company?.email ? <span>{company.email}</span> : null}
              {company?.licenseNumber ? (
                <span>License {company.licenseNumber}</span>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-right dark:border-gray-400 dark:bg-gray-100">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-700">
              Change Order
            </p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {order.displayNumber ?? 'Draft'}
            </p>
            {documentDate ? (
              <p className="mt-1 text-xs text-gray-600">Date: {documentDate}</p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-300">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Project information
        </p>
        <div className="mt-2">
          <InfoRow label="Project" value={project?.name ?? '—'} />
          {project?.projectNumber ? (
            <InfoRow label="Project #" value={project.projectNumber} />
          ) : null}
          <InfoRow label="Address" value={project?.address ?? '—'} />
          <InfoRow label="Owner / client" value={project?.clientName ?? '—'} />
          {project?.clientCompany ? (
            <InfoRow label="Client company" value={project.clientCompany} />
          ) : null}
          <InfoRow label="Contractor" value={project?.contractorName ?? '—'} />
        </div>
      </section>

      <section className="mt-6">
        <h1 className="break-words text-xl font-bold text-gray-900 [overflow-wrap:anywhere]">
          {order.title}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Status: {CHANGE_ORDER_STATUS_LABELS[order.status]}
        </p>
        {order.reasonForChange.trim() ? (
          <DocumentTextBlock label="Reason for change" text={order.reasonForChange} />
        ) : null}
      </section>

      {order.scopeDescription.trim() ? (
        <DocumentTextBlock label="Scope of change" text={order.scopeDescription} />
      ) : null}

      {order.scheduleImpact?.trim() ? (
        <DocumentTextBlock label="Schedule impact" text={order.scheduleImpact} />
      ) : null}

      {audience === 'internal' && (
        <>
          <LineItemsTable title="Labor" items={order.laborItems} category="labor" />
          <LineItemsTable title="Material" items={order.materialItems} category="material" />
          <LineItemsTable title="Equipment" items={order.equipmentItems} category="equipment" />
          <LineItemsTable
            title="Subcontractors"
            items={order.subcontractorItems ?? []}
            category="subcontractor"
          />
        </>
      )}

      <section className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Pricing summary
        </p>
        {audience === 'client' ? (
          <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 px-4 dark:border-gray-300">
            <ClientTotalRow
              label="Total change order price"
              value={formatChangeOrderMoney(breakdown.totalPrice)}
              grand
            />
          </div>
        ) : (
          <InternalPricingSection breakdown={breakdown} />
        )}
      </section>

      {contractValues && (
        <section className="mt-8 rounded-lg border border-gray-200 p-4 dark:border-gray-300">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Contract value summary
          </p>
          <div className="mt-2 space-y-0">
            <ClientTotalRow label="Original contract" value={contractValues.originalLabel} />
            <ClientTotalRow
              label="Previous approved changes"
              value={contractValues.previousApprovedLabel}
            />
            <ClientTotalRow
              label="This change order"
              value={contractValues.thisChangeOrderLabel}
            />
            <ClientTotalRow
              label="Revised contract value"
              value={contractValues.revisedLabel}
              grand
            />
          </div>
        </section>
      )}

      <section className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Terms</p>
        <p className="mt-2 text-sm leading-relaxed text-gray-800">{CHANGE_ORDER_APPROVAL_STATEMENT}</p>
        {order.terms?.trim() ? (
          <DocumentTextBlock label="Additional terms" text={order.terms} />
        ) : null}
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
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
      </section>
    </div>
  );
}
