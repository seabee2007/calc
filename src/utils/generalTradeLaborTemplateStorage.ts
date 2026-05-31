import type { GeneralTradeLaborSavedTemplate } from '../types/generalTradeLabor';
import type { GeneralTradeLaborInput } from '../types/generalTradeLabor';

const STORAGE_KEY = 'generalTradeLaborUserTemplates';

function readAll(): GeneralTradeLaborSavedTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GeneralTradeLaborSavedTemplate =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as GeneralTradeLaborSavedTemplate).id === 'string' &&
        typeof (item as GeneralTradeLaborSavedTemplate).name === 'string' &&
        typeof (item as GeneralTradeLaborSavedTemplate).snapshot === 'object',
    );
  } catch {
    return [];
  }
}

function writeAll(templates: GeneralTradeLaborSavedTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function listUserTemplates(): GeneralTradeLaborSavedTemplate[] {
  return readAll().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function saveUserTemplate(
  name: string,
  snapshot: GeneralTradeLaborInput,
): GeneralTradeLaborSavedTemplate {
  const now = new Date().toISOString();
  const entry: GeneralTradeLaborSavedTemplate = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled template',
    createdAt: now,
    updatedAt: now,
    snapshot: { ...snapshot },
  };
  const all = readAll();
  all.push(entry);
  writeAll(all);
  return entry;
}

export function updateUserTemplate(
  id: string,
  updates: { name?: string; snapshot?: GeneralTradeLaborInput },
): GeneralTradeLaborSavedTemplate | null {
  const all = readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const now = new Date().toISOString();
  const next: GeneralTradeLaborSavedTemplate = {
    ...all[idx],
    ...(updates.name !== undefined ? { name: updates.name.trim() || all[idx].name } : {}),
    ...(updates.snapshot !== undefined ? { snapshot: { ...updates.snapshot } } : {}),
    updatedAt: now,
  };
  all[idx] = next;
  writeAll(all);
  return next;
}

export function deleteUserTemplate(id: string): boolean {
  const all = readAll();
  const filtered = all.filter((t) => t.id !== id);
  if (filtered.length === all.length) return false;
  writeAll(filtered);
  return true;
}

export function getUserTemplateById(
  id: string,
): GeneralTradeLaborSavedTemplate | undefined {
  return readAll().find((t) => t.id === id);
}
