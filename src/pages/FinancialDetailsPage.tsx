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
import OpsCard from '../components/dashboard/OpsCard';
import Button from '../components/ui/Button';
import AppPage from '../components/ui/AppPage';
import PageHeader from '../components/ui/PageHeader';
import KpiStrip from '../components/ui/KpiStrip';
import { OPS_SHELL } from '../components/dashboard/opsTheme';
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
      className={OPS_SHELL}
    >
      <AppPage
        className="pt-4"
        header={
          <PageHeader
            breadcrumb={
              <Button
                type="button"
                variant="outline"
                size="sm"
                icon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => navigate('/')}
              >
                Back to dashboard
              </Button>
            }
            title="Financial details"
            subtitle="Full revenue, cost, and margin breakdown across proposals and active projects."
            className="!px-0"
          />
        }
      >
        <KpiStrip
          className="mb-6"
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

        <OpsCard>
          <FinancialDetailsPanel financial={financial} />
        </OpsCard>
      </AppPage>
    </motion.div>
  );
};

export default FinancialDetailsPage;
