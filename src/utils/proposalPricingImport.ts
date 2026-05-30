import type { Project } from '../types';
import { customEstimateCategoryTotals, projectHasCustomEstimate } from './customEstimateUtils';
import { formatPrice } from './pricing';

export interface ProposalPricingLine {
  description: string;
  amount: string;
}

/** Build proposal pricing lines from project concrete, reinforcement, and labor data. */
export function buildProposalPricingFromProject(project: Project): ProposalPricingLine[] {
  const pricingItems: ProposalPricingLine[] = [];

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
        additionalServicesCosts['Pump Truck'] =
          (additionalServicesCosts['Pump Truck'] || 0) +
          pricing.additionalServices.pumpTruckFee;
      }
      if (pricing.additionalServices.saturdayFee > 0) {
        additionalServicesCosts['Saturday Delivery'] =
          (additionalServicesCosts['Saturday Delivery'] || 0) +
          pricing.additionalServices.saturdayFee;
      }
      if (pricing.additionalServices.afterHoursFee > 0) {
        additionalServicesCosts['After Hours Delivery'] =
          (additionalServicesCosts['After Hours Delivery'] || 0) +
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
          : 'Mixed Concrete Work';
    pricingItems.push({
      description: `${calcTypesStr} - ${data.volume.toFixed(2)} yd³ concrete (${psi} PSI)`,
      amount: formatPrice(data.cost),
    });
  });

  if (totalDeliveryFees > 0) {
    pricingItems.push({
      description: 'Delivery & Transportation',
      amount: formatPrice(totalDeliveryFees),
    });
  }

  Object.entries(additionalServicesCosts).forEach(([service, cost]) => {
    pricingItems.push({
      description: service,
      amount: formatPrice(cost),
    });
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
    pricingItems.push({
      description: `${typeLabel}${stickDetail}${regionalNote}`,
      amount: formatPrice(cost),
    });
  });

  const laborFromEstimate = project.laborEstimates?.[0];
  const placementLabor = project.placementOrder?.production;
  const laborCost =
    laborFromEstimate?.laborCost ?? placementLabor?.laborCost ?? 0;
  const laborHours =
    laborFromEstimate?.adjustedLaborHours ?? placementLabor?.adjustedLaborHours ?? 0;

  if (laborCost > 0) {
    const hoursLabel = laborHours > 0 ? ` — ${laborHours.toFixed(1)} labor-hrs` : '';
    pricingItems.push({
      description: `Placement labor${hoursLabel}`,
      amount: formatPrice(laborCost),
    });
  }

  const custom = customEstimateCategoryTotals(project);
  if (custom.labor > 0) {
    pricingItems.push({
      description: 'Custom estimate — Labor',
      amount: formatPrice(custom.labor),
    });
  }
  if (custom.material > 0) {
    pricingItems.push({
      description: 'Custom estimate — Material',
      amount: formatPrice(custom.material),
    });
  }
  if (custom.equipment > 0) {
    pricingItems.push({
      description: 'Custom estimate — Equipment',
      amount: formatPrice(custom.equipment),
    });
  }

  return pricingItems;
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
