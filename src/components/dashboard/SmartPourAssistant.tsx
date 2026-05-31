import React from 'react';
import { ClipboardCheck, AlertTriangle, CheckCircle2, Calendar, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OpsCard from './OpsCard';
import Button from '../ui/Button';
import {
  OPS_ATTENTION_CHIP,
  OPS_BODY,
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_SUBTLE,
  OPS_TITLE,
} from './opsTheme';

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
  emptyMessage?: string;
}

const CHECK_ITEMS: { key: keyof SmartPourAssistantProps['checks']; label: string }[] = [
  { key: 'mixSelected', label: 'Mix selected' },
  { key: 'volumeCalculated', label: 'Volume calculated' },
  { key: 'weatherAcceptable', label: 'Weather acceptable' },
  { key: 'pourDateScheduled', label: 'Placement date scheduled' },
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
  emptyMessage,
}) => {
  const navigate = useNavigate();

  return (
    <OpsCard className={className}>
      <div className="flex items-center gap-2 mb-2">
        <ClipboardCheck className="h-5 w-5 text-cyan-400 shrink-0" />
        <h3 className={`font-semibold text-sm ${OPS_TITLE}`}>Pre-placement review</h3>
      </div>

      {!projectId ? (
        <>
          <p className={`text-base font-semibold ${OPS_TITLE}`}>
            {emptyMessage ? 'Nothing in the queue' : 'No placement scheduled'}
          </p>
          <p className={`text-sm mt-1 ${OPS_MUTED}`}>
            {emptyMessage ??
              'Schedule a placement date to run the pre-placement review.'}
          </p>
          {!emptyMessage && (
            <Button
              size="sm"
              variant="outline"
              className={`${OPS_OUTLINE_BTN} mt-4 w-full`}
              icon={<Calendar className="h-4 w-4" />}
              onClick={() => navigate('/projects')}
            >
              Schedule Placement
            </Button>
          )}
        </>
      ) : (
        <>
          <p className={`text-base font-bold leading-snug ${OPS_TITLE}`}>{projectName}</p>
          {pourDateLabel && (
            <p className={`text-xs mt-0.5 leading-snug ${OPS_MUTED}`}>{pourDateLabel}</p>
          )}

          <p className={`text-[10px] uppercase tracking-wide mt-3 mb-1.5 ${OPS_SUBTLE}`}>
            Ready
          </p>
          <ul className="grid grid-cols-1 gap-y-0.5 text-xs">
            {CHECK_ITEMS.map(({ key, label }) => (
              <CheckRow key={key} ok={checks[key]} label={label} />
            ))}
          </ul>

          <p className={`text-[10px] uppercase tracking-wide mt-3 mb-1.5 ${OPS_SUBTLE}`}>
            Attention required
          </p>
          {attention.length === 0 ? (
            <p className={`text-xs ${OPS_BODY}`}>No blockers — confirm with plant and crew.</p>
          ) : (
            <ul className="space-y-1">
              {attention.map((msg) => (
                <li
                  key={msg}
                  className={`flex gap-1.5 text-xs ${OPS_BODY} ${OPS_ATTENTION_CHIP}`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-px" />
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}

          <Button
            size="sm"
            variant="outline"
            className={`${OPS_OUTLINE_BTN} mt-4 w-full`}
            icon={<Truck className="h-4 w-4" />}
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
        className={`h-3.5 w-3.5 shrink-0 ${ok ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'}`}
      />
      <span className={ok ? OPS_BODY : OPS_SUBTLE}>✓ {label}</span>
    </li>
  );
}

export default SmartPourAssistant;
