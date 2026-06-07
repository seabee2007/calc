import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ScheduleActivity } from '../adapters/estimateLineItemsToScheduleActivities';
import type { CpmLogicLink } from '../cpmTypes';
import {
  CIRCULAR_LOGIC_AUTO_LAYOUT_WARNING,
  LOGIC_NETWORK_ACTIVITY_ROW_SPACING,
  LOGIC_NETWORK_AUTO_LAYOUT_START_X,
  LOGIC_NETWORK_AUTO_LAYOUT_START_Y,
  LOGIC_NETWORK_COLUMN_SPACING,
  LOGIC_NETWORK_DIVISION_COLUMN_SPACING,
  LOGIC_NETWORK_LINKED_UNLINKED_GAP,
  LOGIC_NETWORK_ROW_SPACING,
  autoLayoutLogicNetwork,
} from '../logic/autoLayoutLogicNetwork';

const logicNetworkCanvasSource = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../ui/components/scheduling/EstimateLogicNetworkCanvas.tsx',
  ),
  'utf8',
);

function makeActivity(
  code: string,
  options: Partial<ScheduleActivity> = {},
): ScheduleActivity {
  return {
    activityCode: code,
    activityDescription: options.activityDescription ?? code,
    divisionCode: options.divisionCode ?? '01',
    divisionName: options.divisionName ?? 'General',
    workPackageName: options.workPackageName,
    durationDays: options.durationDays ?? 3,
    laborHours: 0,
    manDays: 0,
    crewDays: 0,
    crewSize: 2,
    totalCost: 0,
    relationshipType: 'FS',
    lagDays: 0,
    ...options,
  };
}

function makeLink(predecessor: string, successor: string): CpmLogicLink {
  return {
    predecessorActivityCode: predecessor,
    successorActivityCode: successor,
    relationshipType: 'FS',
    lagDays: 0,
  };
}

function layoutByCode(layout: ReturnType<typeof autoLayoutLogicNetwork>['layout']) {
  return new Map(layout.map((entry) => [entry.activityCode, entry]));
}

function assertNoDuplicatePositions(
  layout: ReturnType<typeof autoLayoutLogicNetwork>['layout'],
): void {
  const positions = layout.map((entry) => `${entry.x},${entry.y}`);
  expect(new Set(positions).size).toBe(positions.length);
}

