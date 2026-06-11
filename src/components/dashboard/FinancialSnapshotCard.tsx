/** @deprecated Use BusinessSnapshotCard on dashboard and FinancialDetailsPanel on /financials */
import React from 'react';
import OpsCard from './OpsCard';
import FinancialDetailsPanel from './FinancialDetailsPanel';
import type { ProposalFinancialKpis } from '../../utils/proposalKpis';

interface FinancialSnapshotCardProps {
  financial: ProposalFinancialKpis;
}

const FinancialSnapshotCard: React.FC<FinancialSnapshotCardProps> = ({ financial }) => (
  <OpsCard>
    <FinancialDetailsPanel financial={financial} />
  </OpsCard>
);

export default FinancialSnapshotCard;
