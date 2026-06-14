import type { CalculatorFunctionTab } from './constructionCalculatorTypes';

/**
 * Single source of truth that ties each visible calculator tab to the help
 * section(s) that document it. The function tab bar and the help modal both
 * derive from this registry so they cannot drift apart.
 */
export type CalculatorModuleGroup = 'core' | 'materials' | 'layout' | 'geometry' | 'cost';

export interface CalculatorModuleMeta {
  /** Function tab id rendered in the calculator (matches CalculatorFunctionTab). */
  tab: CalculatorFunctionTab;
  /** Short label shown on the tab button. */
  label: string;
  /** Grouping used for ordering and chip association. */
  group: CalculatorModuleGroup;
  /** Help section ids that document this tab. Must be non-empty. */
  helpSectionIds: string[];
}

export const CALCULATOR_MODULES: CalculatorModuleMeta[] = [
  { tab: 'core', label: 'Core', group: 'core', helpSectionIds: ['core-dimension-math'] },
  { tab: 'area', label: 'Area', group: 'geometry', helpSectionIds: ['area'] },
  { tab: 'volume', label: 'Volume', group: 'geometry', helpSectionIds: ['volume'] },
  { tab: 'board-feet', label: 'Board Ft', group: 'materials', helpSectionIds: ['board-feet'] },
  { tab: 'concrete', label: 'Concrete', group: 'materials', helpSectionIds: ['concrete-volume'] },
  { tab: 'blocks', label: 'Blocks', group: 'materials', helpSectionIds: ['blocks-masonry'] },
  { tab: 'drywall', label: 'Drywall', group: 'materials', helpSectionIds: ['drywall-sheet-goods'] },
  { tab: 'stairs', label: 'Stairs', group: 'layout', helpSectionIds: ['stairs'] },
  { tab: 'triangle', label: 'Triangle', group: 'layout', helpSectionIds: ['right-triangle-pitch'] },
  {
    tab: 'circle',
    label: 'Circle',
    group: 'geometry',
    helpSectionIds: ['circle', 'arc', 'cylinder-column-volume', 'cone-volume'],
  },
  { tab: 'conversions', label: 'Convert', group: 'core', helpSectionIds: ['unit-conversions'] },
];

/**
 * Help sections that document cross-cutting behavior available on multiple tabs
 * rather than a single tab (e.g. the cost fields shared by several panels).
 */
export const CROSS_CUTTING_HELP_SECTION_IDS: string[] = ['cost-per-unit'];

/** All help section ids that the registry expects to exist, in display order. */
export function expectedHelpSectionIds(): string[] {
  const fromTabs = CALCULATOR_MODULES.flatMap((m) => m.helpSectionIds);
  return [...fromTabs, ...CROSS_CUTTING_HELP_SECTION_IDS];
}
