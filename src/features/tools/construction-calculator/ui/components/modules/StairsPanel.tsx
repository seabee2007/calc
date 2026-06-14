import React, { useMemo, useState } from 'react';
import { DEFAULT_FRACTION_PRECISION } from '../../../domain/constructionCalculatorTypes';
import { calculateStairs } from '../../../domain/modules/stairsModule';
import {
  ModuleNumberField,
  ModuleResultRow,
  parseFeet,
  parseInches,
} from './modulePanelShared';

export default function StairsPanel() {
  const [totalRiseFt, setTotalRiseFt] = useState('9');
  const [totalRiseIn, setTotalRiseIn] = useState('4');
  const [risers, setRisers] = useState('15');
  const [treadDepth, setTreadDepth] = useState('10');

  const result = useMemo(() => {
    const totalRiseInches = parseFeet(totalRiseFt) + parseInches(totalRiseIn);
    return calculateStairs({
      totalRiseInches,
      riserCount: parseInt(risers, 10) || 1,
      treadDepthInches: parseInches(treadDepth),
      precision: DEFAULT_FRACTION_PRECISION,
    });
  }, [totalRiseFt, totalRiseIn, risers, treadDepth]);

  return (
    <div className="space-y-4" data-testid="stairs-panel">
      <p className="rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200">
        Verify stair dimensions against local code before construction.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModuleNumberField label="Total rise (ft)" value={totalRiseFt} onChange={setTotalRiseFt} unit="ft" />
        <ModuleNumberField label="Total rise (in)" value={totalRiseIn} onChange={setTotalRiseIn} unit="in" />
        <ModuleNumberField label="Number of risers" value={risers} onChange={setRisers} />
        <ModuleNumberField label="Tread depth" value={treadDepth} onChange={setTreadDepth} unit="in" />
      </div>
      <ModuleResultRow label="Riser height" value={result.riserHeightFormatted} />
      <ModuleResultRow label="Number of treads" value={String(result.treadCount)} />
      <ModuleResultRow label="Total run" value={result.totalRunFormatted} />
      <ModuleResultRow label="Stair angle" value={`${result.angleDegrees}°`} />
      {result.warnings.map((w) => (
        <p key={w} className="text-sm text-amber-600 dark:text-amber-400">
          {w}
        </p>
      ))}
    </div>
  );
}
