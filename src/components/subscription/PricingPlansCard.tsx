import { Check } from 'lucide-react';
import type { PlanId } from '../../lib/entitlements';
import { getPlanMarketingCards, getPlanRank, formatUsd, getAnnualSavings, getMaxAnnualSavingsPercent } from '../../lib/planMarketing';

interface PricingPlansCardProps {
  /** Paid tier currently subscribed via Stripe, or null for Free / no-subscription users. */
  currentPlanId: PlanId | null;
  billingInterval: 'month' | 'year';
  onBillingIntervalChange: (interval: 'month' | 'year') => void;
  onSelectPlan: (planId: PlanId) => void;
  loadingPlan?: PlanId | null;
  disabled?: boolean;
  /** Deep-link highlight when arriving from a locked widget upgrade CTA. */
  highlightedPlan?: PlanId | null;
}

function getPlanCtaLabel(
  cardPlanId: PlanId,
  currentPlanId: PlanId | null,
): string {
  if (currentPlanId === null) {
    return `Choose ${getPlanMarketingCards().find((c) => c.planId === cardPlanId)?.shortName ?? cardPlanId}`;
  }

  if (cardPlanId === currentPlanId) {
    return 'Current plan';
  }

  const cardRank = getPlanRank(cardPlanId);
  const currentRank = getPlanRank(currentPlanId);

  if (cardRank > currentRank) {
    const name = getPlanMarketingCards().find((c) => c.planId === cardPlanId)?.shortName ?? cardPlanId;
    return `Upgrade to ${name}`;
  }

  const name = getPlanMarketingCards().find((c) => c.planId === cardPlanId)?.shortName ?? cardPlanId;
  return `Downgrade to ${name}`;
}

export default function PricingPlansCard({
  currentPlanId,
  billingInterval,
  onBillingIntervalChange,
  onSelectPlan,
  loadingPlan = null,
  disabled = false,
  highlightedPlan = null,
}: PricingPlansCardProps) {
  const cards = getPlanMarketingCards();
  const isAnnual = billingInterval === 'year';
  const maxAnnualSavingsPercent = getMaxAnnualSavingsPercent();

  return (
    <section className="space-y-5" data-testid="pricing-plans-card">
      {/* Header + interval toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plans</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose the plan that fits your workflow.
          </p>
        </div>

        <div
          className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60"
          role="tablist"
          aria-label="Billing interval"
        >
          <button
            type="button"
            role="tab"
            aria-selected={!isAnnual}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              !isAnnual
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            onClick={() => onBillingIntervalChange('month')}
            data-testid="billing-interval-month"
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isAnnual}
            className={`relative rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              isAnnual
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            onClick={() => onBillingIntervalChange('year')}
            data-testid="billing-interval-year"
          >
            Annual
            {maxAnnualSavingsPercent > 0 ? (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                Save up to {maxAnnualSavingsPercent}%
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Pricing cards grid */}
      <div className="grid gap-5 sm:grid-cols-1 lg:grid-cols-3">
        {cards.map((card) => {
          const isCurrent = currentPlanId !== null && card.planId === currentPlanId;
          const isHighlighted = highlightedPlan === card.planId && !isCurrent;
          const isLoading = loadingPlan === card.planId;
          const ctaLabel = isLoading ? 'Redirecting…' : getPlanCtaLabel(card.planId, currentPlanId);
          const isCtaDisabled = disabled || isLoading || isCurrent;

          const displayPrice = isAnnual
            ? card.pricing.annualMonthlyUsd
            : card.pricing.monthlyUsd;
          const { annualSavingsUsd } = getAnnualSavings(card.planId);

          // Visual treatment: recommended card gets cyan glow; current plan gets subtle fill
          const cardClass = isCurrent
            ? 'border-cyan-400/70 bg-cyan-50/30 dark:border-cyan-500/50 dark:bg-cyan-950/20 ring-1 ring-cyan-400/30 dark:ring-cyan-500/20'
            : isHighlighted
              ? 'border-cyan-400/80 bg-cyan-50/40 ring-2 ring-cyan-400/50 dark:border-cyan-500/50 dark:bg-cyan-950/30 dark:ring-cyan-500/40'
            : card.recommended
              ? 'border-cyan-300/60 bg-white shadow-md shadow-cyan-100/40 dark:border-cyan-500/30 dark:bg-slate-900 dark:shadow-none'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

          const ctaClass = isCurrent
            ? 'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-500 cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
            : card.recommended
              ? 'w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors'
              : 'w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 transition-colors dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800';

          return (
            <article
              key={card.planId}
              className={`relative flex flex-col rounded-2xl border p-6 transition-shadow hover:shadow-md ${cardClass}`}
              data-testid={`pricing-plan-${card.planId}`}
            >
              {/* Recommended badge */}
              {card.recommended && !isCurrent && !isHighlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-cyan-600 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                  Most popular
                </span>
              ) : null}
              {isHighlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-cyan-600 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white shadow">
                  Recommended upgrade
                </span>
              ) : null}

              {/* Plan name + subtitle */}
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {card.shortName}
                  </h4>
                  {isCurrent ? (
                    <span className="inline-flex items-center rounded-full border border-cyan-300 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-950/40 dark:text-cyan-300">
                      Current
                    </span>
                  ) : null}
                </div>
                <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {card.longName}
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.audience}</p>
              </div>

              {/* Pricing */}
              <div className="mb-5">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                    {formatUsd(displayPrice)}
                  </span>
                  <span className="mb-1 text-sm text-slate-400 dark:text-slate-500">/ mo</span>
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {isAnnual
                    ? `${formatUsd(card.pricing.annualTotalUsd)} billed annually · save ${formatUsd(annualSavingsUsd)}/yr`
                    : 'Billed monthly · cancel anytime'}
                </p>
              </div>

              {/* Features */}
              <ul className="mb-4 flex-1 space-y-2.5">
                {card.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500 dark:text-cyan-400"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">
                <span className="font-medium text-slate-500 dark:text-slate-400">Plan limits and usage:</span>{' '}
                {card.usageSummary}
              </p>

              {/* CTA */}
              <button
                type="button"
                disabled={isCtaDisabled}
                className={ctaClass}
                onClick={() => !isCtaDisabled && onSelectPlan(card.planId)}
                data-testid={`select-plan-${card.planId}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                    Redirecting…
                  </span>
                ) : ctaLabel}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
