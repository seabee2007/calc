import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALLOW_PROJECT_EXTENSION_LABEL,
  PROJECT_EXTENSION_DISABLED_WARNING,
  RESOURCE_LEVELING_SCOPE_NOTE,
} from '../ui/components/scheduling/resourceLevelingModalCopy';

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('schedule settings and resource leveling UI', () => {
  it('uses local string state for project and default crew size inputs', () => {
    const panelSource = readFileSync(
      join(uiRoot, 'components', 'EstimateSettingsPanel.tsx'),
      'utf8',
    );
    const inputSource = readFileSync(
      join(uiRoot, 'components', 'PositiveIntegerInput.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('PositiveIntegerInput');
    expect(panelSource).toContain('label="Project Crew Size"');
    expect(panelSource).toContain('label="Default activity crew size"');
    expect(inputSource).toContain('commitPositiveIntegerInput');
    expect(inputSource).toContain('setInputValue(event.target.value)');
    expect(inputSource).not.toContain('Number(');
  });

  it('hydrates project crew size from the planner project context', () => {
    const contextSource = readFileSync(
      join(srcRoot, 'contexts', 'PlannerProjectContext.tsx'),
      'utf8',
    );

    expect(contextSource).toContain('project_crew_size');
    expect(contextSource).toContain('projectCrewSize?: number');
    expect(contextSource).toContain('projectCrewSize:');
  });

  it('saves project crew size to the project record and refreshes consumers', () => {
    const pageSource = readFileSync(join(uiRoot, 'EstimateWorkspacePage.tsx'), 'utf8');
    const scheduleSettingsSource = readFileSync(
      join(uiRoot, 'hooks', 'useScheduleSettings.ts'),
      'utf8',
    );

    expect(pageSource).toContain('optimisticProjectCrewSize');
    expect(pageSource).toContain('updateProject(project.id, { projectCrewSize: normalized })');
    expect(pageSource).toContain('await reloadPlannerProject()');
    expect(pageSource).toContain(
      'projectCrewSize: optimisticProjectCrewSize ?? project?.projectCrewSize',
    );
    expect(pageSource).toContain('availableCrewSize: projectAvailableCrewSize');
    expect(scheduleSettingsSource).not.toContain('estimateSettingsRaw?.defaultCrewSize');
    expect(scheduleSettingsSource).toContain('defaultCrewSize: estimateSettings.defaultCrewSize');
  });

  it('keeps project crew size separate from default activity crew size', () => {
    const panelSource = readFileSync(
      join(uiRoot, 'components', 'EstimateSettingsPanel.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('onCommit={onProjectCrewSizeChange}');
    expect(panelSource).toContain('onCommit={(value) => patch({ defaultCrewSize: value })}');
    expect(panelSource).toContain('This is not the project daily labor cap.');
  });

  it('renders allow project extension control copy in the resource leveling modal', () => {
    const modalSource = readFileSync(
      join(uiRoot, 'components', 'scheduling', 'ResourceLevelingModal.tsx'),
      'utf8',
    );
    const pageSource = readFileSync(join(uiRoot, 'EstimateWorkspacePage.tsx'), 'utf8');

    expect(ALLOW_PROJECT_EXTENSION_LABEL).toBe('Allow project extension beyond float');
    expect(modalSource).toContain('ALLOW_PROJECT_EXTENSION_LABEL');
    expect(modalSource).toContain('RESOURCE_LEVELING_SCOPE_NOTE');
    expect(modalSource).toContain('CREW_OPTIMIZATION_FUTURE_NOTE');
    expect(RESOURCE_LEVELING_SCOPE_NOTE).toContain('does not change crew sizes');
    expect(modalSource).toContain('allowProjectExtension');
    expect(modalSource).toContain('onAllowProjectExtensionChange');
    expect(modalSource).toContain('disabled={!canApply}');
    expect(PROJECT_EXTENSION_DISABLED_WARNING).toContain('Allow project extension');
    expect(pageSource).toContain('allowProjectExtension');
    expect(pageSource).toContain('handleLevelingAllowProjectExtensionChange');
    expect(pageSource).toContain('runResourceLevelingPreview(false)');
  });
});
