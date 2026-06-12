import React, { useMemo } from 'react';
import { ArrowRight, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_ACTION_ITEM, OPS_CTA_PILL, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import type { ProposalNextAction } from '../../types/proposalNextAction';
import { buildCrmNextActions } from '../../utils/proposalCrm';

export interface DashboardExtraAction {
  id: string;
  title: string;
  detail: string;
  onClick: () => void;
}

interface DashboardNextActionsCardProps {
  proposals: TrackedProposalRow[];
  extraActions?: DashboardExtraAction[];
  maxItems?: number;
  onProposalAction?: (action: ProposalNextAction) => void;
}

const DashboardNextActionsCard: React.FC<DashboardNextActionsCardProps> = ({
  proposals,
  extraActions = [],
  maxItems = 5,
  onProposalAction,
}) => {
  const navigate = useNavigate();
  const proposalActions = useMemo(() => buildCrmNextActions(proposals), [proposals]);

  const items = useMemo(() => {
    const proposalSlots = Math.max(0, maxItems - extraActions.length);
    const fromProposals = proposalActions.slice(0, proposalSlots).map((item) => ({
      id: item.id,
      title: item.label,
      detail: `${item.clientName} · ${item.proposalTitle ?? item.projectName}`,
      onClick: () => {
        if (onProposalAction) {
          onProposalAction(item);
          return;
        }
        navigate('/proposals', { state: { openNextAction: item } });
      },
    }));
    const extras = extraActions.slice(0, maxItems - fromProposals.length);
    return [...extras, ...fromProposals].slice(0, maxItems);
  }, [extraActions, maxItems, navigate, onProposalAction, proposalActions]);

  if (items.length === 0) return null;

  return (
    <OpsCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <h3 className={`font-semibold ${OPS_TITLE}`}>Next actions</h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/proposals')}
          className="text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
        >
          View all →
        </button>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onClick}
              className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left ${OPS_ACTION_ITEM}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </span>
                <span className={`mt-0.5 block truncate text-xs ${OPS_SUBTLE}`}>{item.detail}</span>
              </span>
              <span className={OPS_CTA_PILL}>
                Open
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </OpsCard>
  );
};

export default DashboardNextActionsCard;
