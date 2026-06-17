import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  APP_DEFINITIONS,
  DEFINITION_CATEGORIES,
  filterDefinitions,
  findDefinitionByTerm,
} from '../definitions';
import { useDefinitionsHelpStore } from '../definitionsHelpStore';

const helpButtonSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../HelpButton.tsx'),
  'utf8',
);
const modalSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../DefinitionsHelpModal.tsx'),
  'utf8',
);
const estimateGuideContentSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../estimateGuideContent.tsx'),
  'utf8',
);
const plannerAppBarSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../components/planner/PlannerAppBar.tsx'),
  'utf8',
);
const appProfileMenuSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../components/layout/AppProfileMenu.tsx'),
  'utf8',
);
const navbarSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../components/layout/Navbar.tsx'),
  'utf8',
);
const estimateWorkspaceSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../estimating/ui/EstimateWorkspacePage.tsx',
  ),
  'utf8',
);
const estimateActionsMenuSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../estimating/ui/components/EstimateWorkspaceActionsMenu.tsx',
  ),
  'utf8',
);
const estimateToolbarActionsSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../estimating/ui/components/EstimateWorkspaceToolbarActions.tsx',
  ),
  'utf8',
);
const guidedHelpBadgeSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../estimating/ui/components/EstimateGuidedHelpBadge.tsx',
  ),
  'utf8',
);
const appSource = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../App.tsx'),
  'utf8',
);

describe('definitions data', () => {
  it('includes required estimating and document terms', () => {
    expect(findDefinitionByTerm('Crew-Day')).toBeDefined();
    expect(findDefinitionByTerm('Man-Day')).toBeDefined();
    expect(findDefinitionByTerm('Critical Path')).toBeDefined();
    expect(findDefinitionByTerm('RFI')).toBeDefined();
  });

  it('renders all category filters', () => {
    expect(DEFINITION_CATEGORIES.map((category) => category.label)).toEqual([
      'All',
      'Estimating',
      'Scheduling',
      'Gantt / CPM',
      'Cost & Markup',
      'Project Management',
      'Construction Documents',
      'Acronyms',
    ]);
    expect(APP_DEFINITIONS.length).toBeGreaterThan(40);
  });
});

describe('filterDefinitions', () => {
  it('filters by term text', () => {
    const results = filterDefinitions({ query: 'overhead' });
    expect(results.some((definition) => definition.term === 'Overhead')).toBe(true);
  });

  it('filters by alias text', () => {
    const results = filterDefinitions({ query: 'crew days' });
    expect(results.some((definition) => definition.term === 'Crew-Day')).toBe(true);
  });

  it('returns no matches for unknown search text', () => {
    const results = filterDefinitions({ query: 'zzzz-not-a-real-term' });
    expect(results).toHaveLength(0);
  });

  it('filters by category', () => {
    const results = filterDefinitions({ category: 'construction-documents', query: 'rfi' });
    expect(results).toHaveLength(1);
    expect(results[0]?.term).toBe('RFI');
  });
});

describe('definitions help UI wiring', () => {
  beforeEach(() => {
    useDefinitionsHelpStore.setState({
      isOpen: false,
      focusTerm: null,
      activeSection: 'definitions',
      lastSection: 'definitions',
    });
  });

  it('opens the modal from the help button store', () => {
    expect(useDefinitionsHelpStore.getState().isOpen).toBe(false);
    useDefinitionsHelpStore.getState().open('float');
    expect(useDefinitionsHelpStore.getState().isOpen).toBe(true);
    expect(useDefinitionsHelpStore.getState().focusTerm).toBe('float');
    expect(useDefinitionsHelpStore.getState().activeSection).toBe('definitions');
  });

  it('opens the guide section when requested without a focus term', () => {
    useDefinitionsHelpStore.getState().open(undefined, { section: 'guide' });
    expect(useDefinitionsHelpStore.getState().activeSection).toBe('guide');
    expect(useDefinitionsHelpStore.getState().lastSection).toBe('guide');
    expect(useDefinitionsHelpStore.getState().focusTerm).toBeNull();
  });

  it('remembers the last selected section for generic opens', () => {
    useDefinitionsHelpStore.getState().open(undefined, { section: 'guide' });
    useDefinitionsHelpStore.getState().close();
    useDefinitionsHelpStore.getState().open();
    expect(useDefinitionsHelpStore.getState().activeSection).toBe('guide');
  });

  it('closes the modal and clears focus term', () => {
    useDefinitionsHelpStore.getState().open('RFI');
    useDefinitionsHelpStore.getState().close();
    expect(useDefinitionsHelpStore.getState().isOpen).toBe(false);
    expect(useDefinitionsHelpStore.getState().focusTerm).toBeNull();
  });

  it('wires help buttons in app headers and estimate workspace actions menu', () => {
    expect(helpButtonSource).toContain('useDefinitionsHelpStore');
    expect(helpButtonSource).toContain('open(focusTerm)');
    expect(appProfileMenuSource).toContain('useDefinitionsHelpStore');
    expect(plannerAppBarSource).not.toContain('HelpButton');
    expect(navbarSource).not.toContain('HelpButton');
    expect(estimateWorkspaceSource).not.toContain('HelpButton');
    expect(estimateWorkspaceSource).toContain('useDefinitionsHelpStore');
    expect(estimateWorkspaceSource).toContain('handleOpenHelp');
    expect(estimateWorkspaceSource).toContain('handleOpenGuidedHelp');
    expect(estimateWorkspaceSource).toContain('showGuidedHelpBadge');
    expect(estimateWorkspaceSource).toContain("section: 'guide'");
    expect(estimateWorkspaceSource).toContain('markEstimateGuideDismissed');
    expect(estimateToolbarActionsSource).not.toContain('HelpButton');
    expect(estimateToolbarActionsSource).toContain('EstimateGuidedHelpBadge');
    expect(estimateToolbarActionsSource).toContain('showGuidedHelpBadge');
    expect(guidedHelpBadgeSource).toContain('aria-label="Open estimate help"');
    expect(guidedHelpBadgeSource).toContain('Need help? Guide');
    expect(estimateActionsMenuSource).toContain('help-definitions');
    expect(estimateActionsMenuSource).toContain('HelpCircle');
    expect(estimateActionsMenuSource).toContain('onOpenHelp');
    expect(appSource).toContain('DefinitionsHelpHost');
  });

  it('shows no-results state and close controls in the modal', () => {
    expect(modalSource).toContain('No definitions found');
    expect(modalSource).toContain('Definitions & Help');
    expect(modalSource).toContain('EstimateGuideContent');
    expect(estimateGuideContentSource).toContain('How to Fill Out This Estimate');
    expect(modalSource).toContain('Guide');
    expect(modalSource).toContain('Definitions');
    expect(modalSource).toContain('aria-label="Close definitions help"');
    expect(modalSource).toContain("event.key === 'Escape'");
  });
});
