import React, { useMemo } from 'react';
import { calculateStairs } from '../../../domain/modules/stairsModule';
import { buildDimensionFromDecimal } from '../../../domain/constructionCalculatorFormatters';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import NumberSlot from '../slots/NumberSlot';
import { ModuleResultRow } from './modulePanelShared';

interface StairsPanelProps {
  controller: CalculatorInputController;
}

export default function StairsPanel({ controller }: StairsPanelProps) {
  const precision = controller.state.precision;
  const totalRise = controller.getSlotValue('stairs', 'totalRise');
  const riserCount = controller.getSlotValue('stairs', 'riserCount');
  const treadDepth = controller.getSlotValue('stairs', 'treadDepth');

  const result = useMemo(() => {
    if (totalRise === null) return null;
    return calculateStairs({
      totalRiseInches: totalRise,
      riserCount: Math.max(1, Math.round(riserCount ?? 15)),
      treadDepthInches: treadDepth ?? 10,
      precision,
    });
  }, [totalRise, riserCount, treadDepth, precision]);

  return (
    <div className="space-y-4" data-testid="stairs-panel">
      <p className="rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
        Verify stair dimensions against local code before construction.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <DimensionSlot
          moduleId="stairs"
          slotId="totalRise"
          label="STAIRS · TOTAL RISE"
          controller={controller}
        />
        <NumberSlot
          moduleId="stairs"
          slotId="riserCount"
          label="STAIRS · NUMBER OF RISERS"
          controller={controller}
          allowNegative={false}
        />
        <DimensionSlot
          moduleId="stairs"
          slotId="treadDepth"
          label="STAIRS · TREAD DEPTH"
          controller={controller}
        />
      </div>
      {result && (
        <>
          <ModuleResultRow
            label="Riser height"
            value={result.riserHeightFormatted}
            sendValue={buildDimensionFromDecimal(result.riserHeightInches)}
            controller={controller}
          />
          <ModuleResultRow label="Number of treads" value={String(result.treadCount)} />
          <ModuleResultRow
            label="Total run"
            value={result.totalRunFormatted}
            sendValue={buildDimensionFromDecimal(result.totalRunInches)}
            controller={controller}
          />
          <ModuleResultRow label="Stair angle" value={`${result.angleDegrees}°`} />
          {result.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-600 dark:text-amber-400">
              {w}
            </p>
          ))}
        </>
      )}
    </div>
  );
}
