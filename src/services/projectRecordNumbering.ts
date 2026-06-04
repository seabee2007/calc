import { listContractDocuments } from '../features/documents/services/contractDocumentService';
import type { ProjectDocumentRow } from './projectDocumentService';
import { isFarBuilderDocument, isRfiBuilderDocument } from './projectDocumentDisplay';
import { fetchAdjustmentsForProject } from './fieldAdjustmentService';
import { fetchRfisForProject } from './rfiService';

export const RFI_NUMBER_PREFIX = 'RFI';
export const FAR_NUMBER_PREFIX = 'FAR';

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Build regex for RFI-001 / FAR-001 style labels. */
export function recordNumberPattern(prefix: string): RegExp {
  return new RegExp(`^${prefix}-(\\d+)$`, 'i');
}

export function formatRecordNumber(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

/** Parse sequence from RFI-001, rfi-1, or bare digits when allowBareDigits is true. */
export function parseRecordSequence(
  prefix: string,
  value: string | null | undefined,
  options?: { allowBareDigits?: boolean },
): number | null {
  const trimmed = str(value);
  if (!trimmed) return null;

  const formatted = trimmed.match(recordNumberPattern(prefix));
  if (formatted) {
    const n = Number.parseInt(formatted[1], 10);
    return Number.isFinite(n) ? n : null;
  }

  if (options?.allowBareDigits && /^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

export function isFormattedRecordNumber(prefix: string, value: string | null | undefined): boolean {
  const trimmed = str(value);
  if (!trimmed) return false;
  return recordNumberPattern(prefix).test(trimmed);
}

export function maxSequenceFromValues(
  prefix: string,
  values: (string | null | undefined)[],
): number {
  let max = 0;
  for (const v of values) {
    const seq = parseRecordSequence(prefix, v, { allowBareDigits: true });
    if (seq != null) max = Math.max(max, seq);
  }
  return max;
}

export function nextRecordNumber(prefix: string, existingValues: (string | null | undefined)[]): string {
  const next = maxSequenceFromValues(prefix, existingValues) + 1;
  return formatRecordNumber(prefix, next);
}

export async function collectRfiNumberCandidates(projectId: string): Promise<string[]> {
  const [legacy, allDocs] = await Promise.all([
    fetchRfisForProject(projectId),
    listContractDocuments(projectId),
  ]);
  const builder = allDocs.filter(isRfiBuilderDocument);
  const values: string[] = [];
  for (const r of legacy) {
    if (r.displayNumber) values.push(r.displayNumber);
  }
  for (const doc of builder) {
    if (doc.document_number) values.push(doc.document_number);
  }
  return values;
}

export async function collectFarNumberCandidates(projectId: string): Promise<string[]> {
  const [legacy, allDocs] = await Promise.all([
    fetchAdjustmentsForProject(projectId),
    listContractDocuments(projectId),
  ]);
  const builder = allDocs.filter(isFarBuilderDocument);
  const values: string[] = [];
  for (const a of legacy) {
    if (a.displayNumber) values.push(a.displayNumber);
  }
  for (const doc of builder) {
    if (doc.document_number) values.push(doc.document_number);
  }
  return values;
}

export async function getNextRfiNumber(projectId: string): Promise<string> {
  const candidates = await collectRfiNumberCandidates(projectId);
  return nextRecordNumber(RFI_NUMBER_PREFIX, candidates);
}

export async function getNextFarNumber(projectId: string): Promise<string> {
  const candidates = await collectFarNumberCandidates(projectId);
  return nextRecordNumber(FAR_NUMBER_PREFIX, candidates);
}

function pickFormattedOrExisting(
  prefix: string,
  existingDocumentNumber: string | null | undefined,
  answerValue: string | null | undefined,
): string | null {
  const fromParent = str(existingDocumentNumber);
  if (fromParent && isFormattedRecordNumber(prefix, fromParent)) return fromParent;

  const fromAnswer = str(answerValue);
  if (fromAnswer && isFormattedRecordNumber(prefix, fromAnswer)) return fromAnswer;

  return null;
}

function pickUserProvidedNumber(answerValue: string | null | undefined): string | null {
  const v = str(answerValue);
  return v || null;
}

export interface ResolveRecordNumberForSaveInput {
  projectId: string;
  answers: Record<string, unknown>;
  existingDocumentNumber?: string | null;
}

/** Assign RFI number on save without overwriting formatted existing numbers. */
export async function resolveRfiNumberForSave(
  input: ResolveRecordNumberForSaveInput,
): Promise<string | null> {
  const { projectId, answers, existingDocumentNumber } = input;
  const answerRaw = str(answers.rfiNumber) || str(answers.rfi_number);

  const formatted = pickFormattedOrExisting(RFI_NUMBER_PREFIX, existingDocumentNumber, answerRaw);
  if (formatted) return formatted;

  if (!answerRaw) {
    return getNextRfiNumber(projectId);
  }

  return pickUserProvidedNumber(answerRaw);
}

/** Assign FAR number on save without overwriting formatted existing numbers. */
export async function resolveFarNumberForSave(
  input: ResolveRecordNumberForSaveInput,
): Promise<string | null> {
  const { projectId, answers, existingDocumentNumber } = input;
  const answerRaw = str(answers.farNumber) || str(answers.displayNumber);

  const formatted = pickFormattedOrExisting(FAR_NUMBER_PREFIX, existingDocumentNumber, answerRaw);
  if (formatted) return formatted;

  if (!answerRaw) {
    return getNextFarNumber(projectId);
  }

  return pickUserProvidedNumber(answerRaw);
}

function extractFromTitle(prefix: string, title: string | null | undefined): string | null {
  const t = str(title);
  if (!t) return null;
  const m = t.match(new RegExp(`\\b${prefix}-(\\d{3})\\b`, 'i'));
  if (!m) return null;
  const seq = Number.parseInt(m[1], 10);
  return Number.isFinite(seq) ? formatRecordNumber(prefix, seq) : null;
}

/** Display priority for builder RFI rows. */
export function resolveRfiDisplayNumber(
  doc: Pick<ProjectDocumentRow, 'document_number' | 'title'>,
  answers?: Record<string, unknown> | null,
): string {
  const fromParent = str(doc.document_number);
  if (fromParent) return fromParent;

  const fromAnswers = str(answers?.rfiNumber) || str(answers?.rfi_number);
  if (fromAnswers) return fromAnswers;

  const fromTitle = extractFromTitle(RFI_NUMBER_PREFIX, doc.title);
  if (fromTitle) return fromTitle;

  return '—';
}

/** Display priority for builder FAR rows. */
export function resolveFarDisplayNumber(
  doc: Pick<ProjectDocumentRow, 'document_number' | 'title'>,
  answers?: Record<string, unknown> | null,
): string {
  const fromParent = str(doc.document_number);
  if (fromParent) return fromParent;

  const fromAnswers = str(answers?.farNumber) || str(answers?.displayNumber);
  if (fromAnswers) return fromAnswers;

  const fromTitle = extractFromTitle(FAR_NUMBER_PREFIX, doc.title);
  if (fromTitle) return fromTitle;

  return '—';
}

/** Apply resolved RFI/FAR number into answers object (canonical keys). */
export function applyRfiNumberToAnswers(
  answers: Record<string, unknown>,
  number: string | null,
): Record<string, unknown> {
  if (!number) return answers;
  return { ...answers, rfiNumber: number };
}

export function applyFarNumberToAnswers(
  answers: Record<string, unknown>,
  number: string | null,
): Record<string, unknown> {
  if (!number) return answers;
  return { ...answers, farNumber: number };
}
