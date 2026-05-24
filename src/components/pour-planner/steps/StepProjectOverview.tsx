import React from 'react';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import type { PourPlannerContext } from '../../../hooks/usePourPlannerState';

interface StepProps {
  planner: PourPlannerContext;
}

export const StepProjectOverview: React.FC<StepProps> = ({ planner }) => {
  const { form, setField, projects, preferences, calculation } = planner;
  const projectCalculations =
    projects.find((p) => p.id === form.projectId)?.calculations ?? [];

  const volumeLabel =
    preferences.volumeUnit === 'cubic_yards'
      ? 'yd³'
      : preferences.volumeUnit === 'cubic_feet'
        ? 'ft³'
        : 'm³';

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Project overview
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Set the pour identity, location, and volume. The snapshot above updates as you go.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Project name"
            value={form.projectName}
            onChange={(e) => setField('projectName', e.target.value)}
            placeholder="e.g. Main St slab pour"
          />
          <Input
            label="Pour start time"
            type="time"
            value={form.pourStartTime}
            onChange={(e) => setField('pourStartTime', e.target.value)}
          />
          <Input
            label="Jobsite address"
            value={form.jobsiteAddress}
            onChange={(e) => setField('jobsiteAddress', e.target.value)}
            placeholder="Delivery location"
            className="sm:col-span-2"
          />
          <Input
            label="Batch plant address"
            value={form.batchPlantAddress}
            onChange={(e) => setField('batchPlantAddress', e.target.value)}
            placeholder="Ready-mix plant"
            className="sm:col-span-2"
          />
          <Select
            label="Placement method"
            options={[
              { value: '', label: 'Select method…' },
              { value: 'chute', label: 'Chute' },
              { value: 'pump', label: 'Pump truck' },
              { value: 'conveyor', label: 'Conveyor' },
              { value: 'buggy', label: 'Buggy' },
              { value: 'bucket', label: 'Crane bucket' },
            ]}
            value={form.placementMethod}
            onChange={(v) =>
              setField('placementMethod', v as typeof form.placementMethod)
            }
          />
        </div>
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          Concrete volume
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.length > 0 && (
            <>
              <Select
                label="Saved project (optional)"
                options={[
                  { value: '', label: 'No project — enter volume below' },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                value={form.projectId}
                onChange={(id) => {
                  setField('projectId', id);
                  setField('calculationId', '');
                }}
              />
              {form.projectId && projectCalculations.length > 0 && (
                <Select
                  label="Calculation"
                  options={[
                    { value: '', label: 'Select a calculation…' },
                    ...projectCalculations.map((c) => ({
                      value: c.id,
                      label: `${c.type.replace(/_/g, ' ')} — ${c.result.volume.toFixed(2)} ${volumeLabel}`,
                    })),
                  ]}
                  value={form.calculationId}
                  onChange={(v) => setField('calculationId', v)}
                />
              )}
            </>
          )}
          {!calculation && (
            <Input
              label={`Volume (${volumeLabel})`}
              type="number"
              min="0"
              step="0.01"
              value={form.manualVolume}
              onChange={(e) => setField('manualVolume', e.target.value)}
              placeholder="e.g. 40"
              className={projects.length > 0 ? 'sm:col-span-2' : ''}
            />
          )}
        </div>
      </section>
    </div>
  );
};

export default StepProjectOverview;
