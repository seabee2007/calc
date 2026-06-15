import type { PlanId } from '../../lib/entitlements';
import { getPlanMarketingCards } from '../../lib/planMarketing';
import PlanBadge from './PlanBadge';

interface PricingPlansCardProps {
  currentPlan: PlanId;
  billingInterval: 'month' | 'year';
  onBillingIntervalChange: (interval: 'month' | 'year') => void;
  onSelectPlan: (planId: PlanId) => void;
  loadingPlan?: PlanId | null;
  disabled?: boolean;
}

export default function PricingPlansCard({
  currentPlan,
  billingInterval,
  onBillingIntervalChange,
  onSelectPlan,
  loadingPlan = null,
  disabled = false,
}: PricingPlansCardProps) {
  const cards = getPlanMarketingCards();

  return (
    <section className="space-y-4" data-testid="pricing-plans-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plans</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Choose the plan that matches your estimating, field, and portfolio workflow.
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-700"
          role="tablist"
          aria-label="Billing interval"
        >
          <button
            type="button"
            role="tab"
            aria-selected={billingInterval === 'month'}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              billingInterval === 'month'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            onClick={() => onBillingIntervalChange('month')}
            data-testid="billing-interval-month"
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billingInterval === 'year'}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              billingInterval === 'year'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            onClick={() => onBillingIntervalChange('year')}
            data-testid="billing-interval-year"
          >
            Annual
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => {
          const isCurrent = card.planId === currentPlan;
          const isLoading = loadingPlan === card.planId;
          return (
            <article
              key={card.planId}
              className={`rounded-2xl border p-5 shadow-sm ${
                isCurrent
                  ? 'border-cyan-400 bg-cyan-50/40 dark:border-cyan-500/40 dark:bg-cyan-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
              data-testid={`pricing-plan-${card.planId}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {card.shortName}
                  </h4>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{card.longName}</p>
                </div>
                {isCurrent ? <PlanBadge plan={card.planId} /> : null}
              </div>
              <ul className="mb-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {card.highlights.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-cyan-600 dark:text-cyan-400" aria-hidden>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={disabled || isLoading || isCurrent}
                className="inline-flex w-full items-center justify-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onSelectPlan(card.planId)}
                data-testid={`select-plan-${card.planId}`}
              >
                {isCurrent ? 'Current plan' : isLoading ? 'Redirecting…' : `Choose ${card.shortName}`}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
