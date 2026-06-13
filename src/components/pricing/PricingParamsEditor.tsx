import React from 'react';
import type { PricingParams, TaxApplication, TaxSystem } from '../../types/pricingParams';
import Input from '../ui/Input';
import Select from '../ui/Select';
import DarkSelect from '../ui/DarkSelect';
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

const groupClass = 'rounded-xl border border-slate-700/70 bg-slate-950/40 p-4';
const groupTitleClass = 'mb-3 text-sm font-semibold text-slate-100';

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
          <Input
            label="Fees ($)"
            type="number"
            min={0}
            step={0.01}
            value={params.feesAmount}
            onChange={(e) =>
              set('feesAmount', Math.max(0, Number(e.target.value) || 0))
            }
            fullWidth
          />
          <Input
            label="Permits ($)"
            type="number"
            min={0}
            step={0.01}
            value={params.permitsAmount}
            onChange={(e) =>
              set('permitsAmount', Math.max(0, Number(e.target.value) || 0))
            }
            fullWidth
          />
        </div>
      </section>

      <section className={groupClass}>
        <h4 className={groupTitleClass}>Margin / overhead</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={isLegacy ? 'Overhead % (of direct cost)' : 'Overhead %'}
            type="number"
            min={0}
            step={1}
            value={params.overheadPercent}
            onChange={(e) =>
              set('overheadPercent', Math.max(0, Number(e.target.value) || 0))
            }
            fullWidth
          />
          {isLegacy ? (
            <>
              <Input
                label="Profit % (of direct cost)"
                type="number"
                min={0}
                step={1}
                value={params.profitPercent ?? 0}
                onChange={(e) =>
                  set('profitPercent', Math.max(0, Number(e.target.value) || 0))
                }
                fullWidth
              />
              <Input
                label="Markup % (material only)"
                type="number"
                min={0}
                value={params.markupPercent ?? 0}
                onChange={(e) =>
                  set('markupPercent', Math.max(0, Number(e.target.value) || 0))
                }
                fullWidth
              />
            </>
          ) : (
            <Input
              label="Target margin % (on price)"
              type="number"
              min={0}
              max={99}
              step={1}
              value={params.targetMarginPercent}
              onChange={(e) =>
                set(
                  'targetMarginPercent',
                  Math.min(99, Math.max(0, Number(e.target.value) || 0)),
                )
              }
              fullWidth
            />
          )}
        </div>
      </section>
    </div>
  );
}
