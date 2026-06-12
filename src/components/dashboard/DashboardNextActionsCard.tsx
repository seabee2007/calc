import React, { useMemo } from 'react';
import { ArrowRight, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_ACTION_ITEM, OPS_SUBTLE, OPS_TITLE } from './opsTheme';
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
          <ListTodo className="h-5 w-5 text-cyan-400" />
          <h3 className={`font-semibold ${OPS_TITLE}`}>Next actions</h3>
        </div>
        <button
          type="button"
          onClick={() => navigate('/proposals')}
          className="text-xs text-cyan-700 hover:underline dark:text-cyan-400"
        >
          View all →
        </button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onClick}
              className={`flex w-full items-start justify-between gap-3 text-left ${OPS_ACTION_ITEM}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </span>
                <span className={`mt-0.5 block truncate text-xs ${OPS_SUBTLE}`}>{item.detail}</span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            </button>
          </li>
        ))}
      </ul>
    </OpsCard>
  );
};

export default DashboardNextActionsCard;
