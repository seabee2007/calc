import type { DesignWallLayoutParameters } from '../types';

export type WallLayoutCommand =
  | { type: 'set_layout'; layout: DesignWallLayoutParameters; label: string }
  | { type: 'patch_layout'; patch: Partial<DesignWallLayoutParameters>; label: string };

export interface WallLayoutHistoryState {
  present: DesignWallLayoutParameters;
  past: DesignWallLayoutParameters[];
  future: DesignWallLayoutParameters[];
}

export function createWallLayoutHistory(
  initial: DesignWallLayoutParameters,
): WallLayoutHistoryState {
  return { present: initial, past: [], future: [] };
}

export function applyWallLayoutCommand(
  state: WallLayoutHistoryState,
  command: WallLayoutCommand,
): WallLayoutHistoryState {
  const nextPresent =
    command.type === 'set_layout'
      ? command.layout
      : { ...state.present, ...command.patch, kind: 'wall_layout' as const };
  if (nextPresent === state.present) return state;
  return {
    present: nextPresent,
    past: [...state.past, state.present],
    future: [],
  };
}

export function undoWallLayoutHistory(state: WallLayoutHistoryState): WallLayoutHistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return {
    present: previous,
    past: state.past.slice(0, -1),
    future: [state.present, ...state.future],
  };
}

export function redoWallLayoutHistory(state: WallLayoutHistoryState): WallLayoutHistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return {
    present: next,
    past: [...state.past, state.present],
    future: state.future.slice(1),
  };
}

export function canUndoWallLayout(state: WallLayoutHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedoWallLayout(state: WallLayoutHistoryState): boolean {
  return state.future.length > 0;
}
