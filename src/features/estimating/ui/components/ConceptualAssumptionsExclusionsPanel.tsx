import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import type { ConceptualEstimateController } from '../hooks/useConceptualEstimate';
import { ASSUMPTION_IMPACTS } from '../../domain/conceptualEstimateTypes';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import { PLANNER_MUTED, PLANNER_SECTION_TITLE, TEXT_BODY } from '../estimateWorkspaceTheme';
import { formatEstimateCurrency } from '../estimateFormatters';

interface Props {
  controller: ConceptualEstimateController;
  disabled?: boolean;
}

export default function ConceptualAssumptionsExclusionsPanel({
  controller,
  disabled = false,
}: Props) {
  const {
    payload,
    addAssumption,
    deleteAssumption,
    addExclusion,
    deleteExclusion,
    addAllowanceNote,
    deleteAllowanceNote,
  } = controller;

  const [assumptionTitle, setAssumptionTitle] = useState('');
  const [assumptionDescription, setAssumptionDescription] = useState('');
  const [assumptionImpact, setAssumptionImpact] = useState<(typeof ASSUMPTION_IMPACTS)[number]>('cost');

  const [exclusionTitle, setExclusionTitle] = useState('');
  const [exclusionDescription, setExclusionDescription] = useState('');
  const [exclusionReason, setExclusionReason] = useState('');

  const [allowanceTitle, setAllowanceTitle] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [allowanceDescription, setAllowanceDescription] = useState('');

  const hasAny =
    payload.assumptions.length > 0 ||
    payload.exclusions.length > 0 ||
    payload.allowanceNotes.length > 0;

  return (
    <div className="space-y-6">
      {!hasAny ? (
        <EstimateWorkspaceEmptyState
          title="No assumptions or exclusions yet"
          body="Document assumptions, exclusions, and allowance notes that support the conceptual budget."
        />
      ) : null}

      <section className="space-y-3">
        <h2 className={PLANNER_SECTION_TITLE}>Assumptions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Title" value={assumptionTitle} onChange={(e) => setAssumptionTitle(e.target.value)} />
          <Select
            label="Impact"
            value={assumptionImpact}
            onChange={(impact) =>
              setAssumptionImpact(impact as (typeof ASSUMPTION_IMPACTS)[number])
            }
            options={ASSUMPTION_IMPACTS.map((impact) => ({ value: impact, label: impact }))}
          />
        </div>
        <Input
          label="Description"
          value={assumptionDescription}
          onChange={(e) => setAssumptionDescription(e.target.value)}
        />
        <Button
          disabled={disabled || !assumptionTitle.trim()}
          onClick={() => {
            addAssumption({
              title: assumptionTitle.trim(),
              description: assumptionDescription.trim(),
              impact: assumptionImpact,
            });
            setAssumptionTitle('');
            setAssumptionDescription('');
          }}
        >
          Add assumption
        </Button>
        <ul className="space-y-2">
          {payload.assumptions.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className={`text-sm ${TEXT_BODY}`}>{item.description}</p>
                  <p className={`text-xs ${PLANNER_MUTED}`}>Impact: {item.impact}</p>
                </div>
                <Button size="sm" variant="secondary" disabled={disabled} onClick={() => deleteAssumption(item.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={PLANNER_SECTION_TITLE}>Exclusions</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Title" value={exclusionTitle} onChange={(e) => setExclusionTitle(e.target.value)} />
          <Input label="Reason" value={exclusionReason} onChange={(e) => setExclusionReason(e.target.value)} />
        </div>
        <Input
          label="Description"
          value={exclusionDescription}
          onChange={(e) => setExclusionDescription(e.target.value)}
        />
        <Button
          disabled={disabled || !exclusionTitle.trim()}
          onClick={() => {
            addExclusion({
              title: exclusionTitle.trim(),
              description: exclusionDescription.trim(),
              reason: exclusionReason.trim(),
            });
            setExclusionTitle('');
            setExclusionDescription('');
            setExclusionReason('');
          }}
        >
          Add exclusion
        </Button>
        <ul className="space-y-2">
          {payload.exclusions.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className={`text-sm ${TEXT_BODY}`}>{item.description}</p>
                  <p className={`text-xs ${PLANNER_MUTED}`}>Reason: {item.reason}</p>
                </div>
                <Button size="sm" variant="secondary" disabled={disabled} onClick={() => deleteExclusion(item.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={PLANNER_SECTION_TITLE}>Allowance notes</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Title" value={allowanceTitle} onChange={(e) => setAllowanceTitle(e.target.value)} />
          <Input
            label="Included amount"
            value={allowanceAmount}
            onChange={(e) => setAllowanceAmount(e.target.value)}
          />
        </div>
        <Input
          label="Description"
          value={allowanceDescription}
          onChange={(e) => setAllowanceDescription(e.target.value)}
        />
        <Button
          disabled={disabled || !allowanceTitle.trim()}
          onClick={() => {
            addAllowanceNote({
              title: allowanceTitle.trim(),
              includedAmount: Number(allowanceAmount) || 0,
              description: allowanceDescription.trim(),
            });
            setAllowanceTitle('');
            setAllowanceAmount('');
            setAllowanceDescription('');
          }}
        >
          Add allowance note
        </Button>
        <ul className="space-y-2">
          {payload.allowanceNotes.map((item) => (
            <li key={item.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className={`text-sm ${TEXT_BODY}`}>{item.description}</p>
                  <p className={`text-xs ${PLANNER_MUTED}`}>
                    Included: {formatEstimateCurrency(item.includedAmount)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => deleteAllowanceNote(item.id)}
                >
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