describe('autoLayoutLogicNetwork', () => {
  it('no links groups activities by division columns', () => {
    const activities = [
      makeActivity('A1', { divisionCode: '01' }),
      makeActivity('A2', { divisionCode: '01' }),
      makeActivity('B1', { divisionCode: '02' }),
    ];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: [] });
    const byCode = layoutByCode(layout);

    expect(byCode.get('A1')).toEqual({
      activityCode: 'A1',
      x: LOGIC_NETWORK_AUTO_LAYOUT_START_X,
      y: LOGIC_NETWORK_AUTO_LAYOUT_START_Y,
    });
    expect(byCode.get('A2')?.x).toBe(LOGIC_NETWORK_AUTO_LAYOUT_START_X);
    expect(byCode.get('A2')?.y).toBe(
      LOGIC_NETWORK_AUTO_LAYOUT_START_Y + LOGIC_NETWORK_ACTIVITY_ROW_SPACING,
    );
    expect(byCode.get('B1')?.x).toBe(
      LOGIC_NETWORK_AUTO_LAYOUT_START_X + LOGIC_NETWORK_DIVISION_COLUMN_SPACING,
    );
    assertNoDuplicatePositions(layout);
  });

  it('no links sorts divisions by code and activities by activity code', () => {
    const activities = [
      makeActivity('C1', { divisionCode: '03' }),
      makeActivity('A2', { divisionCode: '01' }),
      makeActivity('A1', { divisionCode: '01' }),
      makeActivity('B1', { divisionCode: '02' }),
    ];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: [] });
    const byCode = layoutByCode(layout);

    expect(byCode.get('A1')?.y).toBeLessThan(byCode.get('A2')!.y);
    expect(byCode.get('A1')?.x).toBeLessThan(byCode.get('B1')!.x);
    expect(byCode.get('B1')?.x).toBeLessThan(byCode.get('C1')!.x);
  });

  it('simple chain lays out left to right', () => {
    const activities = [makeActivity('A'), makeActivity('B'), makeActivity('C')];
    const links = [makeLink('A', 'B'), makeLink('B', 'C')];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: links });
    const byCode = layoutByCode(layout);

    expect(byCode.get('A')!.x).toBeLessThan(byCode.get('B')!.x);
    expect(byCode.get('B')!.x).toBeLessThan(byCode.get('C')!.x);
    expect(byCode.get('A')!.x).toBe(LOGIC_NETWORK_AUTO_LAYOUT_START_X);
    expect(byCode.get('B')!.x).toBe(
      LOGIC_NETWORK_AUTO_LAYOUT_START_X + LOGIC_NETWORK_COLUMN_SPACING,
    );
    expect(byCode.get('C')!.x).toBe(
      LOGIC_NETWORK_AUTO_LAYOUT_START_X + LOGIC_NETWORK_COLUMN_SPACING * 2,
    );
  });

  it('parallel branches share next column and stack vertically', () => {
    const activities = [
      makeActivity('A'),
      makeActivity('B'),
      makeActivity('C'),
      makeActivity('D'),
    ];
    const links = [
      makeLink('A', 'B'),
      makeLink('A', 'C'),
      makeLink('B', 'D'),
      makeLink('C', 'D'),
    ];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: links });
    const byCode = layoutByCode(layout);

    expect(byCode.get('B')!.x).toBe(byCode.get('C')!.x);
    expect(byCode.get('B')!.y).not.toBe(byCode.get('C')!.y);
    expect(byCode.get('D')!.x).toBeGreaterThan(byCode.get('B')!.x);
    expect(byCode.get('D')!.x).toBeGreaterThan(byCode.get('C')!.x);
    expect(Math.abs(byCode.get('B')!.y - byCode.get('C')!.y)).toBe(LOGIC_NETWORK_ROW_SPACING);
  });

  it('merge activity is placed after deepest predecessor', () => {
    const activities = [
      makeActivity('A'),
      makeActivity('B'),
      makeActivity('C'),
      makeActivity('D'),
    ];
    const links = [makeLink('A', 'B'), makeLink('B', 'C'), makeLink('A', 'D'), makeLink('C', 'D')];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: links });
    const byCode = layoutByCode(layout);

    expect(byCode.get('C')!.x).toBeGreaterThan(byCode.get('B')!.x);
    expect(byCode.get('D')!.x).toBeGreaterThan(byCode.get('C')!.x);
  });

  it('mixed linked/unlinked places unlinked activities below linked network', () => {
    const activities = [
      makeActivity('A', { divisionCode: '01' }),
      makeActivity('B', { divisionCode: '01' }),
      makeActivity('U1', { divisionCode: '02' }),
      makeActivity('U2', { divisionCode: '03' }),
    ];
    const links = [makeLink('A', 'B')];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: links });
    const byCode = layoutByCode(layout);

    const linkedMaxY = Math.max(byCode.get('A')!.y, byCode.get('B')!.y);
    expect(byCode.get('U1')!.y).toBeGreaterThanOrEqual(
      linkedMaxY + LOGIC_NETWORK_LINKED_UNLINKED_GAP,
    );
    expect(byCode.get('U2')!.y).toBeGreaterThanOrEqual(
      linkedMaxY + LOGIC_NETWORK_LINKED_UNLINKED_GAP,
    );
  });

  it('layout is deterministic', () => {
    const activities = [
      makeActivity('B1', { divisionCode: '02' }),
      makeActivity('A1', { divisionCode: '01' }),
      makeActivity('A2', { divisionCode: '01' }),
    ];
    const links = [makeLink('A1', 'A2')];
    const first = autoLayoutLogicNetwork({ activities, logicLinks: links });
    const second = autoLayoutLogicNetwork({ activities, logicLinks: links });
    expect(second.layout).toEqual(first.layout);
  });

  it('cycles do not crash and fall back to division grouping', () => {
    const activities = [
      makeActivity('A', { divisionCode: '01' }),
      makeActivity('B', { divisionCode: '02' }),
    ];
    const links = [makeLink('A', 'B'), makeLink('B', 'A')];
    const result = autoLayoutLogicNetwork({ activities, logicLinks: links });

    expect(result.warning).toBe(CIRCULAR_LOGIC_AUTO_LAYOUT_WARNING);
    expect(result.layout).toHaveLength(2);
    expect(result.layout[0]!.x).toBeLessThan(result.layout[1]!.x);
    assertNoDuplicatePositions(result.layout);
  });

  it('output contains every activity exactly once', () => {
    const activities = [
      makeActivity('A'),
      makeActivity('B'),
      makeActivity('C'),
      makeActivity('D'),
    ];
    const links = [makeLink('A', 'B')];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: links });
    const codes = layout.map((entry) => entry.activityCode);

    expect(layout).toHaveLength(activities.length);
    expect(new Set(codes).size).toBe(activities.length);
    expect(codes.sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('output has no duplicate positions', () => {
    const activities = [
      makeActivity('A', { divisionCode: '01' }),
      makeActivity('B', { divisionCode: '01' }),
      makeActivity('C', { divisionCode: '02' }),
      makeActivity('D', { divisionCode: '03' }),
    ];
    const links = [makeLink('A', 'B'), makeLink('B', 'C'), makeLink('C', 'D')];
    const { layout } = autoLayoutLogicNetwork({ activities, logicLinks: links });
    assertNoDuplicatePositions(layout);
  });

  it('auto layout does not modify logicLinks', () => {
    const activities = [makeActivity('A'), makeActivity('B')];
    const links = [makeLink('A', 'B')];
    const linksCopy = structuredClone(links);
    autoLayoutLogicNetwork({ activities, logicLinks: links });
    expect(links).toEqual(linksCopy);
  });

  it('auto layout saves logicNetworkLayout only via canvas handler', () => {
    expect(logicNetworkCanvasSource).toContain('autoLayoutLogicNetwork');
    expect(logicNetworkCanvasSource).toContain('onLayoutChange(autoLayout)');
    expect(logicNetworkCanvasSource).not.toMatch(
      /handleAutoLayout[\s\S]{0,500}onLinksChange/,
    );
    expect(logicNetworkCanvasSource).toContain("showToast(warning ?? 'Layout updated')");
  });
});
