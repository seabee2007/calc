import React, { useState } from 'react';
import {
  AppCostCategory,
  DEFAULT_TAX_CATEGORY_MAP,
  loadTaxCategoryMap,
  saveTaxCategoryMap,
  type TaxCategoryMap,
} from '../../utils/accountingExport';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { BORDER_DEFAULT, TEXT_FOREGROUND, TEXT_MUTED, TEXT_SUBTLE } from '../../theme/appTheme';

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
    <div className="space-y-5" data-testid="tax-category-mapping">
      <p className={`text-sm leading-relaxed ${TEXT_MUTED}`}>
        Map Arden Project OS cost categories to tax/accounting labels. Leave blank to use the
        default label.
      </p>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className={`border-b ${BORDER_DEFAULT} text-left`}>
              <th className={`sticky top-0 bg-white pb-3 pr-4 font-semibold ${TEXT_FOREGROUND} dark:bg-slate-900`}>
                App Category
              </th>
              <th className={`sticky top-0 bg-white pb-3 pr-4 font-semibold ${TEXT_FOREGROUND} dark:bg-slate-900`}>
                Default Label
              </th>
              <th className={`sticky top-0 bg-white pb-3 font-semibold ${TEXT_FOREGROUND} dark:bg-slate-900`}>
                Custom Override
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${BORDER_DEFAULT}`}>
            {categories.map((cat) => (
              <tr key={cat} className="align-top">
                <td className={`py-3 pr-4 ${TEXT_FOREGROUND}`}>{CATEGORY_DISPLAY[cat]}</td>
                <td className={`py-3 pr-4 ${TEXT_MUTED}`}>{DEFAULT_TAX_CATEGORY_MAP[cat]}</td>
                <td className="py-3">
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

      <div className="space-y-3 md:hidden">
        {categories.map((cat) => (
          <div
            key={cat}
            className={`rounded-xl border ${BORDER_DEFAULT} bg-slate-50 p-4 dark:bg-slate-800/50`}
          >
            <p className={`text-sm font-semibold ${TEXT_FOREGROUND}`}>{CATEGORY_DISPLAY[cat]}</p>
            <p className={`mt-1 text-xs ${TEXT_SUBTLE}`}>
              Default: {DEFAULT_TAX_CATEGORY_MAP[cat]}
            </p>
            <div className="mt-3">
              <label className={`mb-1 block text-xs font-medium ${TEXT_MUTED}`}>
                Custom override
              </label>
              <Input
                value={map[cat] ?? ''}
                onChange={(e) => handleChange(cat, e.target.value)}
                placeholder={DEFAULT_TAX_CATEGORY_MAP[cat]}
                aria-label={`Custom tax label for ${CATEGORY_DISPLAY[cat]}`}
                data-testid={`tax-category-input-mobile-${cat}`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
