import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import type { ConceptualEstimateController } from '../hooks/useConceptualEstimate';
import { ASSUMPTION_IMPACTS, type AssumptionImpact } from '../../domain/conceptualEstimateTypes';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import { PLANNER_MUTED, PLANNER_SECTION_TITLE, TEXT_BODY } from '../estimateWorkspaceTheme';
import { formatEstimateCurrency } from '../estimateFormatters';
import {
  hasMeaningfulAllowanceNoteDraft,
  hasMeaningfulAssumptionDraft,
  hasMeaningfulExclusionDraft,
} from '../hooks/useConceptualEstimate';

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
    draftItems,
    updateAssumptionDraft,
    updateExclusionDraft,
    updateAllowanceNoteDraft,
    commitAssumptionDraft,
    commitExclusionDraft,
    commitAllowanceNoteDraft,
    deleteAssumption,
    deleteExclusion,
    deleteAllowanceNote,
  } = controller;

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
          <Input
            label="Title"
            value={draftItems.assumption.title}
            onChange={(e) => updateAssumptionDraft({ title: e.target.value })}
          />
          <Select
            label="Impact"
            value={draftItems.assumption.impact}
            onChange={(impact) =>
              updateAssumptionDraft({ impact: impact as AssumptionImpact })
            }
            options={ASSUMPTION_IMPACTS.map((impact) => ({ value: impact, label: impact }))}
          />
        </div>
        <Input
          label="Description"
          value={draftItems.assumption.description}
          onChange={(e) => updateAssumptionDraft({ description: e.target.value })}
        />
        <Button
          disabled={disabled || !hasMeaningfulAssumptionDraft(draftItems.assumption)}
          onClick={commitAssumptionDraft}
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
          <Input
            label="Title"
            value={draftItems.exclusion.title}
            onChange={(e) => updateExclusionDraft({ title: e.target.value })}
          />
          <Input
            label="Reason"
            value={draftItems.exclusion.reason}
            onChange={(e) => updateExclusionDraft({ reason: e.target.value })}
          />
        </div>
        <Input
          label="Description"
          value={draftItems.exclusion.description}
          onChange={(e) => updateExclusionDraft({ description: e.target.value })}
        />
        <Button
          disabled={disabled || !hasMeaningfulExclusionDraft(draftItems.exclusion)}
          onClick={commitExclusionDraft}
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
          <Input
            label="Title"
            value={draftItems.allowanceNote.title}
            onChange={(e) => updateAllowanceNoteDraft({ title: e.target.value })}
          />
          <Input
            label="Included amount"
            value={draftItems.allowanceNote.includedAmount}
            onChange={(e) => updateAllowanceNoteDraft({ includedAmount: e.target.value })}
          />
        </div>
        <Input
          label="Description"
          value={draftItems.allowanceNote.description}
          onChange={(e) => updateAllowanceNoteDraft({ description: e.target.value })}
        />
        <Button
          disabled={disabled || !hasMeaningfulAllowanceNoteDraft(draftItems.allowanceNote)}
          onClick={commitAllowanceNoteDraft}
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
