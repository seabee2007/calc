import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import type { ConceptualEstimateController } from '../hooks/useConceptualEstimate';
import { RISK_LEVELS } from '../../domain/conceptualEstimateTypes';
import EstimateSummaryCard from './EstimateSummaryCard';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import {
  formatEstimateCurrency,
  formatEstimatePercent,
} from '../estimateFormatters';
import { PLANNER_MUTED, PLANNER_SECTION_TITLE, TEXT_BODY } from '../estimateWorkspaceTheme';

interface Props {
  controller: ConceptualEstimateController;
  disabled?: boolean;
}

export default function ConceptualRisksContingencyPanel({
  controller,
  disabled = false,
}: Props) {
  const { payload, rollup, addRisk, deleteRisk, setContingencyPercent } = controller;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [probability, setProbability] = useState<(typeof RISK_LEVELS)[number]>('medium');
  const [impact, setImpact] = useState<(typeof RISK_LEVELS)[number]>('medium');
  const [costExposure, setCostExposure] = useState('');
  const [mitigation, setMitigation] = useState('');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <EstimateSummaryCard
          label="Total risk exposure"
          value={formatEstimateCurrency(rollup.totalRiskExposure)}
        />
        <EstimateSummaryCard
          label="Recommended contingency"
          value={formatEstimatePercent(rollup.recommendedContingencyPercent)}
        />
        <EstimateSummaryCard
          label="Selected contingency"
          value={formatEstimatePercent(rollup.contingencyPercent)}
        />
      </div>

      <div className="max-w-xs">
        <Input
          label="Contingency %"
          value={String(payload.contingencyPercent)}
          disabled={disabled}
          onChange={(event) => setContingencyPercent(Number(event.target.value) || 0)}
        />
      </div>

      {payload.risks.length === 0 ? (
        <EstimateWorkspaceEmptyState
          title="No risks documented yet"
          body="Add risks with probability, impact, and cost exposure to inform contingency."
        />
      ) : null}

      <section className="space-y-3">
        <h2 className={PLANNER_SECTION_TITLE}>Risk register</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input
            label="Cost exposure"
            value={costExposure}
            onChange={(e) => setCostExposure(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label="Probability"
            value={probability}
            onChange={(level) => setProbability(level as (typeof RISK_LEVELS)[number])}
            options={RISK_LEVELS.map((level) => ({ value: level, label: level }))}
          />
          <Select
            label="Impact"
            value={impact}
            onChange={(level) => setImpact(level as (typeof RISK_LEVELS)[number])}
            options={RISK_LEVELS.map((level) => ({ value: level, label: level }))}
          />
        </div>
        <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label="Mitigation" value={mitigation} onChange={(e) => setMitigation(e.target.value)} />
        <Button
          disabled={disabled || !title.trim()}
          onClick={() => {
            addRisk({
              title: title.trim(),
              description: description.trim(),
              probability,
              impact,
              costExposure: Number(costExposure) || 0,
              mitigation: mitigation.trim() || null,
              includedInContingency: true,
            });
            setTitle('');
            setDescription('');
            setCostExposure('');
            setMitigation('');
          }}
        >
          Add risk
        </Button>

        <ul className="space-y-2">
          {payload.risks.map((risk) => (
            <li key={risk.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{risk.title}</p>
                  <p className={`text-sm ${TEXT_BODY}`}>{risk.description}</p>
                  <p className={`text-xs ${PLANNER_MUTED}`}>
                    {risk.probability} probability · {risk.impact} impact ·{' '}
                    {formatEstimateCurrency(risk.costExposure)}
                  </p>
                </div>
                <Button size="sm" variant="secondary" disabled={disabled} onClick={() => deleteRisk(risk.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
