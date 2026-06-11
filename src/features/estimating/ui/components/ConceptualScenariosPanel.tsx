import { useState } from 'react';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type { ConceptualEstimateController } from '../hooks/useConceptualEstimate';
import EstimateWorkspaceEmptyState from './EstimateWorkspaceEmptyState';
import { formatEstimateCurrency } from '../estimateFormatters';
import { PLANNER_MUTED, PLANNER_SECTION_TITLE } from '../estimateWorkspaceTheme';

interface Props {
  controller: ConceptualEstimateController;
  disabled?: boolean;
}

export default function ConceptualScenariosPanel({ controller, disabled = false }: Props) {
  const { payload, addScenario, duplicateBudgetAsScenario, deleteScenario, selectScenario } =
    controller;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="space-y-4">
      {payload.scenarios.length === 0 ? (
        <EstimateWorkspaceEmptyState
          title="No scenarios yet"
          body="Create scenarios or duplicate the current budget to compare totals side by side."
        />
      ) : null}

      <section className="space-y-3">
        <h2 className={PLANNER_SECTION_TITLE}>Create scenario</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input label="Scenario name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled || !name.trim()}
            onClick={() => {
              addScenario({ name: name.trim(), description: description.trim() || null });
              setName('');
              setDescription('');
            }}
          >
            Create empty scenario
          </Button>
          <Button
            variant="secondary"
            disabled={disabled || !name.trim() || payload.lineItems.length === 0}
            onClick={() => {
              duplicateBudgetAsScenario(name.trim(), description.trim() || undefined);
              setName('');
              setDescription('');
            }}
          >
            Duplicate current budget
          </Button>
        </div>
      </section>

      {payload.scenarios.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Scenario</th>
                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
                <th className="px-3 py-2 text-right font-semibold">Contingency</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payload.scenarios.map((scenario) => {
                const isSelected = payload.selectedScenarioId === scenario.id;
                return (
                  <tr
                    key={scenario.id}
                    className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : undefined}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{scenario.name}</p>
                      {scenario.description ? (
                        <p className={`text-xs ${PLANNER_MUTED}`}>{scenario.description}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEstimateCurrency(scenario.subtotal)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEstimateCurrency(scenario.contingency)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEstimateCurrency(scenario.total)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={disabled}
                          onClick={() => selectScenario(isSelected ? null : scenario.id)}
                        >
                          {isSelected ? 'Deselect' : 'Select'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={disabled}
                          onClick={() => deleteScenario(scenario.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
