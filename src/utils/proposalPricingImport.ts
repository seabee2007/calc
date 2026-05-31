import type { Project } from '../types';
import type { ChangeOrderLineItem } from '../types/changeOrder';
import { computeLaborMaterialLineTotal } from './changeOrderFinancials';
import { projectHasCustomEstimate } from './customEstimateUtils';

function projectWasteMultiplier(project: Project): number {
  const wf = project.wasteFactor ?? 10;
  return 1 + Math.max(0, wf) / 100;
}

export interface ProposalLineItemsFromProject {
  laborItems: ChangeOrderLineItem[];
  materialItems: ChangeOrderLineItem[];
  equipmentItems: ChangeOrderLineItem[];
}

function moneyLine(description: string, cost: number): ChangeOrderLineItem | null {
  if (cost <= 0) return null;
  return { description, amount: Math.round(cost * 100) / 100 };
}

/** Labor line with optional hours → qty (hrs) and $/hr unit price for the editor. */
function laborMoneyLine(
  description: string,
  cost: number,
  hours?: number,
): ChangeOrderLineItem | null {
  if (cost <= 0) return null;
  if (hours != null && hours > 0) {
    const qty = Math.round(hours * 10) / 10;
    const unitPrice = Math.round((cost / hours) * 100) / 100;
    const row: ChangeOrderLineItem = { description, qty, unitPrice, amount: 0 };
    return { ...row, amount: computeLaborMaterialLineTotal(row) };
  }
  return moneyLine(description, cost);
}

/** Categorized line items for change-order-style proposal pricing. */
export function buildProposalLineItemsFromProject(
  project: Project,
): ProposalLineItemsFromProject {
  const wasteMult = projectWasteMultiplier(project);
  const laborItems: ChangeOrderLineItem[] = [];
  const materialItems: ChangeOrderLineItem[] = [];
  const equipmentItems: ChangeOrderLineItem[] = [];

  const calculationsWithPricing = (project.calculations ?? []).filter((calc) => {
    const pricing = calc.result?.pricing;
    return pricing && pricing.concreteCost > 0;
  });

  const concreteByPsi: Record<
    string,
    { volume: number; cost: number; calcTypes: string[] }
  > = {};
  let totalDeliveryFees = 0;
  const additionalServicesCosts: Record<string, number> = {};

  calculationsWithPricing.forEach((calc) => {
    const volume = calc.result.volume;
    const calcType = calc.type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    const psi = calc.psi || '3000';
    const pricing = calc.result.pricing!;

    if (pricing.concreteCost > 0) {
      if (!concreteByPsi[psi]) {
        concreteByPsi[psi] = { volume: 0, cost: 0, calcTypes: [] };
      }
      concreteByPsi[psi].volume += volume;
      concreteByPsi[psi].cost += pricing.concreteCost;
      if (!concreteByPsi[psi].calcTypes.includes(calcType)) {
        concreteByPsi[psi].calcTypes.push(calcType);
      }
    }

    if (pricing.deliveryFees?.totalDeliveryFees > 0) {
      totalDeliveryFees += pricing.deliveryFees.totalDeliveryFees;
    }

    if (pricing.additionalServices) {
      if (pricing.additionalServices.pumpTruckFee > 0) {
        additionalServicesCosts['Pump truck'] =
          (additionalServicesCosts['Pump truck'] || 0) +
          pricing.additionalServices.pumpTruckFee;
      }
      if (pricing.additionalServices.saturdayFee > 0) {
        additionalServicesCosts['Saturday delivery'] =
          (additionalServicesCosts['Saturday delivery'] || 0) +
          pricing.additionalServices.saturdayFee;
      }
      if (pricing.additionalServices.afterHoursFee > 0) {
        additionalServicesCosts['After hours delivery'] =
          (additionalServicesCosts['After hours delivery'] || 0) +
          pricing.additionalServices.afterHoursFee;
      }
    }
  });

  Object.entries(concreteByPsi).forEach(([psi, data]) => {
    const calcTypesStr =
      data.calcTypes.length === 1
        ? data.calcTypes[0]
        : data.calcTypes.length === 2
          ? data.calcTypes.join(' & ')
          : 'Mixed concrete work';
    const orderVolume = data.volume * wasteMult;
    const row = moneyLine(
      `${calcTypesStr} — ${orderVolume.toFixed(2)} yd³ order (${psi} PSI, incl. waste)`,
      data.cost * wasteMult,
    );
    if (row) materialItems.push(row);
  });

  const delivery = moneyLine('Delivery & transportation', totalDeliveryFees);
  if (delivery) materialItems.push(delivery);

  Object.entries(additionalServicesCosts).forEach(([service, cost]) => {
    const row = moneyLine(service, cost);
    if (row) materialItems.push(row);
  });

  (project.reinforcements ?? []).forEach((set) => {
    const cost = set.pricing?.estimatedCost ?? 0;
    if (cost <= 0) return;
    const typeLabel =
      set.reinforcement_type === 'rebar'
        ? 'Rebar'
        : set.reinforcement_type === 'mesh'
          ? 'Welded wire mesh'
          : 'Fiber reinforcement';
    const p = set.pricing;
    const stickDetail =
      p?.sticksRequired != null && p.barSize
        ? ` — ${p.sticksRequired} × ${p.unit ?? '20ft stick'} ${p.barSize}`
        : set.total_linear_ft != null
          ? ` — ${set.total_linear_ft.toFixed(0)} lin ft`
          : set.mesh_sheets != null
            ? ` — ${set.mesh_sheets} sheets`
            : '';
    const regionalNote =
      p?.regionalLabel && p.regionalMultiplier && p.regionalMultiplier !== 1
        ? ` (${p.regionalLabel} ×${p.regionalMultiplier})`
        : '';
    const row = moneyLine(`${typeLabel}${stickDetail}${regionalNote}`, cost);
    if (row) materialItems.push(row);
  });

  const laborFromEstimate = project.laborEstimates?.[0];
  const placementLabor = project.placementOrder?.production;
  const laborCost =
    laborFromEstimate?.laborCost ?? placementLabor?.laborCost ?? 0;
  const laborHours =
    laborFromEstimate?.adjustedLaborHours ?? placementLabor?.adjustedLaborHours ?? 0;

  if (laborCost > 0) {
    const hoursLabel = laborHours > 0 ? ` — ${laborHours.toFixed(1)} labor-hrs` : '';
    const row = laborMoneyLine(
      `Placement labor${hoursLabel}`,
      laborCost,
      laborHours > 0 ? laborHours : undefined,
    );
    if (row) laborItems.push(row);
  }

  const custom = project.customEstimates;
  if (custom) {
    for (const item of custom.laborItems ?? []) {
      if ((item.amount ?? 0) > 0) laborItems.push({ ...item });
    }
    for (const item of custom.materialItems ?? []) {
      if ((item.amount ?? 0) > 0) materialItems.push({ ...item });
    }
    for (const item of custom.equipmentItems ?? []) {
      if ((item.amount ?? 0) > 0) equipmentItems.push({ ...item });
    }
  }

  return { laborItems, materialItems, equipmentItems };
}

