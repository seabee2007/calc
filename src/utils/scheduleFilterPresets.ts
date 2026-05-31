import type { ScheduleFilters } from '../types/scheduleEvent';

export interface SavedScheduleFilterPreset {
  id: string;
  name: string;
  filters: ScheduleFilters;
}

const STORAGE_KEY = 'scheduleFilterPresets';

function storageKey(userId: string): string {
  return `${STORAGE_KEY}_${userId}`;
}

export function loadScheduleFilterPresets(userId: string): SavedScheduleFilterPreset[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as SavedScheduleFilterPreset[];
  } catch {
    return [];
  }
}

export function saveScheduleFilterPreset(
  userId: string,
  name: string,
  filters: ScheduleFilters,
): SavedScheduleFilterPreset[] {
  const presets = loadScheduleFilterPresets(userId);
  const preset: SavedScheduleFilterPreset = {
    id: crypto.randomUUID(),
    name,
    filters: { ...filters },
  };
  const next = [...presets, preset];
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}

export function deleteScheduleFilterPreset(
  userId: string,
  presetId: string,
): SavedScheduleFilterPreset[] {
  const next = loadScheduleFilterPresets(userId).filter((p) => p.id !== presetId);
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}
