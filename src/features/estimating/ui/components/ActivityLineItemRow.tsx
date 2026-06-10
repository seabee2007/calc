/**
 * One row in a ConstructionActivityCard — shows a single project activity line item.
 * Line items are NEVER schedule activities (enforced here: no scheduleEnabled toggle).
 */
import type { ProjectActivityLineItem } from '../../domain/constructionActivityTypes';

interface Props {
  item: ProjectActivityLineItem;
  index: number;
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function ActivityLineItemRow({ item, index }: Props) {
  const isEven = index % 2 === 0;

  return (
    <div
      className={[
        'grid grid-cols-[1fr_auto] items-start gap-x-3 px-3 py-2 sm:grid-cols-[2fr_1fr_1fr_1fr_1fr]',
        isEven
          ? 'bg-white dark:bg-slate-900/70'
          : 'bg-slate-50/80 dark:bg-slate-800/40',
      ].join(' ')}
    >
      {/* Description + rate source */}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-800 dark:text-slate-200">{item.name}</p>
        <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
          {item.productionRateId}
        </p>
      </div>

      {/* Quantity */}
      <div className="hidden text-right sm:block">
        <p className="tabular-nums text-xs font-medium text-slate-700 dark:text-slate-300">
          {item.quantity.toLocaleString()}
        </p>
        <p className="text-[10px] text-slate-400">{item.unit}</p>
      </div>

      {/* MH/Unit */}
      <div className="hidden text-right sm:block">
        <p className="tabular-nums text-xs text-slate-600 dark:text-slate-400">
          {fmt(item.manHoursPerUnit, 4)}
        </p>
        <p className="text-[10px] text-slate-400">MH/{item.unit}</p>
      </div>

      {/* Calc MH */}
      <div className="hidden text-right sm:block">
        <p className="tabular-nums text-xs font-semibold text-cyan-700 dark:text-cyan-400">
          {fmt(item.calculatedManHours)} MH
        </p>
      </div>

      {/* Total cost — placeholder until pricing library is wired */}
      <div className="text-right sm:block">
        <p className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
          {item.totalCost ? `$${fmt(item.totalCost)}` : '—'}
        </p>
      </div>

      {/* Mobile: quantity + MH inline */}
      <div className="text-right sm:hidden">
        <p className="tabular-nums text-xs text-slate-600 dark:text-slate-400">
          {item.quantity.toLocaleString()} {item.unit}
        </p>
        <p className="tabular-nums text-xs font-semibold text-cyan-700 dark:text-cyan-400">
          {fmt(item.calculatedManHours)} MH
        </p>
      </div>
    </div>
  );
}
