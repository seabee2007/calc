import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  FileText,
  ClipboardCheck,
  HelpCircle,
  Wrench,
  Calculator,
  Calendar,
  ShieldCheck,
  FilePlus,
} from 'lucide-react';
import CreateRfiModal from '../field/CreateRfiModal';
import CreateFieldAdjustmentModal from '../field/CreateFieldAdjustmentModal';

interface EmployeeQuickActionsProps {
  userId: string;
  defaultProjectId?: string;
  onRecordsChanged?: () => void;
}

export default function EmployeeQuickActions({
  userId,
  defaultProjectId,
  onRecordsChanged,
}: EmployeeQuickActionsProps) {
  const navigate = useNavigate();
  const [rfiOpen, setRfiOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);

  const actions = [
    {
      label: 'Upload Photo',
      icon: Camera,
      onClick: () => navigate('/employee/uploads'),
    },
    {
      label: 'Daily Report',
      icon: FileText,
      onClick: () => navigate('/employee/messages'),
    },
    {
      label: 'QC Checklist',
      icon: ClipboardCheck,
      onClick: () => navigate('/employee/tasks'),
    },
    {
      label: 'Create RFI',
      icon: HelpCircle,
      onClick: () => setRfiOpen(true),
      disabled: !defaultProjectId,
    },
    {
      label: 'Field Adjustment',
      icon: Wrench,
      onClick: () => setAdjOpen(true),
      disabled: !defaultProjectId,
    },
    {
      label: 'Safety Meeting',
      icon: ShieldCheck,
      onClick: () => navigate('/employee/safety-meeting'),
    },
    {
      label: 'Draft Change Order',
      icon: FilePlus,
      onClick: () => navigate('/employee/draft-change-order'),
      disabled: !defaultProjectId,
    },
    {
      label: 'Calculator',
      icon: Calculator,
      onClick: () => navigate('/calculator'),
    },
    {
      label: 'Schedule',
      icon: Calendar,
      onClick: () => navigate('/planner/schedule'),
      disabled: !defaultProjectId,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              disabled={a.disabled}
              onClick={a.onClick}
              className="flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm font-medium text-slate-100 hover:border-cyan-500/50 disabled:opacity-40"
            >
              <Icon className="h-6 w-6 text-cyan-400" />
              {a.label}
            </button>
          );
        })}
      </div>

      {defaultProjectId && (
        <>
          <CreateRfiModal
            isOpen={rfiOpen}
            onClose={() => setRfiOpen(false)}
            projectId={defaultProjectId}
            userId={userId}
            onCreated={() => onRecordsChanged?.()}
          />
          <CreateFieldAdjustmentModal
            isOpen={adjOpen}
            onClose={() => setAdjOpen(false)}
            projectId={defaultProjectId}
            userId={userId}
            onCreated={() => onRecordsChanged?.()}
          />
        </>
      )}
    </>
  );
}
