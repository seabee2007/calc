import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCopy, ClipboardList, MapPin } from 'lucide-react';
import { extractChecklistFromAnswer } from '../../utils/chatAnswerActions';
import { workflowQuery } from '../../utils/workflow';

interface AssistantMessageActionsProps {
  content: string;
  projectId?: string;
}

const AssistantMessageActions: React.FC<AssistantMessageActionsProps> = ({
  content,
  projectId,
}) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<'answer' | 'checklist' | null>(null);

  const copyText = async (text: string, kind: 'answer' | 'checklist') => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const openPourPlanner = () => {
    if (projectId) {
      navigate({ pathname: '/pour-planner', search: workflowQuery(projectId) });
    } else {
      navigate('/pour-planner');
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-600/80 pt-3">
      <button
        type="button"
        onClick={() => void copyText(extractChecklistFromAnswer(content), 'checklist')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-cyan-950/30 hover:text-white transition-colors"
      >
        <ClipboardList className="h-3.5 w-3.5" />
        {copied === 'checklist' ? 'Copied!' : 'Create checklist'}
      </button>
      <button
        type="button"
        onClick={openPourPlanner}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-cyan-950/30 hover:text-white transition-colors"
      >
        <MapPin className="h-3.5 w-3.5" />
        Open Pour Planner
      </button>
      <button
        type="button"
        onClick={() => void copyText(content, 'answer')}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:bg-cyan-950/30 hover:text-white transition-colors"
      >
        <ClipboardCopy className="h-3.5 w-3.5" />
        {copied === 'answer' ? 'Copied!' : 'Copy answer'}
      </button>
    </div>
  );
};

export default AssistantMessageActions;
