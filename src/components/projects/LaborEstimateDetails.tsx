import React, { useMemo } from 'react';
import { Users, Plus, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import LaborTaskBreakdown from '../labor/LaborTaskBreakdown';
import type { LaborEstimate } from '../../types/laborEstimate';
import type { Calculation } from '../../types';
import { buildConcreteLaborEstimateInput } from '../../utils/concreteLaborInputMapper';
import {
  OPS_BODY,
  OPS_EMPTY_STATE,
  OPS_HERO_STAT_INNER,
  OPS_HERO_STAT_LABEL,
  OPS_HERO_STAT_VALUE,
  OPS_MUTED,
  OPS_TITLE,
} from '../dashboard/opsTheme';

interface LaborEstimateDetailsProps {
  estimate?: LaborEstimate | null;
  latestCalculation?: Calculation;
  onOpenCalculator?: () => void;
}

function formatCurrency(n: number) {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

const LaborEstimateDetails: React.FC<LaborEstimateDetailsProps> = ({
  estimate,
  latestCalculation,
  onOpenCalculator,
}) => {
  const hasEstimate =
    Boolean(estimate) &&
    ((estimate?.laborCost ?? 0) > 0 || Boolean(estimate?.professionalLabor));

  const laborInput = useMemo(() => {
    if (!estimate) return null;
    const manualVol = parseFloat(estimate.inputs.manualVolume);
    let volumeYd = estimate.volumeYd ?? 0;
    if (volumeYd <= 0 && Number.isFinite(manualVol) && manualVol > 0) {
      volumeYd = manualVol;
    }
    if (volumeYd <= 0) {
      volumeYd = latestCalculation?.result?.volume ?? 0;
    }
    if (volumeYd <= 0 && !estimate.professionalLabor) return null;
    return buildConcreteLaborEstimateInput(estimate.inputs, {
      volumeYd: Math.max(volumeYd, 0),
      calculation: latestCalculation,
    });
  }, [estimate, latestCalculation]);

  if (!hasEstimate) {
    return (
      <div className={OPS_EMPTY_STATE}>
        <Users className={`h-12 w-12 ${OPS_MUTED} mx-auto mb-4`} />
        <h3 className={`text-lg font-medium ${OPS_TITLE} mb-2`}>
          No labor estimate
        </h3>
        <p className={`${OPS_MUTED} mb-4`}>
          Run the concrete labor calculator for this project to save crew, task hours, and
          placement cost here.
        </p>
        {onOpenCalculator && (
          <Button variant="accent" onClick={onOpenCalculator} icon={<Plus size={16} />}>
            Open Concrete Labor Calculator
          </Button>
        )}
      </div>
    );
  }

  const savedAt = estimate?.updatedAt ?? estimate?.createdAt;
  const savedLabel = (() => {
    if (!savedAt) return null;
    try {
      return format(parseISO(savedAt), 'MMM d, yyyy h:mm a');
    } catch {
      return null;
    }
  })();

  const crewSize = parseInt(estimate?.inputs.crewSize ?? '', 10);
  const finishers = parseInt(estimate?.inputs.finishers ?? '', 10);
  const foremen = parseInt(estimate?.inputs.foremen ?? '', 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={`text-lg font-semibold ${OPS_TITLE}`}>
            {estimate?.label ?? 'Placement labor estimate'}
          </h3>
          {savedLabel && (
            <p className={`text-xs ${OPS_MUTED} mt-0.5 flex items-center gap-1`}>
              <Calendar className="h-3.5 w-3.5" />
              Saved {savedLabel}
            </p>
          )}
        </div>
        {onOpenCalculator && (
          <Button
            variant="accent"
            size="sm"
            onClick={onOpenCalculator}
            icon={<Plus size={16} />}
          >
            <span className="hidden sm:inline">Edit in calculator</span>
            <span className="sm:hidden">Calculator</span>
          </Button>
        )}
      </div>

      {estimate?.professionalLabor && laborInput ? (
        <Card className="p-5">
          <LaborTaskBreakdown
            input={laborInput}
            result={estimate.professionalLabor}
            formatCurrency={formatCurrency}
            areaReconciledFromVolume={estimate.professionalLabor.areaReconciledFromVolume}
            detailsCollapsible
            defaultDetailsExpanded={false}
          />
        </Card>
      ) : (
        <Card className={`p-5 space-y-3 text-sm ${OPS_BODY}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCell
              label="Total labor"
              value={formatCurrency(estimate?.laborCost ?? 0)}
            />
            {estimate?.volumeYd != null && estimate.volumeYd > 0 && (
              <SummaryCell label="Volume" value={`${estimate.volumeYd.toFixed(1)} CY`} />
            )}
            {estimate?.adjustedLaborHours != null && estimate.adjustedLaborHours > 0 && (
              <SummaryCell
                label="Man-hours"
                value={estimate.adjustedLaborHours.toFixed(1)}
              />
            )}
            {crewSize > 0 && (
              <SummaryCell label="Crew size" value={String(crewSize)} />
            )}
          </div>
          {estimate?.inputs.finishType && (
            <p>
              Finish:{' '}
              <strong className={OPS_TITLE}>
                {titleCase(estimate.inputs.finishType)}
              </strong>
            </p>
          )}
          {(finishers > 0 || foremen > 0) && (
            <p>
              Crew mix:{' '}
              <strong className={OPS_TITLE}>
                {Math.max(0, crewSize - finishers - foremen)} laborers · {finishers} finishers
                {foremen > 0 ? ` · ${foremen} foreman` : ''}
              </strong>
            </p>
          )}
        </Card>
      )}
    </div>
  );
};

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${OPS_HERO_STAT_INNER} px-3 py-2`}>
      <p className={`text-[10px] uppercase tracking-wide ${OPS_HERO_STAT_LABEL}`}>
        {label}
      </p>
      <p className={`text-sm font-semibold ${OPS_HERO_STAT_VALUE} mt-0.5`}>{value}</p>
    </div>
  );
}

export default LaborEstimateDetails;
