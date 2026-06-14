import React, { useMemo, useState } from 'react';
import { calculateRightTriangle } from '../../../domain/modules/rightTriangleModule';
import { formatFeetInchesFraction } from '../../../domain/constructionDimensionMath';
import { DEFAULT_FRACTION_PRECISION } from '../../../domain/constructionCalculatorTypes';
import {
  ModuleNumberField,
  ModuleResultRow,
  parseInches,
} from './modulePanelShared';

export default function RightTrianglePanel() {
  const [rise, setRise] = useState('');
  const [run, setRun] = useState('12');
  const [pitchRise, setPitchRise] = useState('4');
  const [mode, setMode] = useState<'rise-run' | 'pitch'>('pitch');

  const result = useMemo(() => {
    if (mode === 'pitch') {
      return calculateRightTriangle({
        pitchRise: parseFloat(pitchRise) || 0,
        pitchRun: 12,
      });
    }
    return calculateRightTriangle({
      riseInches: parseInches(rise),
      runInches: parseInches(run),
    });
  }, [mode, rise, run, pitchRise]);

  if (!result) {
    return <p className="text-sm text-slate-500">Enter at least two values to solve.</p>;
  }

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
        <ModuleNumberField label="Pitch rise (per 12 in run)" value={pitchRise} onChange={setPitchRise} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ModuleNumberField label="Rise" value={rise} onChange={setRise} unit="in" />
          <ModuleNumberField label="Run" value={run} onChange={setRun} unit="in" />
        </div>
      )}
      <ModuleResultRow label="Rise" value={formatFeetInchesFraction(result.riseInches, DEFAULT_FRACTION_PRECISION)} />
      <ModuleResultRow label="Run" value={formatFeetInchesFraction(result.runInches, DEFAULT_FRACTION_PRECISION)} />
      <ModuleResultRow label="Diagonal" value={formatFeetInchesFraction(result.diagonalInches, DEFAULT_FRACTION_PRECISION)} />
      <ModuleResultRow label="Pitch" value={`${result.pitchRise}:${result.pitchRun}`} />
      <ModuleResultRow label="Angle" value={`${result.angleDegrees}°`} />
      <ModuleResultRow
        label="Common rafter length"
        value={formatFeetInchesFraction(result.commonRafterLengthInches, DEFAULT_FRACTION_PRECISION)}
      />
    </div>
  );
}
