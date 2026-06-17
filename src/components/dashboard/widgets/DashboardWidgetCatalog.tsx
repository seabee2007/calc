import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import ModalShell from '../../ui/ModalShell';
import {
  DASHBOARD_CARD_IDS,
  DASHBOARD_CARD_META,
  type DashboardCardId,
  type DashboardWidgetCategory,
} from '../../../lib/dashboardLayout';
import type { PlanId } from '../../../lib/entitlements';
import type { FeatureKey } from '../../../lib/entitlements';
import DashboardWidgetTile, { type WidgetTileStatus } from './DashboardWidgetTile';
import { WIDGET_CATALOG_FILTERS, canAccessWidget } from './dashboardWidgetCategories';

interface DashboardWidgetCatalogProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanId;
  isOwner: boolean;
  hasFeature: (feature: FeatureKey) => boolean;
  activeIds: Set<DashboardCardId>;
  onAdd: (id: DashboardCardId) => void;
  onUpgrade: (requiredPlan: PlanId, widgetId: DashboardCardId) => void | Promise<void>;
  isPastDue?: boolean;
}

/** Catalog list is derived from the registry metadata — single source of truth. */
function useCatalogWidgets(isOwner: boolean) {
  return useMemo(
    () =>
      DASHBOARD_CARD_IDS.map((id) => DASHBOARD_CARD_META[id]).filter((meta) => {
        // Hide role-gated widgets the user can't use (don't expose them at all).
        if (meta.requiredRole === 'owner' && !isOwner) return false;
        return true;
      }),
    [isOwner],
  );
}

const DashboardWidgetCatalog: React.FC<DashboardWidgetCatalogProps> = ({
  isOpen,
  onClose,
  plan,
  isOwner,
  hasFeature,
  activeIds,
  onAdd,
  onUpgrade,
  isPastDue = false,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | DashboardWidgetCategory>('all');
  const [upgradingWidgetId, setUpgradingWidgetId] = useState<DashboardCardId | null>(null);

  const widgets = useCatalogWidgets(isOwner);
  const accessCtx = useMemo(
    () => ({ plan, isOwner, hasFeature }),
    [plan, isOwner, hasFeature],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return widgets.filter((meta) => {
      if (filter !== 'all' && meta.category !== filter) return false;
      if (!q) return true;
      return (
        meta.title.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        meta.category.toLowerCase().includes(q)
      );
    });
  }, [widgets, query, filter]);

  const statusFor = (id: DashboardCardId): WidgetTileStatus => {
    const meta = DASHBOARD_CARD_META[id];
    if (!canAccessWidget(meta, accessCtx)) return 'locked';
    if (activeIds.has(id)) return 'added';
    return 'add';
  };

  const handleAdd = (id: DashboardCardId) => {
    if (statusFor(id) !== 'add') return;
    onAdd(id);
  };

  const handleUpgrade = async (requiredPlan: PlanId, widgetId: DashboardCardId) => {
    if (statusFor(widgetId) !== 'locked' || upgradingWidgetId) return;
    setUpgradingWidgetId(widgetId);
    try {
      await onUpgrade(requiredPlan, widgetId);
    } finally {
      setUpgradingWidgetId(null);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Add widgets" size="xl">
      <div className="space-y-4" data-testid="dashboard-widget-catalog">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search widgets"
            aria-label="Search widgets"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Widget categories">
          {WIDGET_CATALOG_FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  active
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No widgets match your search.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map((meta) => (
              <DashboardWidgetTile
                key={meta.id}
                meta={meta}
                status={statusFor(meta.id)}
                onAdd={() => handleAdd(meta.id)}
                onUpgrade={(requiredPlan) => void handleUpgrade(requiredPlan, meta.id)}
                upgrading={upgradingWidgetId === meta.id}
                isPastDue={isPastDue}
              />
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

export default DashboardWidgetCatalog;
