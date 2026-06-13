import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store';
import { useTrackedProposals } from '../hooks/useTrackedProposals';
import { buildOperationsSnapshot } from '../utils/operationsDashboard';
import { fetchChangeOrdersForProjectIds } from '../services/changeOrderService';
import { isProjectClosedOut } from '../utils/projectWorkflow';
import FinancialDetailsPanel from '../components/dashboard/FinancialDetailsPanel';
import Button from '../components/ui/Button';
import KpiStrip from '../components/ui/KpiStrip';
import { OPS_OUTLINE_BTN, OPS_SHELL } from '../components/dashboard/opsTheme';
import {
  PAGE_GUTTER,
  PREMIUM_PAGE_MAX_WIDTH,
  PREMIUM_PANEL,
  TEXT_MUTED,
} from '../theme/appTheme';
import type { ChangeOrder } from '../types/changeOrder';
import { useAuth } from '../hooks/useAuth';
import { formatProposalMoney, formatWinRate } from '../utils/proposalKpis';

const FinancialDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isOwner, user } = useAuth();
  const { projects, loadProjects } = useProjectStore();
  const { proposals } = useTrackedProposals();
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const operationalProjects = useMemo(
    () => projects.filter((p) => !isProjectClosedOut(p)),
    [projects],
  );

  useEffect(() => {
    if (!isOwner || !user || operationalProjects.length === 0) {
      setChangeOrders((current) => (current.length === 0 ? current : []));
      return;
    }
    const ids = operationalProjects.map((p) => p.id);
    void fetchChangeOrdersForProjectIds(ids).then(setChangeOrders).catch(() => setChangeOrders([]));
  }, [isOwner, user, operationalProjects]);

  const snapshot = useMemo(
    () =>
      buildOperationsSnapshot(operationalProjects, {
        proposals,
        changeOrders,
        allProjectsForQc: projects,
      }),
    [operationalProjects, projects, proposals, changeOrders],
  );

  const { financial } = snapshot.proposalMetrics;
  const grossMarginPct =
    financial.acceptedRevenue > 0 && financial.grossProfit > 0
      ? `${((financial.grossProfit / financial.acceptedRevenue) * 100).toFixed(1)}%`
      : '—';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`${OPS_SHELL} ${PREMIUM_PAGE_MAX_WIDTH} ${PAGE_GUTTER} space-y-6 pb-24 md:pb-8`}
      data-testid="financial-details-page"
    >
      <section className={`${PREMIUM_PANEL} p-5 sm:p-6`}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/')}
          className={OPS_OUTLINE_BTN}
        >
          Back to dashboard
        </Button>

        <div className="mt-5">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            Financial details
          </h1>
          <p className={`mt-2 max-w-3xl text-sm sm:text-base ${TEXT_MUTED}`}>
            Full revenue, cost, and margin breakdown across proposals and active projects.
          </p>
        </div>
      </section>

      <KpiStrip
        premium
        metrics={[
          {
            label: 'Pending revenue',
            value: formatProposalMoney(financial.pendingRevenue),
            highlight: true,
          },
          {
            label: 'Accepted revenue',
            value: formatProposalMoney(financial.acceptedRevenue),
          },
          {
            label: 'Gross profit',
            value: formatProposalMoney(financial.grossProfit),
            highlight: financial.grossProfit >= 0,
          },
          {
            label: 'Gross margin',
            value: grossMarginPct,
          },
          {
            label: 'Win rate',
            value: formatWinRate(financial.winRate),
          },
          {
            label: 'Weighted forecast',
            value: formatProposalMoney(financial.weightedForecast),
          },
        ]}
      />

      <section className={`${PREMIUM_PANEL} p-5 sm:p-6`}>
        <FinancialDetailsPanel financial={financial} />
      </section>
    </motion.div>
  );
};

export default FinancialDetailsPage;
