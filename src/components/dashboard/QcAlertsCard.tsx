import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER } from './opsTheme';
import Button from '../ui/Button';

interface QcAlertsCardProps {
  testsDue: number;
  totalRecords: number;
}

const QcAlertsCard: React.FC<QcAlertsCardProps> = ({ testsDue, totalRecords }) => {
  const navigate = useNavigate();

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="h-5 w-5 text-emerald-400" />
        <h3 className="font-semibold text-white">QC alerts</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`${OPS_PANEL_INNER} p-3 text-center`}>
          <p className="text-xl font-bold text-amber-400">{testsDue}</p>
          <p className="text-[10px] text-slate-500 uppercase">Due</p>
        </div>
        <div className={`${OPS_PANEL_INNER} p-3 text-center`}>
          <p className="text-xl font-bold text-white">{totalRecords}</p>
          <p className="text-[10px] text-slate-500 uppercase">Records</p>
        </div>
      </div>
      {testsDue > 0 ? (
        <Button
          size="sm"
          className="!bg-emerald-700 hover:!bg-emerald-600 !text-white w-full"
          onClick={() => navigate('/projects')}
        >
          Review QC
        </Button>
      ) : (
        <p className="text-sm text-slate-400">No open QC alerts this week.</p>
      )}
    </OpsCard>
  );
};

export default QcAlertsCard;
