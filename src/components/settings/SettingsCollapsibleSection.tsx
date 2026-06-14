import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  BORDER_DEFAULT,
  FOCUS_RING,
  PREMIUM_PANEL,
  TEXT_FOREGROUND,
  TEXT_MUTED,
  TEXT_SUBTLE,
} from '../../theme/appTheme';

export type SettingsSectionId =
  | 'company'
  | 'tax'
  | 'labor'
  | 'preferences'
  | 'notifications';

const VALID_SECTION_IDS = new Set<string>([
  'company',
  'tax',
  'labor',
  'preferences',
  'notifications',
]);

export const SETTINGS_EXPANDED_SECTIONS_STORAGE_KEY = 'settings_expanded_sections';

export function isSettingsSectionId(value: string): value is SettingsSectionId {
  return VALID_SECTION_IDS.has(value);
}

export function readExpandedSettingsSections(): Set<SettingsSectionId> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(SETTINGS_EXPANDED_SECTIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is SettingsSectionId => isSettingsSectionId(String(id))));
  } catch {
    return new Set();
  }
}

export function persistExpandedSettingsSections(sections: Set<SettingsSectionId>): void {
  try {
    window.localStorage.setItem(
      SETTINGS_EXPANDED_SECTIONS_STORAGE_KEY,
      JSON.stringify([...sections]),
    );
  } catch {
    // ignore storage failures
  }
}

interface SettingsCollapsibleSectionProps {
  id: SettingsSectionId;
  icon: React.ReactNode;
  title: string;
  description: string;
  summaryChip?: string;
  unsaved?: boolean;
  expanded: boolean;
  onToggle: (id: SettingsSectionId) => void;
  children: React.ReactNode;
  testId?: string;
}

export function SettingsCollapsibleSection({
  id,
  icon,
  title,
  description,
  summaryChip,
  unsaved = false,
  expanded,
  onToggle,
  children,
  testId,
}: SettingsCollapsibleSectionProps) {
  const panelId = `settings-section-${id}`;
  const triggerId = `settings-section-trigger-${id}`;

  return (
    <section className={`overflow-hidden ${PREMIUM_PANEL}`} data-testid={testId}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        id={triggerId}
        onClick={() => onToggle(id)}
        className={`flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${FOCUS_RING}`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${BORDER_DEFAULT} bg-slate-50 dark:bg-slate-800/80`}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`text-lg font-semibold ${TEXT_FOREGROUND}`}>{title}</h2>
            {unsaved ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Unsaved changes
              </span>
            ) : null}
          </div>
          <p className={`mt-1 text-sm leading-relaxed ${TEXT_MUTED}`}>{description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          {summaryChip ? (
            <span
              className={`hidden rounded-full border ${BORDER_DEFAULT} bg-slate-50 px-2.5 py-0.5 text-xs font-medium sm:inline-flex dark:bg-slate-800/80 ${TEXT_SUBTLE}`}
            >
              {summaryChip}
            </span>
          ) : null}
          <ChevronDown
            className={`h-5 w-5 text-slate-400 transition-transform duration-200 ease-out ${
              expanded ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </div>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className={`border-t ${BORDER_DEFAULT} px-5 pb-5 pt-4`}>{children}</div>
        </div>
      </div>
    </section>
  );
}

interface SettingsLinkSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  summaryChip?: string;
  onNavigate: () => void;
  testId?: string;
}

export function SettingsLinkSection({
  icon,
  title,
  description,
  summaryChip = 'Open package',
  onNavigate,
  testId,
}: SettingsLinkSectionProps) {
  return (
    <section className={`overflow-hidden ${PREMIUM_PANEL}`} data-testid={testId}>
      <button
        type="button"
        onClick={onNavigate}
        className={`flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${FOCUS_RING}`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${BORDER_DEFAULT} bg-slate-50 dark:bg-slate-800/80`}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`text-lg font-semibold ${TEXT_FOREGROUND}`}>{title}</h2>
          <p className={`mt-1 text-sm leading-relaxed ${TEXT_MUTED}`}>{description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <span
            className={`rounded-full border ${BORDER_DEFAULT} bg-slate-50 px-2.5 py-0.5 text-xs font-medium dark:bg-slate-800/80 ${TEXT_SUBTLE}`}
          >
            {summaryChip}
          </span>
          <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
        </div>
      </button>
    </section>
  );
}
