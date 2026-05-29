import type { QCRecord } from '../types';
import type {
  StoredTruckTicketRecord,
  TruckTicketFormState,
} from '../types/concreteTruckTicket';
import { TRUCK_TICKET_NOTE_PREFIX as PREFIX } from '../types/concreteTruckTicket';

function parseNum(value: string | undefined, fallback = 0): number {
  const n = parseFloat(value ?? '');
  return Number.isFinite(n) ? n : fallback;
}

export function buildConcreteTruckTicket(form: TruckTicketFormState): ConcreteTruckTicket {
  return {
    ticketNumber: form.ticketNumber,
    truckNumber: form.truckNumber,
    mixCode: form.mixCode,
    batchPlant: form.batchPlant,
    batchTime: form.batchTime,
    departTime: form.departTime,
    arrivalTime: form.arrivalTime,
    dischargeStart: form.dischargeStart,
    dischargeEnd: form.dischargeEnd,
    orderedYards: parseNum(form.orderedYards),
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

export function encodeTruckTicketNotes(form: TruckTicketFormState): string {
  return `${PREFIX}${JSON.stringify(form)}`;
}

export function decodeTruckTicketNotes(notes: string | undefined): TruckTicketFormState | null {
  if (!notes?.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(notes.slice(PREFIX.length)) as TruckTicketFormState;
  } catch {
    return null;
  }
}

export function isTruckTicketRecord(record: QCRecord): boolean {
  return Boolean(record.notes?.startsWith(PREFIX));
}

export function isLegacyQcRecord(record: QCRecord): boolean {
  return !isTruckTicketRecord(record);
}

export function storedTruckTicketFromQcRecord(record: QCRecord): StoredTruckTicketRecord | null {
  const form = decodeTruckTicketNotes(record.notes);
  if (!form) return null;
  return {
    id: record.id,
    projectId: record.projectId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    form,
    ticket: buildConcreteTruckTicket(form),
  };
}

export function truckTicketToQcPayload(form: TruckTicketFormState) {
  const ticket = buildConcreteTruckTicket(form);
  return {
    recordType: 'fresh_test' as const,
    date: form.recordDate,
    temperature: ticket.concreteTemp,
    humidity: 0,
    slump: ticket.slump,
    airContent: ticket.airContent,
    cylindersMade: 0,
    notes: encodeTruckTicketNotes(form),
  };
}

export function suggestedMixCode(psi?: string, aggregateSize?: string): string {
  return [psi ? `${psi} PSI` : '', aggregateSize].filter(Boolean).join(' · ');
}

export function suggestedOrderedYards(projectVolumeYd?: number): string {
  if (projectVolumeYd == null || projectVolumeYd <= 0) return '';
  return projectVolumeYd.toFixed(2);
}
