import {
  getDesignComponentDefinition,
  type DesignComponentDefinition,
} from './designComponentRegistry';
import type {
  BuilderViewMode,
  DesignBuilderElevationViewState,
  DesignComponentType,
  DesignWallLayoutParameters,
  ElevationFace,
  PlacedDesignComponent,
  StructuralColumn,
} from '../types';

export type ComponentPlacementStatus =
  | 'idle'
  | 'component-selected'
  | 'previewing'
  | 'placing'
  | 'placed'
  | 'editing'
  | 'cancelled';

export interface HelperMeasurement {
  id: string;
  label: string;
  value: string;
}

export interface ComponentPlacementState {
  status: ComponentPlacementStatus;
  activeView: BuilderViewMode;
  activeComponentType: DesignComponentType | null;
  activeComponentDefinition: DesignComponentDefinition | null;
  draftComponentParameters: Record<string, unknown>;
  cursorWorldPosition: { xMeters: number; zMeters: number } | null;
  snapPosition: { xMeters: number; zMeters: number } | null;
  nearestReferences: Array<{ id: string; type: string; distanceMeters: number }>;
  helperMeasurements: HelperMeasurement[];
  placementPreview: PlacedDesignComponent | null;
  placementStatus: {
    valid: boolean;
    errors: string[];
  };
}

export type ComponentPlacementAction =
  | { type: 'select_component'; componentType: DesignComponentType; activeView: BuilderViewMode }
  | { type: 'update_parameters'; parameters: Record<string, unknown> }
  | {
      type: 'preview';
      activeView: BuilderViewMode;
      cursor: { xMeters: number; zMeters: number };
      snap?: { xMeters: number; zMeters: number } | null;
      helperMeasurements?: HelperMeasurement[];
      elevationFace?: ElevationFace;
    }
  | { type: 'placed'; component: PlacedDesignComponent }
  | { type: 'edit_component'; component: PlacedDesignComponent; activeView: BuilderViewMode }
  | { type: 'cancel' }
  | { type: 'reset'; activeView: BuilderViewMode };

export function createIdleComponentPlacementState(
  activeView: BuilderViewMode = 'plan',
): ComponentPlacementState {
  return {
    status: 'idle',
    activeView,
    activeComponentType: null,
    activeComponentDefinition: null,
    draftComponentParameters: {},
    cursorWorldPosition: null,
    snapPosition: null,
    nearestReferences: [],
    helperMeasurements: [],
    placementPreview: null,
    placementStatus: { valid: true, errors: [] },
  };
}

