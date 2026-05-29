import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import { OPS_PANEL_INNER } from './opsTheme';
import Button from '../ui/Button';

interface QcAlertsCardProps {
  testsDue: number;
  testsOverdue?: number;
  totalRecords: number;
}

const QC_CLOSEOUT_FOLDER = 'qc_closeout';

function alertSummary(testsDue: number, testsOverdue: number): string {
  if (testsOverdue > 0) {
    return `${testsOverdue} break test${testsOverdue === 1 ? ' is' : 's are'} overdue.`;
  }
  return `${testsDue} break test${testsDue === 1 ? ' is' : 's are'} due this week.`;
}

const QcAlertsCard: React.FC<QcAlertsCardProps> = ({
  testsDue,
  testsOverdue = 0,
  totalRecords,
}) => {
  const navigate = useNavigate();
  const hasAlerts = testsDue > 0;

  return (
    <OpsCard>
      <div className="flex items-center gap-2 mb-3">
        <ClipboardCheck className="h-5 w-5 text-emerald-400" />
        <h3 className="font-semibold text-white">QC alerts</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`${OPS_PANEL_INNER} p-3 text-center`}>
          <p
            className={`text-xl font-bold ${
              testsOverdue > 0
                ? 'text-red-400'
                : hasAlerts
                  ? 'text-amber-400'
                  : 'text-amber-400'
            }`}
          >
            {testsDue}
          </p>
          <p className="text-[10px] text-slate-500 uppercase">
            {testsOverdue > 0 ? 'Due / overdue' : 'Due'}
          </p>
        </div>
        <div className={`${OPS_PANEL_INNER} p-3 text-center`}>
          <p className="text-xl font-bold text-white">{totalRecords}</p>
          <p className="text-[10px] text-slate-500 uppercase">Records</p>
        </div>
      </div>
      {hasAlerts ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">{alertSummary(testsDue, testsOverdue)}</p>
          <Button
            size="sm"
            className="!bg-emerald-700 hover:!bg-emerald-600 !text-white w-full"
            onClick={() => navigate(`/projects?folder=${QC_CLOSEOUT_FOLDER}`)}
          >
            Review QC
          </Button>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No open QC alerts this week.</p>
      )}
    </OpsCard>
  );
};

export default QcAlertsCard;
