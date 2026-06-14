import { describe, expect, it } from 'vitest';
import {
  CALCULATOR_MODULES,
  CROSS_CUTTING_HELP_SECTION_IDS,
  expectedHelpSectionIds,
} from '../constructionCalculatorModules';
import { CALCULATOR_HELP_SECTIONS } from '../../ui/constructionCalculatorHelpContent';

const VISIBLE_TABS = [
  'core',
  'area',
  'volume',
  'board-feet',
  'concrete',
  'blocks',
  'drywall',
  'stairs',
  'triangle',
  'circle',
  'conversions',
] as const;

describe('calculator module registry', () => {
  it('registers every visible calculator tab exactly once', () => {
    const tabs = CALCULATOR_MODULES.map((m) => m.tab);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect(tabs.sort()).toEqual([...VISIBLE_TABS].sort());
  });

  it('maps every tab to at least one help section', () => {
    for (const mod of CALCULATOR_MODULES) {
      expect(mod.helpSectionIds.length).toBeGreaterThan(0);
    }
  });

  it('every help section id referenced by the registry exists in help content', () => {
    const helpIds = new Set(CALCULATOR_HELP_SECTIONS.map((s) => s.id));
    for (const id of expectedHelpSectionIds()) {
      expect(helpIds.has(id), `registry references missing help section "${id}"`).toBe(true);
    }
  });

  it('every implemented help section is reachable from a tab or cross-cutting list', () => {
    const referenced = new Set(expectedHelpSectionIds());
    for (const s of CALCULATOR_HELP_SECTIONS) {
      // The Arc section is a documented "not available in this version" placeholder.
      if (s.id === 'arc') {
        expect(referenced.has(s.id)).toBe(true);
        continue;
      }
      expect(
        referenced.has(s.id),
        `help section "${s.id}" is not mapped to any tab or cross-cutting entry`,
      ).toBe(true);
    }
  });

  it('does not list cross-cutting sections as standalone tabs', () => {
    const tabHelpIds = CALCULATOR_MODULES.flatMap((m) => m.helpSectionIds);
    for (const id of CROSS_CUTTING_HELP_SECTION_IDS) {
      expect(tabHelpIds).not.toContain(id);
    }
  });
});
