import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import Card from '../ui/Card';
import { useNavigate } from 'react-router-dom';

interface QcOpsPanelProps {
  testsDue: number;
  totalRecords: number;
  projectsWithQc: number;
}

const QcOpsPanel: React.FC<QcOpsPanelProps> = ({
  testsDue,
  totalRecords,
  projectsWithQc,
}) => {
  const navigate = useNavigate();

  return (
    <Card className="p-5 bg-slate-900/95 border border-slate-700 text-white">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardCheck className="h-5 w-5 text-emerald-400" />
        <h3 className="font-semibold">QC / inspection</h3>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xl font-bold text-amber-400">{testsDue}</p>
          <p className="text-[10px] text-slate-500 uppercase">Alerts</p>
        </div>
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xl font-bold">{totalRecords}</p>
          <p className="text-[10px] text-slate-500 uppercase">Records</p>
        </div>
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xl font-bold">{projectsWithQc}</p>
          <p className="text-[10px] text-slate-500 uppercase">Projects</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 uppercase mb-2">Cure progress (typical)</p>
      <div className="space-y-2">
        {[
          { day: 'Day 1', pct: 16 },
          { day: 'Day 7', pct: 65 },
          { day: 'Day 28', pct: 100 },
        ].map((row) => (
          <div key={row.day}>
            <div className="flex justify-between text-xs text-slate-400 mb-0.5">
              <span>{row.day}</span>
              <span>{row.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${row.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate('/projects')}
        className="mt-4 text-sm text-cyan-400 hover:underline"
      >
        Open project QC logs →
      </button>
    </Card>
  );
};

export default QcOpsPanel;
