import React, { useMemo, useState } from 'react';
import { calculateRightTriangle } from '../../../domain/modules/rightTriangleModule';
import { formatFeetInchesFraction } from '../../../domain/constructionDimensionMath';
import { buildDimensionFromDecimal } from '../../../domain/constructionCalculatorFormatters';
import type { CalculatorInputController } from '../../hooks/useCalculatorInputController';
import DimensionSlot from '../slots/DimensionSlot';
import NumberSlot from '../slots/NumberSlot';
import { ModuleResultRow } from './modulePanelShared';

interface RightTrianglePanelProps {
  controller: CalculatorInputController;
}

export default function RightTrianglePanel({ controller }: RightTrianglePanelProps) {
  const [mode, setMode] = useState<'rise-run' | 'pitch'>('pitch');
  const precision = controller.state.precision;

  const rise = controller.getSlotValue('triangle', 'rise');
  const run = controller.getSlotValue('triangle', 'run');
  const diagonal = controller.getSlotValue('triangle', 'diagonal');
  const pitchRise = controller.getSlotValue('triangle', 'pitchRise');

  const result = useMemo(() => {
    if (mode === 'pitch') {
      if (pitchRise === null) return null;
      return calculateRightTriangle({ pitchRise, pitchRun: 12 });
    }
    if (rise === null && run === null && diagonal === null) return null;
    return calculateRightTriangle({
      riseInches: rise ?? undefined,
      runInches: run ?? undefined,
      diagonalInches: diagonal ?? undefined,
    });
  }, [mode, rise, run, diagonal, pitchRise]);

  return (
    <div className="space-y-4" data-testid="triangle-panel">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('pitch')}
          className={`rounded px-3 py-1 text-sm ${mode === 'pitch' ? 'bg-cyan-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
          Pitch
        </button>
        <button
          type="button"
          onClick={() => setMode('rise-run')}
          className={`rounded px-3 py-1 text-sm ${mode === 'rise-run' ? 'bg-cyan-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}
        >
          Rise / Run
        </button>
      </div>
      {mode === 'pitch' ? (
        <NumberSlot
          moduleId="triangle"
          slotId="pitchRise"
          label="TRIANGLE · PITCH RISE (per 12 in run)"
          controller={controller}
          allowNegative={false}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <DimensionSlot moduleId="triangle" slotId="rise" label="TRIANGLE · RISE" controller={controller} />
          <DimensionSlot moduleId="triangle" slotId="run" label="TRIANGLE · RUN" controller={controller} />
          <DimensionSlot moduleId="triangle" slotId="diagonal" label="TRIANGLE · DIAGONAL" controller={controller} />
        </div>
      )}
      {result && (
        <>
          <ModuleResultRow
            label="Rise"
            value={formatFeetInchesFraction(result.riseInches, precision)}
            sendValue={buildDimensionFromDecimal(result.riseInches)}
            controller={controller}
          />
          <ModuleResultRow
            label="Run"
            value={formatFeetInchesFraction(result.runInches, precision)}
            sendValue={buildDimensionFromDecimal(result.runInches)}
            controller={controller}
          />
          <ModuleResultRow
            label="Diagonal"
            value={formatFeetInchesFraction(result.diagonalInches, precision)}
            sendValue={buildDimensionFromDecimal(result.diagonalInches)}
            controller={controller}
          />
          <ModuleResultRow label="Pitch" value={`${result.pitchRise}:${result.pitchRun}`} />
          <ModuleResultRow label="Angle" value={`${result.angleDegrees}°`} />
          <ModuleResultRow
            label="Common rafter length"
            value={formatFeetInchesFraction(result.commonRafterLengthInches, precision)}
            sendValue={buildDimensionFromDecimal(result.commonRafterLengthInches)}
            controller={controller}
          />
        </>
      )}
    </div>
  );
}
