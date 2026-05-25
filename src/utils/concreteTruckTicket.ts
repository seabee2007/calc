import type { ConcreteTruckTicket } from '../types/concreteTruckTicket';
import type { PourPlannerFormState } from '../types/pourPlanner';

function parseNum(value: string | undefined): number {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
}

/** Build a ticket snapshot from pour planner form state. */
export function buildConcreteTruckTicket(
  form: PourPlannerFormState,
  orderedYards = 0,
): ConcreteTruckTicket {
  return {
    ticketNumber: form.ticketNumber,
    truckNumber: form.truckNumber,
    mixCode: form.mixCode,
    batchPlant: form.batchPlantAddress,
    batchTime: form.batchTime,
    departTime: form.departTime,
    arrivalTime: form.arrivalTime,
    dischargeStart: form.dischargeStart,
    dischargeEnd: form.dischargeEnd,
    orderedYards: parseNum(form.orderedYards) || orderedYards,
    deliveredYards: parseNum(form.deliveredYards),
    slump: parseNum(form.slump),
    airContent: parseNum(form.airContent),
    concreteTemp: parseNum(form.concreteTemp),
    waterAddedPlant: parseNum(form.waterAddedPlant),
    waterAddedSite: parseNum(form.waterAddedSite),
    drumRevolutions: parseNum(form.drumRevolutions),
    accepted: form.ticketAccepted,
  };
}
