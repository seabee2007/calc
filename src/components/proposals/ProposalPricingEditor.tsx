import React from 'react';
import type { ProposalData, ProposalPricingIndirect } from '../../types/proposal';
import type { ChangeOrderLineItem } from '../../types/changeOrder';
import ChangeOrderLineItemsEditor from '../change-order/ChangeOrderLineItemsEditor';
import PricingParamsEditor from '../pricing/PricingParamsEditor';
import StandardPricingBreakdown from '../pricing/StandardPricingBreakdown';
import { computeProposalBreakdown, defaultProposalPricingIndirect } from '../../utils/proposalPricing';
import { hydratePricingParams } from '../../utils/pricingParams';

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

  return (
    <div className="space-y-4">
      {params.pricingModel === 'legacy' && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          This proposal uses legacy pricing. Save with standard parameters to switch to
          waste, tax, and true-margin pricing.
        </p>
      )}

      <ChangeOrderLineItemsEditor
        label="Labor"
        category="labor"
        items={laborItems}
        onChange={onLaborChange}
      />
      <ChangeOrderLineItemsEditor
        label="Material"
        category="material"
        items={materialItems}
        onChange={onMaterialChange}
      />
      <ChangeOrderLineItemsEditor
        label="Equipment"
        category="equipment"
        items={equipmentItems}
        onChange={onEquipmentChange}
      />
      <ChangeOrderLineItemsEditor
        label="Subcontractors"
        category="subcontractor"
        items={subcontractorItems}
        onChange={onSubcontractorChange}
      />

      <PricingParamsEditor
        params={params}
        onChange={(next) => onIndirectChange(next as ProposalPricingIndirect)}
        showLegacyToggle
      />

      <StandardPricingBreakdown breakdown={breakdown} />
      <p className="text-xs text-gray-500 dark:text-gray-400">
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