export function countProposalLineItemsFromProject(project: Project): number {
  const items = buildProposalLineItemsFromProject(project);
  return (
    items.laborItems.length + items.materialItems.length + items.equipmentItems.length
  );
}

/** Labels for saved estimate sources (workflow step 2) shown in proposal import UI. */
export function getProjectEstimateSourceLabels(project: Project): string[] {
  const labels: string[] = [];
  const hasConcrete = (project.calculations ?? []).some(
    (c) => (c.result?.pricing?.concreteCost ?? 0) > 0,
  );
  if (hasConcrete) labels.push('Concrete');
  const hasRebar = (project.reinforcements ?? []).some(
    (r) => (r.pricing?.estimatedCost ?? 0) > 0,
  );
  if (hasRebar) labels.push('Reinforcement');
  const hasLabor =
    (project.laborEstimates?.[0]?.laborCost ?? 0) > 0 ||
    (project.placementOrder?.production?.laborCost ?? 0) > 0;
  if (hasLabor) labels.push('Labor');
  if (projectHasCustomEstimate(project)) labels.push('Custom');
  return labels;
}

export function projectHasImportablePricing(project: Project): boolean {
  const hasConcrete = (project.calculations ?? []).some(
    (c) => (c.result?.pricing?.concreteCost ?? 0) > 0,
  );
  const hasRebar = (project.reinforcements ?? []).some(
    (r) => (r.pricing?.estimatedCost ?? 0) > 0,
  );
  const hasLabor =
    (project.laborEstimates?.[0]?.laborCost ?? 0) > 0 ||
    (project.placementOrder?.production?.laborCost ?? 0) > 0;
  return hasConcrete || hasRebar || hasLabor || projectHasCustomEstimate(project);
}
