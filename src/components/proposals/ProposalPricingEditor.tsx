import React from 'react';
import type { ProposalData, ProposalPricingIndirect } from '../../types/proposal';
import type { ChangeOrderLineItem } from '../../types/changeOrder';
import ChangeOrderLineItemsEditor from '../change-order/ChangeOrderLineItemsEditor';
import Input from '../ui/Input';
import ProposalPricingSection from './ProposalPricingSection';
import { defaultProposalPricingIndirect } from '../../utils/proposalPricing';

interface ProposalPricingEditorProps {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
  indirect: ProposalPricingIndirect;
  onLaborChange: (items: ChangeOrderLineItem[]) => void;
  onMaterialChange: (items: ChangeOrderLineItem[]) => void;
  onEquipmentChange: (items: ChangeOrderLineItem[]) => void;
  onIndirectChange: (indirect: ProposalPricingIndirect) => void;
}

export default function ProposalPricingEditor({
  laborItems,
  materialItems,
  equipmentItems,
  indirect,
  onLaborChange,
  onMaterialChange,
  onEquipmentChange,
  onIndirectChange,
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
    pricingIndirect: indirect,
  };

  const setIndirectField = <K extends keyof ProposalPricingIndirect>(
    key: K,
    value: ProposalPricingIndirect[K],
  ) => {
    onIndirectChange({ ...indirect, [key]: value });
  };

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Fees ($)"
          type="number"
          min={0}
          step={0.01}
          value={indirect.feesAmount}
          onChange={(e) =>
            setIndirectField('feesAmount', Math.max(0, Number(e.target.value) || 0))
          }
          fullWidth
        />
        <Input
          label="Permits ($)"
          type="number"
          min={0}
          step={0.01}
          value={indirect.permitsAmount}
          onChange={(e) =>
            setIndirectField('permitsAmount', Math.max(0, Number(e.target.value) || 0))
          }
          fullWidth
        />
        <Input
          label="Overhead % (of direct cost)"
          type="number"
          min={0}
          step={1}
          value={indirect.overheadPercent}
          onChange={(e) =>
            setIndirectField('overheadPercent', Math.max(0, Number(e.target.value) || 0))
          }
          fullWidth
        />
        <Input
          label="Profit % (of direct cost)"
          type="number"
          min={0}
          step={1}
          value={indirect.profitPercent}
          onChange={(e) =>
            setIndirectField('profitPercent', Math.max(0, Number(e.target.value) || 0))
          }
          fullWidth
        />
      </div>
      <Input
        label="Markup % (applied to material cost only)"
        type="number"
        min={0}
        value={indirect.markupPercent}
        onChange={(e) =>
          setIndirectField('markupPercent', Math.max(0, Number(e.target.value) || 0))
        }
        fullWidth
      />

      <ProposalPricingSection data={previewData} audience="internal" title="Pricing summary" />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Clients see direct costs, indirect costs, and total proposal — same as change orders.
      </p>
    </div>
  );
}

export function proposalIndirectFromData(data: ProposalData): ProposalPricingIndirect {
  return { ...defaultProposalPricingIndirect(), ...data.pricingIndirect };
}
