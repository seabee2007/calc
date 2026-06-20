import { describe, expect, it } from 'vitest';
import {
  createBlankCmuBuildingPreset,
  createFiveBySixCmuBuildingPreset,
} from '../domain/designBuilderPreset';
import {
  createDesignHistoryState,
  createDesignSnapshot,
  patchDesignSnapshot,
  pushDesignHistoryCommand,
  redoDesignHistoryCommand,
  snapshotsEqual,
  undoDesignHistoryCommand,
} from '../domain/designBuilderHistory';

function snapshotWithOpeningsCount(count: number) {
  const preset = createFiveBySixCmuBuildingPreset();
  return createDesignSnapshot({
    preset: {
      ...preset,
      wall: {
        ...preset.wall,
        openings: preset.wall.openings.slice(0, count),
      },
    },
    objects: [],
    layoutState: 'demo_loaded',
  });
}

function snapshotWithSegmentCount(segmentCount: number) {
  const preset = createFiveBySixCmuBuildingPreset();
  return createDesignSnapshot({
    preset: {
      ...preset,
      wallLayout: {
        ...preset.wallLayout,
        segments: preset.wallLayout.segments.slice(0, segmentCount),
      },
    },
    objects: [],
    layoutState: 'demo_loaded',
  });
}

describe('designBuilderHistory', () => {
  it('records undo and redo in reverse chronological order', () => {
    let state = createDesignHistoryState();
    const wall = snapshotWithSegmentCount(4);
    const door = snapshotWithOpeningsCount(2);
    const settings = createDesignSnapshot({
      preset: {
        ...createFiveBySixCmuBuildingPreset(),
        wall: {
          ...createFiveBySixCmuBuildingPreset().wall,
          heightMeters: 3.1,
        },
      },
      objects: [],
      layoutState: 'demo_loaded',
    });

    state = pushDesignHistoryCommand(state, {
      id: 'wall',
      label: 'Draw wall',
      kind: 'wall_add',
      before: wall,
      after: snapshotWithSegmentCount(5),
    });
    state = pushDesignHistoryCommand(state, {
      id: 'door',
      label: 'Place door',
      kind: 'opening_add',
      before: snapshotWithOpeningsCount(1),
      after: door,
    });
    state = pushDesignHistoryCommand(state, {
      id: 'settings',
      label: 'Edit masonry settings',
      kind: 'masonry_settings_update',
      before: door,
      after: settings,
    });

    let result = undoDesignHistoryCommand(state);
    expect(result.command?.label).toBe('Edit masonry settings');
    state = result.state;

    result = undoDesignHistoryCommand(state);
    expect(result.command?.label).toBe('Place door');
    state = result.state;

    result = undoDesignHistoryCommand(state);
    expect(result.command?.label).toBe('Draw wall');
    state = result.state;

    result = redoDesignHistoryCommand(state);
    expect(result.command?.label).toBe('Draw wall');
    state = result.state;

    result = redoDesignHistoryCommand(state);
    expect(result.command?.label).toBe('Place door');
  });

  it('clears redo stack when a new command is pushed after undo', () => {
    let state = createDesignHistoryState();
    const before = snapshotWithSegmentCount(4);
    const after = snapshotWithSegmentCount(5);
    state = pushDesignHistoryCommand(state, {
      id: 'wall',
      label: 'Draw wall',
      kind: 'wall_add',
      before,
      after,
    });
    const undone = undoDesignHistoryCommand(state);
    state = undone.state;
    state = pushDesignHistoryCommand(state, {
      id: 'door',
      label: 'Place door',
      kind: 'opening_add',
      before: after,
      after: snapshotWithOpeningsCount(2),
    });
    expect(state.redoStack).toHaveLength(0);
  });

  it('detects equal snapshots and patches preset state', () => {
    const preset = createBlankCmuBuildingPreset();
    const snapshot = createDesignSnapshot({
      preset,
      objects: [],
      layoutState: 'blank',
    });
    expect(snapshotsEqual(snapshot, structuredClone(snapshot))).toBe(true);

    const patched = patchDesignSnapshot(snapshot, preset.name, (current) => ({
      ...current,
      wall: { ...current.wall, heightMeters: 3.2 },
    }));
    expect(patched.masonryWall.heightMeters).toBe(3.2);
    expect(snapshotsEqual(snapshot, patched)).toBe(false);
  });
});
