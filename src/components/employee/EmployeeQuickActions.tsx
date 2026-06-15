import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  FileText,
  ClipboardCheck,
  HelpCircle,
  Wrench,
  FolderOpen,
  CalendarDays,
  Calculator,
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
      onClick: () => navigate('/employee/qc'),
    },
    {
      label: 'Create RFI',
      icon: HelpCircle,
      onClick: () => setRfiOpen(true),
      disabled: !defaultProjectId,
    },
    {
      label: 'Create FAR',
      icon: Wrench,
      onClick: () => setAdjOpen(true),
      disabled: !defaultProjectId,
    },
    {
      label: 'View Documents',
      icon: FolderOpen,
      onClick: () => navigate('/employee/documents'),
    },
    {
      label: 'Schedule',
      icon: CalendarDays,
      onClick: () => navigate('/employee/schedule'),
    },
    {
      label: 'Arden Calculator',
      icon: Calculator,
      onClick: () => navigate('/employee/calculator'),
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
              className="flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-sm font-medium text-slate-100 hover:border-cyan-500/50 disabled:opacity-40 touch-manipulation"
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
