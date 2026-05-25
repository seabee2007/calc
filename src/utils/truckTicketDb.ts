import type { QCRecord } from '../types';
import type {
  StoredTruckTicketRecord,
  TruckTicketFormState,
} from '../types/concreteTruckTicket';
import { DEFAULT_TRUCK_TICKET_FORM as DEFAULT_FORM } from '../types/concreteTruckTicket';
import {
  buildConcreteTruckTicket,
  storedTruckTicketFromQcRecord,
} from './concreteTruckTicket';

export function normalizeTruckTicketForm(data: unknown): TruckTicketFormState {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_FORM };
  }
  return { ...DEFAULT_FORM, ...(data as Partial<TruckTicketFormState>) };
}

export function mapTruckTicketFromDb(row: {
  id: string;
  project_id: string;
  record_date?: string;
  ticket_data: unknown;
  created_at: string;
  updated_at: string;
}): StoredTruckTicketRecord {
  const form = normalizeTruckTicketForm(row.ticket_data);
  if (row.record_date && !form.recordDate) {
    form.recordDate = row.record_date.split('T')[0];
  }
  return {
    id: row.id,
    projectId: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    form,
    ticket: buildConcreteTruckTicket(form),
  };
}

/** Merge DB truck tickets with legacy rows stored in qc_records.notes. */
export function mergeTruckTicketsForProject(
  qcRecords: QCRecord[],
  fromDb: StoredTruckTicketRecord[],
): StoredTruckTicketRecord[] {
  const dbIds = new Set(fromDb.map((t) => t.id));
  const legacy =
    qcRecords
      .map(storedTruckTicketFromQcRecord)
      .filter((r): r is StoredTruckTicketRecord => r != null && !dbIds.has(r.id)) ?? [];
  return [...fromDb, ...legacy].sort(
    (a, b) => new Date(b.form.recordDate).getTime() - new Date(a.form.recordDate).getTime(),
  );
}
