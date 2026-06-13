import React from 'react';
import type { PricingParams, TaxApplication, TaxSystem } from '../../types/pricingParams';
import { TEXT_FOREGROUND } from '../../theme/appTheme';
import Select from '../ui/Select';
import DarkSelect from '../ui/DarkSelect';
import ClearableNumberInput from './ClearableNumberInput';
import TaxRatePercentInput from './TaxRatePercentInput';

const WASTE_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
];

const CONTINGENCY_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '2', label: '2%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
];

const TAX_SYSTEM_OPTIONS: { value: TaxSystem; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'sales_tax', label: 'Sales Tax' },
  { value: 'gross_receipts_tax', label: 'Gross Receipts Tax' },
  { value: 'vat', label: 'VAT' },
];

const TAX_APPLICATION_OPTIONS: { value: TaxApplication; label: string }[] = [
  { value: 'materials_only', label: 'Materials Only' },
  { value: 'materials_and_equipment', label: 'Materials + Equipment' },
  { value: 'entire_project', label: 'Entire Project' },
];

const groupClass =
  'rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700/70 dark:bg-slate-950/40';
const groupTitleClass = `mb-3 text-sm font-semibold ${TEXT_FOREGROUND}`;

interface PricingParamsEditorProps {
  params: PricingParams;
  onChange: (params: PricingParams) => void;
  showLegacyToggle?: boolean;
}

export default function PricingParamsEditor({
  params,
  onChange,
  showLegacyToggle = false,
}: PricingParamsEditorProps) {
  const set = <K extends keyof PricingParams>(key: K, value: PricingParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const isLegacy = params.pricingModel === 'legacy';

  return (
    <div className="space-y-4">
      {showLegacyToggle && (
        <div className={groupClass}>
          <Select
            label="Pricing model"
            value={params.pricingModel ?? 'standard'}
            onChange={(v) => set('pricingModel', v as PricingParams['pricingModel'])}
            options={[
              { value: 'standard', label: 'Standard (waste, tax, true margin)' },
              { value: 'legacy', label: 'Legacy (OH % + profit % on direct)' },
            ]}
            fullWidth
          />
        </div>
      )}

      {!isLegacy && (
        <>
          <section className={groupClass}>
            <h4 className={groupTitleClass}>Cost adjustments</h4>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DarkSelect
                label="Waste factor"
                value={String(params.wasteFactorPercent)}
                options={WASTE_OPTIONS}
                onChange={(next) =>
                  set('wasteFactorPercent', Math.max(0, Number(next) || 0))
                }
                helperText="Additional material allowance for waste, breakage, cutting loss, spillage, over-ordering, and field variation."
                fullWidth
                data-testid="waste-factor-select"
              />

              <DarkSelect
                label="Contingency %"
                value={String(params.contingencyPercent)}
                options={CONTINGENCY_OPTIONS}
                onChange={(next) =>
                  set('contingencyPercent', Math.max(0, Number(next) || 0))
                }
                fullWidth
                data-testid="contingency-percent-select"
              />
            </div>
          </section>

          <section className={groupClass}>
            <h4 className={groupTitleClass}>Tax</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Tax system"
                value={params.taxSystem}
                onChange={(v) => set('taxSystem', v as TaxSystem)}
                options={TAX_SYSTEM_OPTIONS}
                fullWidth
              />
              <Select
                label="Apply tax to"
                value={params.taxApplication}
                onChange={(v) => set('taxApplication', v as TaxApplication)}
                options={TAX_APPLICATION_OPTIONS}
                fullWidth
              />
            </div>
            <div className="mt-3">
              <TaxRatePercentInput
                label="Tax rate %"
                value={params.taxRatePercent}
                onChange={(rate) => set('taxRatePercent', rate)}
                fullWidth
              />
            </div>
          </section>
        </>
      )}

      <section className={groupClass}>
        <h4 className={groupTitleClass}>Fees & permits</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ClearableNumberInput
            label="Fees ($)"
            min={0}
            step={0.01}
            value={params.feesAmount}
            onChange={(next) => set('feesAmount', next)}
            fullWidth
            data-testid="proposal-fees-input"
          />
          <ClearableNumberInput
            label="Permits ($)"
            min={0}
            step={0.01}
            value={params.permitsAmount}
            onChange={(next) => set('permitsAmount', next)}
            fullWidth
            data-testid="proposal-permits-input"
          />
        </div>
      </section>

      <section className={groupClass}>
        <h4 className={groupTitleClass}>Margin / overhead</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ClearableNumberInput
            label={isLegacy ? 'Overhead % (of direct cost)' : 'Overhead %'}
            min={0}
            step={1}
            integer
            value={params.overheadPercent}
            onChange={(next) => set('overheadPercent', next)}
            fullWidth
            data-testid="proposal-overhead-input"
          />
          {isLegacy ? (
            <>
              <ClearableNumberInput
                label="Profit % (of direct cost)"
                min={0}
                step={1}
                integer
                value={params.profitPercent ?? 0}
                onChange={(next) => set('profitPercent', next)}
                fullWidth
              />
              <ClearableNumberInput
                label="Markup % (material only)"
                min={0}
                integer
                value={params.markupPercent ?? 0}
                onChange={(next) => set('markupPercent', next)}
                fullWidth
              />
            </>
          ) : (
            <ClearableNumberInput
              label="Target margin % (on price)"
              min={0}
              max={99}
              step={1}
              integer
              value={params.targetMarginPercent}
              onChange={(next) => set('targetMarginPercent', next)}
              fullWidth
              data-testid="proposal-target-margin-input"
            />
          )}
        </div>
      </section>
    </div>
  );
}
