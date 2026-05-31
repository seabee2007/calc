import React from 'react';
import type { PricingParams, TaxApplication, TaxSystem } from '../../types/pricingParams';
import Input from '../ui/Input';
import Select from '../ui/Select';
import TaxRatePercentInput from './TaxRatePercentInput';

const WASTE_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
];

const CONTINGENCY_PRESETS = [0, 2, 5, 10, 15];

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

const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

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
    <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      {showLegacyToggle && (
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
      )}

      {!isLegacy && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Waste factor
            </label>
            <select
              className={selectClass}
              value={String(params.wasteFactorPercent)}
              onChange={(e) =>
                set('wasteFactorPercent', Math.max(0, Number(e.target.value) || 0))
              }
            >
              {WASTE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Additional material allowance for waste, breakage, cutting loss, spillage,
              over-ordering, and field variation.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contingency %
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CONTINGENCY_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`rounded-md px-3 py-1 text-sm font-medium border ${
                    params.contingencyPercent === p
                      ? 'border-cyan-600 bg-cyan-600 text-white'
                      : 'border-gray-300 bg-white text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                  onClick={() => set('contingencyPercent', p)}
                >
                  {p}%
                </button>
              ))}
            </div>
            <Input
              label="Custom contingency %"
              type="number"
              min={0}
              step={0.5}
              value={params.contingencyPercent}
              onChange={(e) =>
                set('contingencyPercent', Math.max(0, Number(e.target.value) || 0))
              }
              fullWidth
            />
          </div>

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
          <TaxRatePercentInput
            label="Tax rate %"
            value={params.taxRatePercent}
            onChange={(rate) => set('taxRatePercent', rate)}
            fullWidth
          />
        </>
      )}

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
    </div>
  );
}