function createComponentId(type: DesignComponentType): string {
  return `component-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPlacedComponent(params: {
  type: DesignComponentType;
  activeView: BuilderViewMode;
  parameters: Record<string, unknown>;
  position: { xMeters: number; zMeters: number };
  elevationFace?: ElevationFace;
  id?: string;
  now?: string;
}): PlacedDesignComponent {
  const definition = getDesignComponentDefinition(params.type);
  const now = params.now ?? new Date().toISOString();
  const viewPlacement: PlacedDesignComponent['viewPlacement'] = {};
  if (params.activeView === 'plan') {
    viewPlacement.plan = {
      xMeters: params.position.xMeters,
      zMeters: params.position.zMeters,
    };
    viewPlacement.world = {
      xMeters: params.position.xMeters,
      yMeters: 0,
      zMeters: params.position.zMeters,
    };
  }
  if (params.activeView === 'elevation') {
    viewPlacement.elevation = {
      face: params.elevationFace ?? 'north',
      xMeters: params.position.xMeters,
      zMeters: params.position.zMeters,
    };
  }
  const parameters = {
    ...definition.defaultParameters,
    ...params.parameters,
  };
  return {
    id: params.id ?? createComponentId(params.type),
    type: params.type,
    division: definition.division,
    category: definition.category,
    viewPlacement,
    parameters,
    derived: definition.derive({ parameters, placement: viewPlacement }),
    references: params.activeView === 'elevation' ? { elevationFace: params.elevationFace ?? 'north' } : undefined,
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  };
}

function previewComponentForState(
  state: ComponentPlacementState,
  position: { xMeters: number; zMeters: number },
  elevationFace?: ElevationFace,
): PlacedDesignComponent | null {
  if (!state.activeComponentType) return null;
  return buildPlacedComponent({
    type: state.activeComponentType,
    activeView: state.activeView,
    parameters: state.draftComponentParameters,
    position,
    elevationFace,
    id: 'component-placement-preview',
    now: new Date(0).toISOString(),
  });
}

export function componentPlacementReducer(
  state: ComponentPlacementState,
  action: ComponentPlacementAction,
): ComponentPlacementState {
  switch (action.type) {
    case 'select_component': {
      const definition = getDesignComponentDefinition(action.componentType);
      const errors = definition.supportedViews.includes(action.activeView)
        ? []
        : [`${definition.displayName} is not supported in ${action.activeView} view.`];
      return {
        ...createIdleComponentPlacementState(action.activeView),
        status: 'component-selected',
        activeComponentType: action.componentType,
        activeComponentDefinition: definition,
        draftComponentParameters: { ...definition.defaultParameters },
        placementStatus: { valid: errors.length === 0, errors },
      };
    }
    case 'update_parameters': {
      if (!state.activeComponentDefinition) return state;
      const draftComponentParameters = {
        ...state.draftComponentParameters,
        ...action.parameters,
      };
      const errors = state.activeComponentDefinition.validate(draftComponentParameters);
      const placementPreview =
        state.snapPosition && state.activeComponentType
          ? buildPlacedComponent({
              type: state.activeComponentType,
              activeView: state.activeView,
              parameters: draftComponentParameters,
              position: state.snapPosition,
              elevationFace: state.placementPreview?.viewPlacement.elevation?.face,
              id: 'component-placement-preview',
              now: new Date(0).toISOString(),
            })
          : state.placementPreview;
      return {
        ...state,
        draftComponentParameters,
        placementPreview,
        placementStatus: { valid: errors.length === 0, errors },
      };
    }
    case 'preview': {
      const snapPosition = action.snap ?? action.cursor;
      const placementPreview = previewComponentForState(
        { ...state, activeView: action.activeView },
        snapPosition,
        action.elevationFace,
      );
      const errors = state.activeComponentDefinition?.validate(state.draftComponentParameters) ?? [];
      return {
        ...state,
        status: state.activeComponentType ? 'previewing' : state.status,
        activeView: action.activeView,
        cursorWorldPosition: action.cursor,
        snapPosition,
        helperMeasurements: action.helperMeasurements ?? [],
        placementPreview,
        placementStatus: { valid: errors.length === 0, errors },
      };
    }
    case 'placed':
      return {
        ...state,
        status: 'component-selected',
        placementPreview: null,
        cursorWorldPosition: null,
        snapPosition: null,
        helperMeasurements: [],
        placementStatus: { valid: true, errors: [] },
      };
    case 'edit_component': {
      const definition = getDesignComponentDefinition(action.component.type);
      return {
        ...createIdleComponentPlacementState(action.activeView),
        status: 'editing',
        activeComponentType: action.component.type,
        activeComponentDefinition: definition,
        draftComponentParameters: { ...definition.defaultParameters, ...action.component.parameters },
        placementPreview: action.component,
      };
    }
    case 'cancel':
      return {
        ...createIdleComponentPlacementState(state.activeView),
        status: 'cancelled',
      };
    case 'reset':
      return createIdleComponentPlacementState(action.activeView);
    default:
      return state;
  }
}

export function formatMeters(value: number): string {
  if (!Number.isFinite(value)) return '0.00 m';
  return `${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)} m`;
}

export function snapComponentPlanPoint(params: {
  point: { xMeters: number; zMeters: number };
  snapMode: 'grid' | 'cmu_module' | 'off';
  snapSpacingMeters: number;
}): { xMeters: number; zMeters: number } {
  if (params.snapMode === 'off') return params.point;
  const spacing = Math.max(0.001, params.snapSpacingMeters);
  return {
    xMeters: Math.round(params.point.xMeters / spacing) * spacing,
    zMeters: Math.round(params.point.zMeters / spacing) * spacing,
  };
}

export function resolvePlanHelperMeasurements(params: {
  position: { xMeters: number; zMeters: number };
  snapPosition: { xMeters: number; zMeters: number };
  layout: DesignWallLayoutParameters;
  columns?: readonly StructuralColumn[];
}): HelperMeasurement[] {
  const measurements: HelperMeasurement[] = [
    {
      id: 'cursor',
      label: 'Cursor',
      value: `X ${formatMeters(params.snapPosition.xMeters)} / Y ${formatMeters(params.snapPosition.zMeters)}`,
    },
  ];
  const nearestGridX = Math.round(params.position.xMeters / params.layout.gridSpacingMeters) * params.layout.gridSpacingMeters;
  const nearestGridZ = Math.round(params.position.zMeters / params.layout.gridSpacingMeters) * params.layout.gridSpacingMeters;
  measurements.push({
    id: 'grid-offset',
    label: 'Grid offset',
    value: `dX ${formatMeters(params.position.xMeters - nearestGridX)} / dY ${formatMeters(params.position.zMeters - nearestGridZ)}`,
  });
  if (params.columns && params.columns.length > 0) {
    const nearest = params.columns
      .map((column) => ({
        column,
        distance: Math.hypot(column.position.x - params.snapPosition.xMeters, column.position.z - params.snapPosition.zMeters),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearest) {
      measurements.push({
        id: 'nearest-column',
        label: 'Nearest column',
        value: formatMeters(nearest.distance),
      });
    }
  }
  return measurements.slice(0, 3);
}

export function resolveElevationHelperMeasurements(params: {
  position: { xMeters: number; zMeters: number };
  snapPosition: { xMeters: number; zMeters: number };
  elevationView: DesignBuilderElevationViewState;
  componentType?: DesignComponentType | null;
  parameters?: Record<string, unknown>;
}): HelperMeasurement[] {
  const measurements: HelperMeasurement[] = [
    {
      id: 'elevation-cursor',
      label: 'Elevation cursor',
      value: `X ${formatMeters(params.snapPosition.xMeters)} / Z ${formatMeters(params.snapPosition.zMeters)}`,
    },
    {
      id: 'face',
      label: 'Face',
      value: params.elevationView.face.toUpperCase(),
    },
  ];
  if (params.componentType === 'window' || params.componentType === 'door') {
    const sillHeight = typeof params.parameters?.sillHeightMeters === 'number'
      ? params.parameters.sillHeightMeters
      : Number(params.parameters?.sillHeightMeters ?? params.snapPosition.zMeters);
    const height = typeof params.parameters?.heightMeters === 'number'
      ? params.parameters.heightMeters
      : Number(params.parameters?.heightMeters ?? 0);
    measurements.push({
      id: 'head-height',
      label: params.componentType === 'door' ? 'Head height' : 'Sill / head',
      value: `${formatMeters(sillHeight)} / ${formatMeters(sillHeight + height)}`,
    });
  }
  if (params.componentType === 'column') {
    const base = Number(params.parameters?.baseElevationMeters ?? params.snapPosition.zMeters);
    const height = Number(params.parameters?.heightMeters ?? 0);
    measurements.push({
      id: 'column-elevation',
      label: 'Base / top',
      value: `${formatMeters(base)} / ${formatMeters(base + height)}`,
    });
    measurements.push({
      id: 'column-height',
      label: 'Column height',
      value: formatMeters(height),
    });
  }
  if (params.componentType === 'footer') {
    measurements.push({
      id: 'footer-elevation',
      label: 'Footer bottom / top',
      value: `${formatMeters(Number(params.parameters?.bottomElevationMeters ?? 0))} / ${formatMeters(Number(params.parameters?.topElevationMeters ?? 0))}`,
    });
  }
  if (params.componentType === 'tie_beam' || params.componentType === 'plinth_beam' || params.componentType === 'roof_beam') {
    measurements.push({
      id: 'beam-elevation',
      label: 'Beam elevation',
      value: formatMeters(Number(params.parameters?.elevationMeters ?? params.snapPosition.zMeters)),
    });
  }
  if (params.componentType === 'slab') {
    measurements.push({
      id: 'slab-thickness',
      label: 'Slab thickness',
      value: formatMeters(Number(params.parameters?.thicknessMeters ?? 0.1)),
    });
  }
  return measurements.slice(0, 4);
}
