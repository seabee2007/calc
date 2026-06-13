import React, { useEffect, useState } from 'react';
import {
  AppCostCategory,
  DEFAULT_TAX_CATEGORY_MAP,
  loadTaxCategoryMap,
  saveTaxCategoryMap,
  type TaxCategoryMap,
} from '../../utils/accountingExport';
import Input from '../ui/Input';
import Button from '../ui/Button';

const CATEGORY_DISPLAY: Record<AppCostCategory, string> = {
  labor: 'Labor (incl. subcontractors)',
  materials: 'Materials / Supplies (incl. equipment)',
  equipment: 'Equipment Rental',
  subcontractors: 'Subcontractors',
  change_orders: 'Change Orders',
};

interface TaxCategoryMappingProps {
  onChange?: (map: TaxCategoryMap) => void;
}

const TaxCategoryMapping: React.FC<TaxCategoryMappingProps> = ({ onChange }) => {
  const [map, setMap] = useState<TaxCategoryMap>(() => loadTaxCategoryMap());
  const [saved, setSaved] = useState(false);

  const categories = Object.keys(DEFAULT_TAX_CATEGORY_MAP) as AppCostCategory[];

  function handleChange(cat: AppCostCategory, value: string) {
    const trimmed = value.trim();
    const next: TaxCategoryMap = {
      ...map,
      [cat]: trimmed !== '' && trimmed !== DEFAULT_TAX_CATEGORY_MAP[cat] ? trimmed : undefined,
    };
    // Remove undefined keys
    for (const k of Object.keys(next) as AppCostCategory[]) {
      if (next[k] === undefined) delete next[k];
    }
    setMap(next);
    setSaved(false);
    onChange?.(next);
  }

  function handleSave() {
    saveTaxCategoryMap(map);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    const empty: TaxCategoryMap = {};
    setMap(empty);
    saveTaxCategoryMap(empty);
    onChange?.(empty);
  }

  return (
    <div className="space-y-4" data-testid="tax-category-mapping">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Map Arden Project OS cost categories to tax/accounting labels. Leave blank to use the
        default label.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
              <th className="pb-2 pr-4 font-medium text-slate-700 dark:text-slate-300 w-1/3">
                App Category
              </th>
              <th className="pb-2 pr-4 font-medium text-slate-700 dark:text-slate-300 w-1/3">
                Default Label
              </th>
              <th className="pb-2 font-medium text-slate-700 dark:text-slate-300 w-1/3">
                Custom Override
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((cat) => (
              <tr key={cat}>
                <td className="py-2 pr-4 text-slate-800 dark:text-slate-200">
                  {CATEGORY_DISPLAY[cat]}
                </td>
                <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">
                  {DEFAULT_TAX_CATEGORY_MAP[cat]}
                </td>
                <td className="py-2">
                  <Input
                    value={map[cat] ?? ''}
                    onChange={(e) => handleChange(cat, e.target.value)}
                    placeholder={DEFAULT_TAX_CATEGORY_MAP[cat]}
                    aria-label={`Custom tax label for ${CATEGORY_DISPLAY[cat]}`}
                    data-testid={`tax-category-input-${cat}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSave}
          data-testid="tax-category-save-button"
        >
          {saved ? 'Saved' : 'Save Mapping'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          data-testid="tax-category-reset-button"
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};

export default TaxCategoryMapping;
