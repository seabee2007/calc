import { create } from 'zustand';
import type { CmuBuildingPreset } from '../domain/designBuilderPreset';
import type {
  DesignBuilderCameraSnapshot,
  DesignBuilderLayoutMode,
  DesignBuilderSnapMode,
  DesignBuilderToolMode,
  DesignEstimatePreviewLine,
  DesignModel,
  DesignModelObject,
  DesignObjectType,
  DesignQuantityItem,
  DesignUnitSystem,
  MasonryToolMode,
} from '../types';

const STORAGE_KEY = 'arden:designBuilder:sessions';

export interface DesignBuilderViewerSizeState {
  height: number;
  rightPanelWidth: number;
}

export interface DesignBuilderSessionState {
  layoutState: DesignBuilderLayoutMode;
  layoutEpoch: number;
  preset: CmuBuildingPreset | null;
  designModel: DesignModel | null;
  objects: DesignModelObject[];
  unitSystem: DesignUnitSystem;
  selectedObjectType: DesignObjectType | null;
  selectedOpeningId: string | null;
  toolMode: DesignBuilderToolMode;
  manualMasonryEnabled: boolean;
  masonryToolMode: MasonryToolMode;
  previewLines: DesignEstimatePreviewLine[];
  persistedQuantityItems: DesignQuantityItem[];
  changedAfterCommit: boolean;
  viewMode: 'plan' | '3d';
  snapMode: DesignBuilderSnapMode;
  objectTreeExpanded: Record<string, boolean>;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  viewerSize: DesignBuilderViewerSizeState | null;
  camera: DesignBuilderCameraSnapshot | null;
  dirty: boolean;
  hydratedAt: string;
}

interface DesignBuilderSessionStore {
  sessions: Record<string, DesignBuilderSessionState>;
  getSession: (key: string) => DesignBuilderSessionState | undefined;
  saveSession: (key: string, patch: Partial<DesignBuilderSessionState>) => void;
  clearSession: (key: string) => void;
}

export function designBuilderSessionKey(projectId: string, estimateId: string | null | undefined): string {
  return `${projectId}:${estimateId ?? 'project'}`;
}

function readStoredSessions(): Record<string, DesignBuilderSessionState> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DesignBuilderSessionState>;
  } catch {
    return {};
  }
}

function writeStoredSessions(sessions: Record<string, DesignBuilderSessionState>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Session state is best-effort only.
  }
}

export const useDesignBuilderSessionStore = create<DesignBuilderSessionStore>((set, get) => ({
  sessions: readStoredSessions(),

  getSession: (key) => get().sessions[key],

  saveSession: (key, patch) => {
    set((state) => {
      const current = state.sessions[key];
      const nextSession: DesignBuilderSessionState = {
        layoutState: 'blank',
        layoutEpoch: 0,
        preset: null,
        designModel: null,
        objects: [],
        unitSystem: 'metric',
        selectedObjectType: 'building_footprint',
        selectedOpeningId: null,
        toolMode: 'select',
        manualMasonryEnabled: false,
        masonryToolMode: 'full_block',
        previewLines: [],
        persistedQuantityItems: [],
        changedAfterCommit: false,
        viewMode: '3d',
        snapMode: 'grid',
        objectTreeExpanded: {},
        leftPanelCollapsed: false,
        rightPanelCollapsed: false,
        viewerSize: null,
        camera: null,
        dirty: false,
        hydratedAt: new Date().toISOString(),
        ...current,
        ...patch,
      };
      const sessions = { ...state.sessions, [key]: nextSession };
      writeStoredSessions(sessions);
      return { sessions };
    });
  },

  clearSession: (key) => {
    set((state) => {
      const sessions = { ...state.sessions };
      delete sessions[key];
      writeStoredSessions(sessions);
      return { sessions };
    });
  },
}));
