import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, DollarSign, Info, Save, Sparkles, Users } from 'lucide-react';
import type { Calculation } from '../../types';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useLaborCalculatorState } from '../../hooks/useLaborCalculatorState';
import type { LaborEstimate } from '../../types/laborEstimate';
import LaborRatesItemized from '../labor/LaborRatesItemized';
import LaborTaskBreakdown, { LABOR_ESTIMATE_DISCLAIMER } from '../labor/LaborTaskBreakdown';
import { resolveConsistentAreaSqFt } from '../../utils/concreteLaborInputMapper';
import { optimizeLaborCrew, type CrewScenario } from '../../utils/laborCrewOptimizer';
import {
  reviewLaborCrewWithAi,
  type LaborCrewReviewResult,
} from '../../services/laborCrewReviewService';

interface LaborCalculatorPanelProps {
  calculation?: Calculation;
  savedEstimate?: LaborEstimate;
  onSave: (payload: ReturnType<
    ReturnType<typeof useLaborCalculatorState>['buildSavePayload']
  >) => Promise<void>;
  saveDisabled?: boolean;
}

const LaborCalculatorPanel: React.FC<LaborCalculatorPanelProps> = ({
  calculation,
  savedEstimate,
  onSave,
  saveDisabled,
}) => {
  const {
    inputs,
    setField,
    setInputs,
    volumeYd,
    laborInput,
    professionalLabor: est,
    applyFromCalculation,
    buildSavePayload,
    preferences,
  } = useLaborCalculatorState(calculation);

  const volumeLabel =
    preferences.volumeUnit === 'cubic_yards'
      ? 'yd³'
      : preferences.volumeUnit === 'cubic_feet'
        ? 'ft³'
        : 'm³';

  useEffect(() => {
    if (calculation) applyFromCalculation(calculation);
  }, [calculation?.id, applyFromCalculation]);

  useEffect(() => {
    if (savedEstimate?.inputs) {
      const { burdenedHourlyRate: _removed, ...rest } = savedEstimate.inputs as LaborEstimate['inputs'] & {
        burdenedHourlyRate?: string;
      };
      setInputs((prev) => ({ ...prev, ...rest }));
    }
  }, [savedEstimate?.id, setInputs]);

  const crew = parseInt(inputs.crewSize, 10) || 0;
  const finishers = parseInt(inputs.finishers, 10) || 0;
  const foremen = parseInt(inputs.foremen, 10) || 0;
  const laborers = Math.max(0, crew - finishers - foremen);

  const areaMeta = resolveConsistentAreaSqFt(
    calculation,
    inputs.slabSize,
    volumeYd,
    inputs.slabThicknessIn,
  );

  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState<string | null>(null);
  const [aiReview, setAiReview] = useState<LaborCrewReviewResult | null>(null);
  const [suggestedScenario, setSuggestedScenario] = useState<CrewScenario | null>(null);

  const optimization = useMemo(() => {
    if (volumeYd <= 0) return null;
    return optimizeLaborCrew(laborInput);
  }, [laborInput, volumeYd]);

  const handleAiCrewReview = async () => {
    if (!optimization || volumeYd <= 0 || !optimization.current) return;

    setAiReviewLoading(true);
    setAiReviewError(null);

    try {
      const review = await reviewLaborCrewWithAi({
        jobContext: {
          concreteYards: laborInput.concreteYards,
          areaSqFt: laborInput.areaSqFt,
          projectType: laborInput.projectType,
          placementMethod: laborInput.placementMethod,
          finishType: laborInput.finishType,
          accessDifficulty: laborInput.accessDifficulty,
          weatherCondition: laborInput.weatherCondition,
          reinforcementType: laborInput.reinforcementType,
          burdenMultiplier: laborInput.rates.burdenMultiplier,
          options: laborInput.options,
        },
        current: optimization.current,
        scenarios: optimization.scenarios,
      });

      const index = Math.min(
        Math.max(0, review.recommendedScenarioIndex),
        optimization.scenarios.length - 1,
      );
      const scenario = optimization.scenarios[index] ?? optimization.recommended;

      setAiReview(review);
      setSuggestedScenario(scenario);
    } catch (err) {
      setAiReview(null);
      setSuggestedScenario(null);
      setAiReviewError(
        err instanceof Error ? err.message : 'AI crew review failed.',
      );
    } finally {
      setAiReviewLoading(false);
    }
  };

  const applySuggestedCrew = () => {
    if (!suggestedScenario) return;
    setField('crewSize', String(suggestedScenario.crewSize));
    setField('finishers', String(suggestedScenario.finishers));
    setField('foremen', String(suggestedScenario.foremen));
  };

  const formatCurrency = (n: number) =>
    n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <LaborRatesItemized />

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-600" />
          Task-based labor estimate
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Labor is estimated by crew task and production rates — not a single CY/hour number.
          Each task applies placement, finish, access, and weather factors to base productivity.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input
            label={`Placement volume (${volumeLabel})`}
            type="number"
            min="0"
            step="0.1"
            value={inputs.manualVolume}
            onChange={(e) => setField('manualVolume', e.target.value)}
            helperText={
              calculation
                ? `From concrete calc: ${calculation.result.volume.toFixed(2)} ${volumeLabel}`
                : undefined
            }
          />
          <Input
            label="Slab / area (optional)"
            value={inputs.slabSize}
            onChange={(e) => setField('slabSize', e.target.value)}
            placeholder="e.g. 40 × 60 ft"
            helperText={
              volumeYd > 0
                ? 'If blank, area is derived from volume and thickness for finishing tasks.'
                : undefined
            }
          />
          {!calculation && (
            <Input
              label="Slab thickness (in)"
              type="number"
              min="0"
              step="0.5"
              value={inputs.slabThicknessIn}
              onChange={(e) => setField('slabThicknessIn', e.target.value)}
            />
          )}
          {areaMeta.areaSqFt > 0 && (
            <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Effective area: {Math.round(areaMeta.areaSqFt).toLocaleString()} ft² ·{' '}
              {areaMeta.thicknessInches.toFixed(1)} in thick
              {areaMeta.reconciledFromVolume && ' (from volume × thickness)'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label="Crew size (total)"
            type="number"
            min="1"
            value={inputs.crewSize}
            onChange={(e) => setField('crewSize', e.target.value)}
            helperText={`${laborers} laborers · ${finishers} finishers · ${foremen} foremen`}
          />
          <Input
            label="Finishers"
            type="number"
            min="0"
            value={inputs.finishers}
            onChange={(e) => setField('finishers', e.target.value)}
          />
          <Input
            label="Foremen"
            type="number"
            min="0"
            value={inputs.foremen}
            onChange={(e) => setField('foremen', e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Placement & finishing
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Placement method"
            value={inputs.placementMethod || 'chute'}
            onChange={(v) => setField('placementMethod', v)}
            options={[
              { value: 'chute', label: 'Chute' },
              { value: 'pump', label: 'Pump' },
              { value: 'buggy', label: 'Buggy' },
              { value: 'bucket', label: 'Wheelbarrow / bucket' },
              { value: 'conveyor', label: 'Conveyor (as chute)' },
            ]}
          />
          <Select
            label="Finish type"
            value={inputs.finishType}
            onChange={(v) => setField('finishType', v)}
            options={[
              { value: 'broom', label: 'Broom' },
              { value: 'hard_trowel', label: 'Hard trowel' },
              { value: 'burnished', label: 'Burnished' },
              { value: 'stamp', label: 'Stamp' },
              { value: 'exposed_aggregate', label: 'Exposed aggregate' },
            ]}
          />
          <Select
            label="Access difficulty"
            value={inputs.accessDifficulty}
            onChange={(v) => setField('accessDifficulty', v)}
            options={[
              { value: 'auto', label: 'Auto from placement method' },
              { value: 'easy', label: 'Easy' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'difficult', label: 'Difficult' },
              { value: 'severe', label: 'Severe' },
            ]}
          />
          <Select
            label="Weather"
            value={inputs.weatherCondition}
            onChange={(v) => setField('weatherCondition', v)}
            options={[
              { value: 'auto', label: 'Auto (normal)' },
              { value: 'normal', label: 'Normal' },
              { value: 'hot', label: 'Hot' },
              { value: 'extreme_hot', label: 'Extreme hot' },
              { value: 'rainy', label: 'Rainy' },
              { value: 'windy', label: 'Windy / cold' },
            ]}
          />
          <Select
            label="Reinforcement"
            value={inputs.reinforcementType}
            onChange={(v) => setField('reinforcementType', v)}
            options={[
              { value: 'auto', label: 'Auto from complexity' },
              { value: 'none', label: 'None' },
              { value: 'wire_mesh', label: 'Wire mesh' },
              { value: 'rebar_single_mat', label: 'Rebar — single mat' },
              { value: 'rebar_double_mat', label: 'Rebar — double mat' },
            ]}
          />
          <Select
            label="Complexity (auto reinforcement)"
            value={inputs.complexityFactor}
            onChange={(v) => setField('complexityFactor', v)}
            options={[
              { value: 'auto', label: 'Auto from calc type' },
              { value: 'open_slab', label: 'Open slab' },
              { value: 'heavy_rebar', label: 'Heavy rebar' },
              { value: 'curbs_edges', label: 'Curbs / edges' },
              { value: 'tight_access', label: 'Tight access' },
            ]}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Options & burden
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Burden multiplier"
            type="number"
            min="1"
            max="2"
            step="0.01"
            value={inputs.burdenMultiplier}
            onChange={(e) => setField('burdenMultiplier', e.target.value)}
            helperText="Applied to base trade rates (payroll, WC, overhead)"
          />
          <Input
            label="Overtime multiplier"
            type="number"
            min="1"
            step="0.1"
            value={inputs.overtimeMultiplier}
            onChange={(e) => setField('overtimeMultiplier', e.target.value)}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            { key: 'vaporBarrier' as const, label: 'Vapor barrier / base prep' },
            { key: 'curingCompound' as const, label: 'Curing compound' },
            { key: 'sawCutJoints' as const, label: 'Saw-cut joints' },
            { key: 'includeCleanup' as const, label: 'Include cleanup / demobilization' },
            { key: 'includeContingency' as const, label: 'Include contingency (10%)' },
            { key: 'smallJobMinimum' as const, label: 'Small job minimum (4 crew-hrs)' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                checked={inputs[key] === 'true'}
                onChange={(e) => setField(key, e.target.checked ? 'true' : 'false')}
              />
              <span className="text-gray-700 dark:text-gray-300">{label}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="p-6 border border-cyan-200/60 dark:border-cyan-800/50">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-600" />
              AI crew review (optional)
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-xl">
              Set placement, finishing, and burden options above first — then run AI review for an
              economical crew mix that balances labor cost and pour-day duration. You can still
              enter crew size manually anytime.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            icon={<Sparkles size={16} />}
            disabled={aiReviewLoading || volumeYd <= 0}
            onClick={() => void handleAiCrewReview()}
          >
            {aiReviewLoading ? 'Reviewing…' : 'Review crew with AI'}
          </Button>
        </div>

        {aiReviewError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{aiReviewError}</p>
        )}

        {aiReview && suggestedScenario && optimization && (
          <div className="mt-4 rounded-lg bg-cyan-50/80 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-800/50 p-4 space-y-3">
            <p className="text-sm text-gray-800 dark:text-gray-200">{aiReview.summary}</p>
            {aiReview.tradeoffs && (
              <p className="text-xs text-gray-600 dark:text-gray-400">{aiReview.tradeoffs}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Suggested crew</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {suggestedScenario.laborers} laborers · {suggestedScenario.finishers} finishers
                  {suggestedScenario.foremen > 0 ? ` · ${suggestedScenario.foremen} foreman` : ''}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Est. pour day</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {suggestedScenario.billableJobDurationHours.toFixed(1)} hr
                  {suggestedScenario.overtimeJobHours > 0
                    ? ` (${suggestedScenario.overtimeJobHours.toFixed(1)} hr OT)`
                    : ''}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  Est. labor cost
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(suggestedScenario.totalLaborCost)}
                  {optimization.current &&
                    optimization.current.totalLaborCost > suggestedScenario.totalLaborCost && (
                    <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                      saves{' '}
                      {formatCurrency(
                        optimization.current.totalLaborCost - suggestedScenario.totalLaborCost,
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button type="button" className="w-full sm:w-auto" onClick={applySuggestedCrew}>
              Apply suggested crew
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          Labor estimate summary
        </h3>

        {volumeYd > 0 && est ? (
          <>
            <LaborTaskBreakdown
              input={laborInput}
              result={est}
              formatCurrency={formatCurrency}
              areaReconciledFromVolume={
                areaMeta.reconciledFromVolume || est.areaReconciledFromVolume
              }
            />

            <p className="mt-4 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-md p-3">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              {LABOR_ESTIMATE_DISCLAIMER}
            </p>

            <Button
              type="button"
              className="mt-4 w-full sm:w-auto"
              icon={<Save size={18} />}
              disabled={saveDisabled || est.costs.totalLaborCost <= 0}
              onClick={() => void onSave(buildSavePayload())}
            >
              Save labor estimate to project
            </Button>
          </>
        ) : (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Enter placement volume or link a concrete calculation to run the task-based estimate.
          </p>
        )}
      </Card>
    </div>
  );
};

export default LaborCalculatorPanel;
