import React from 'react';
import type { ProposalData, ProposalPricingIndirect } from '../../types/proposal';
import type { ChangeOrderLineItem } from '../../types/changeOrder';
import ChangeOrderLineItemsEditor from '../change-order/ChangeOrderLineItemsEditor';
import PricingParamsEditor from '../pricing/PricingParamsEditor';
import StandardPricingBreakdown from '../pricing/StandardPricingBreakdown';
import { computeProposalBreakdown, defaultProposalPricingIndirect } from '../../utils/proposalPricing';
import { hydratePricingParams } from '../../utils/pricingParams';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import { PREMIUM_INNER_PANEL, TEXT_ACCENT, TEXT_FOREGROUND, TEXT_MUTED } from '../../theme/appTheme';

interface ProposalPricingEditorProps {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
  subcontractorItems: ChangeOrderLineItem[];
  indirect: ProposalPricingIndirect;
  onLaborChange: (items: ChangeOrderLineItem[]) => void;
  onMaterialChange: (items: ChangeOrderLineItem[]) => void;
  onEquipmentChange: (items: ChangeOrderLineItem[]) => void;
  onSubcontractorChange: (items: ChangeOrderLineItem[]) => void;
  onIndirectChange: (indirect: ProposalPricingIndirect) => void;
  companyTax?: {
    taxSystem?: ProposalPricingIndirect['taxSystem'];
    taxRatePercent?: number;
    taxApplication?: ProposalPricingIndirect['taxApplication'];
  };
}

export default function ProposalPricingEditor({
  laborItems,
  materialItems,
  equipmentItems,
  subcontractorItems,
  indirect,
  onLaborChange,
  onMaterialChange,
  onEquipmentChange,
  onSubcontractorChange,
  onIndirectChange,
  companyTax,
}: ProposalPricingEditorProps) {
  const previewData: ProposalData = {
    businessName: '',
    clientName: '',
    projectTitle: '',
    date: '',
    introduction: '',
    scope: '',
    timeline: [],
    laborItems,
    materialItems,
    equipmentItems,
    subcontractorItems,
    pricingIndirect: indirect,
    terms: '',
    preparedBy: '',
  };

  const breakdown = computeProposalBreakdown(previewData, companyTax);
  const params = hydratePricingParams(previewData, companyTax);
  const summaryCards = [
    {
      label: 'Labor',
      count: laborItems.length,
      value: breakdown.laborTotal,
      empty: 'No labor lines imported',
    },
    {
      label: 'Materials',
      count: materialItems.length,
      value: breakdown.materialCostAdjusted,
      empty: 'No material lines imported',
    },
    {
      label: 'Equipment',
      count: equipmentItems.length,
      value: breakdown.equipmentTotal,
      empty: 'No equipment lines imported',
    },
    {
      label: 'Subcontractors',
      count: subcontractorItems.length,
      value: breakdown.subcontractorTotal,
      empty: 'No subcontractor lines imported',
    },
  ];

  return (
    <div className="space-y-5">
      {params.pricingModel === 'legacy' && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          This proposal uses legacy pricing. Save with standard parameters to switch to
          waste, tax, and true-margin pricing.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${PREMIUM_INNER_PANEL} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </p>
                <p className={`mt-1 text-lg font-bold ${TEXT_FOREGROUND}`}>
                  {formatChangeOrderMoney(card.value)}
                </p>
              </div>
              <span className={`rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold ${TEXT_ACCENT}`}>
                {card.count} line{card.count === 1 ? '' : 's'}
              </span>
            </div>
            {card.count === 0 ? (
              <p className={`mt-2 text-xs ${TEXT_MUTED}`}>{card.empty}</p>
            ) : null}
          </div>
        ))}
      </div>

      <section className={`${PREMIUM_INNER_PANEL} space-y-4 p-4`}>
        <div>
          <h3 className={`font-semibold ${TEXT_FOREGROUND}`}>Estimate lines</h3>
          <p className={`text-sm ${TEXT_MUTED}`}>
            Imported or manually entered cost lines grouped by trade category.
          </p>
        </div>
        <ChangeOrderLineItemsEditor
          label="Labor"
          category="labor"
          items={laborItems}
          onChange={onLaborChange}
          emptyText="No labor lines imported"
        />
        <ChangeOrderLineItemsEditor
          label="Materials"
          category="material"
          items={materialItems}
          onChange={onMaterialChange}
          emptyText="No material lines imported"
        />
        <ChangeOrderLineItemsEditor
          label="Equipment"
          category="equipment"
          items={equipmentItems}
          onChange={onEquipmentChange}
          emptyText="No equipment lines imported"
        />
        <ChangeOrderLineItemsEditor
          label="Subcontractors"
          category="subcontractor"
          items={subcontractorItems}
          onChange={onSubcontractorChange}
          emptyText="No subcontractor lines imported"
        />
      </section>

      <section className={`${PREMIUM_INNER_PANEL} p-4`}>
        <div className="mb-4">
          <h3 className={`font-semibold ${TEXT_FOREGROUND}`}>Pricing controls</h3>
          <p className={`text-sm ${TEXT_MUTED}`}>
            Adjust cost allowances, tax, fees, permits, margin, and overhead.
          </p>
        </div>
        <PricingParamsEditor
          params={params}
          onChange={(next) => onIndirectChange(next as ProposalPricingIndirect)}
          showLegacyToggle
        />
      </section>

      <StandardPricingBreakdown breakdown={breakdown} />
      <p className={`text-xs ${TEXT_MUTED}`}>
        Clients see only the total proposal price — internal costs are not shown.
      </p>
    </div>
  );
}

export function proposalIndirectFromData(
  data: ProposalData,
  companyTax?: Parameters<typeof hydratePricingParams>[1],
): ProposalPricingIndirect {
  return hydratePricingParams(data, companyTax) as ProposalPricingIndirect;
}

export { defaultProposalPricingIndirect };
