/** Stored shape for each punch list discrepancy in `answers.punchItems`. */
export interface PunchListItemAnswer {
  id: string;
  itemNumber: string;
  locationArea: string;
  description: string;
  category: string;
  trade: string;
  responsibleParty: string;
  priority: string;
  status: string;
  dueDate: string;
  correctiveAction: string;
  completionDate: string;
  verifiedBy: string;
  verificationDate: string;
  ownerComment: string;
  contractorResponse: string;
  costImpact: string;
  scheduleImpact: string;
  photoReferences: string;
  attachmentNotes: string;
}

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyPunchListItem(): PunchListItemAnswer {
  return {
    id: newId(),
    itemNumber: '',
    locationArea: '',
    description: '',
    category: '',
    trade: '',
    responsibleParty: '',
    priority: '',
    status: '',
    dueDate: '',
    correctiveAction: '',
    completionDate: '',
    verifiedBy: '',
    verificationDate: '',
    ownerComment: '',
    contractorResponse: '',
    costImpact: '',
    scheduleImpact: '',
    photoReferences: '',
    attachmentNotes: '',
  };
}

function coerceItem(raw: unknown): PunchListItemAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const description = str(o.description) || str(o.itemDescription);
  const itemNumber = str(o.itemNumber);
  const locationArea = str(o.locationArea);
  const responsibleParty = str(o.responsibleParty);
  const hasContent =
    description.trim() ||
    itemNumber.trim() ||
    locationArea.trim() ||
    responsibleParty.trim();
  if (!hasContent && !str(o.id).trim()) return null;

  return {
    id: str(o.id).trim() || newId(),
    itemNumber,
    locationArea,
    description,
    category: str(o.category),
    trade: str(o.trade),
    responsibleParty,
    priority: str(o.priority),
    status: str(o.status) || str(o.itemStatus),
    dueDate: str(o.dueDate),
    correctiveAction: str(o.correctiveAction),
    completionDate: str(o.completionDate),
    verifiedBy: str(o.verifiedBy),
    verificationDate: str(o.verificationDate),
    ownerComment: str(o.ownerComment),
    contractorResponse: str(o.contractorResponse),
    costImpact: str(o.costImpact),
    scheduleImpact: str(o.scheduleImpact),
    photoReferences: str(o.photoReferences),
    attachmentNotes: str(o.attachmentNotes) || str(o.notes),
  };
}

export function parsePunchListItems(raw: unknown): PunchListItemAnswer[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceItem).filter((row): row is PunchListItemAnswer => row !== null);
}

export function duplicatePunchListItem(item: PunchListItemAnswer): PunchListItemAnswer {
  return { ...item, id: newId() };
}

function cleanStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Build one row from legacy flat answer keys (pre–repeatable drafts). */
export function legacyAnswersToPunchItems(
  answers: Record<string, unknown>,
): PunchListItemAnswer[] {
  const description = cleanStr(answers.itemDescription);
  const itemNumber = cleanStr(answers.itemNumber);
  const locationArea = cleanStr(answers.locationArea);
  const responsibleParty = cleanStr(answers.responsibleParty);
  const hasItem =
    description ||
    itemNumber ||
    locationArea ||
    responsibleParty ||
    cleanStr(answers.correctiveAction) ||
    cleanStr(answers.category);

  if (!hasItem) return [];

  return [
    {
      id: newId(),
      itemNumber,
      locationArea,
      description,
      category: cleanStr(answers.category),
      trade: cleanStr(answers.trade),
      responsibleParty,
      priority: cleanStr(answers.priority),
      status: cleanStr(answers.itemStatus) || cleanStr(answers.status),
      dueDate: cleanStr(answers.dueDate),
      correctiveAction: cleanStr(answers.correctiveAction),
      completionDate: cleanStr(answers.completionDate),
      verifiedBy: cleanStr(answers.verifiedBy),
      verificationDate: cleanStr(answers.verificationDate),
      ownerComment: cleanStr(answers.ownerComment),
      contractorResponse: cleanStr(answers.contractorResponse),
      costImpact: cleanStr(answers.costImpact),
      scheduleImpact: cleanStr(answers.scheduleImpact),
      photoReferences: cleanStr(answers.photoReferences),
      attachmentNotes: cleanStr(answers.attachmentNotes) || cleanStr(answers.notes),
    },
  ];
}

export function punchItemHeaderLabel(item: PunchListItemAnswer): string {
  const num = item.itemNumber.trim() || '—';
  const loc = item.locationArea.trim() || '—';
  const status = item.status.trim() || '—';
  const priority = item.priority.trim() || '—';
  return `Item ${num} · ${loc} · ${status} · ${priority}`;
}
