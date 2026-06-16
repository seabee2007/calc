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
  className?: string;
  embedded?: boolean;
}

const DashboardNextActionsCard: React.FC<DashboardNextActionsCardProps> = ({
  proposals,
  extraActions = [],
  maxItems = 5,
  onProposalAction,
  className = '',
  embedded = false,
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

  const body = (
    <>
      <div className="mb-3 flex shrink-0 items-center justify-end gap-2">
        {!embedded ? (
          <div className="mr-auto flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className={`font-semibold ${OPS_TITLE}`}>Next actions</h3>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => navigate('/proposals')}
          className="text-xs font-medium text-cyan-700 hover:underline dark:text-cyan-400"
        >
          View all →
        </button>
      </div>
      {items.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            You&rsquo;re all caught up
          </p>
          <p className={`text-xs ${OPS_SUBTLE}`}>
            No proposals or tasks need attention right now.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-3 lg:overflow-y-auto lg:pr-1">
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
      )}
    </>
  );

  if (embedded) {
    return <div className={`flex min-h-0 flex-col ${className}`.trim()}>{body}</div>;
  }

  return (
    <OpsCard className={`flex min-h-0 flex-col lg:h-full ${className}`.trim()}>
      {body}
    </OpsCard>
  );
};

export default DashboardNextActionsCard;
