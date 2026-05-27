import React from 'react';
import { ClipboardCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';

interface SmartPourAssistantProps {
  className?: string;
  projectId?: string;
  projectName?: string;
  pourDateLabel?: string;
  checks: {
    mixSelected: boolean;
    volumeCalculated: boolean;
    weatherAcceptable: boolean;
    pourDateScheduled: boolean;
    batchPlantAssigned: boolean;
    truckSpacingEntered: boolean;
    curingMethodSelected: boolean;
    callSheetReady: boolean;
  };
  attention: string[];
}

const CHECK_ITEMS: { key: keyof SmartPourAssistantProps['checks']; label: string }[] = [
  { key: 'mixSelected', label: 'Mix selected' },
  { key: 'volumeCalculated', label: 'Volume calculated' },
  { key: 'weatherAcceptable', label: 'Weather acceptable' },
  { key: 'pourDateScheduled', label: 'Pour date scheduled' },
  { key: 'batchPlantAssigned', label: 'Batch plant assigned' },
  { key: 'truckSpacingEntered', label: 'Truck spacing entered' },
  { key: 'curingMethodSelected', label: 'Curing method selected' },
  { key: 'callSheetReady', label: 'Call sheet ready' },
];

const SmartPourAssistant: React.FC<SmartPourAssistantProps> = ({
  className,
  projectId,
  projectName,
  pourDateLabel,
  checks,
  attention,
}) => {
  const navigate = useNavigate();

  return (
    <OpsCard className={className}>
      <div className="flex items-center gap-2 mb-2">
        <ClipboardCheck className="h-5 w-5 text-cyan-400 shrink-0" />
        <h3 className="font-semibold text-white text-sm">Pre-placement review</h3>
      </div>

      {!projectId ? (
        <>
          <p className="text-base font-semibold text-white">No placement scheduled</p>
          <p className="text-sm text-slate-400 mt-1">
            Schedule a pour date to run the pre-placement review.
          </p>
          <Button
            size="sm"
            className="!bg-cyan-600 hover:!bg-cyan-500 !text-white mt-3 w-full"
            onClick={() => navigate('/projects')}
          >
            Schedule Placement
          </Button>
        </>
      ) : (
        <>
          <p className="text-base font-bold text-white leading-snug">{projectName}</p>
          {pourDateLabel && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{pourDateLabel}</p>
          )}

          <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-3 mb-1.5">
            Ready
          </p>
          <ul className="grid grid-cols-1 gap-y-0.5 text-xs">
            {CHECK_ITEMS.map(({ key, label }) => (
              <CheckRow key={key} ok={checks[key]} label={label} />
            ))}
          </ul>

          <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-3 mb-1.5">
            Attention required
          </p>
          {attention.length === 0 ? (
            <p className="text-xs text-slate-300">No blockers — confirm with plant and crew.</p>
          ) : (
            <ul className="space-y-1">
              {attention.map((msg) => (
                <li
                  key={msg}
                  className="flex gap-1.5 text-xs text-slate-300 bg-slate-800/50 rounded-md px-2 py-1 border border-slate-700/80"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-px" />
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}

          <Button
            size="sm"
            className="!bg-cyan-600 hover:!bg-cyan-500 !text-white mt-3 w-full"
            onClick={() => navigate(`/pour-planner?flow=1&project=${projectId}`)}
          >
            Open Placement Planner
          </Button>
        </>
      )}
    </OpsCard>
  );
};

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <CheckCircle2
        className={`h-3.5 w-3.5 shrink-0 ${ok ? 'text-emerald-400' : 'text-slate-600'}`}
      />
      <span className={ok ? 'text-slate-200' : 'text-slate-500'}>✓ {label}</span>
    </li>
  );
}

export default SmartPourAssistant;
