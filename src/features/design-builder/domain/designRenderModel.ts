import type { ElevationFace, PlacedDesignComponent } from '../types';
import type { DesignLayoutBounds } from './designLayoutBounds';
import {
  buildDesignRenderRcComponents,
  designComponentPlanPosition,
} from './designRenderRcModel';

export type DesignRenderRcComponentKind =
  | 'column'
  | 'footer'
  | 'tie_beam'
  | 'plinth_beam'
  | 'roof_beam'
  | 'slab';

export interface DesignRenderFooterReference {
  id: string;
  widthMeters: number;
  lengthMeters: number;
  thicknessMeters: number;
  bottomElevationMeters: number;
  topElevationMeters: number;
}

export interface DesignRenderRcComponent {
  id: string;
  sourceComponentId: string;
  type: DesignRenderRcComponentKind;
  category: 'structure';
  system: 'reinforced-concrete';
  position: {
    x: number;
    y: number;
    z: number;
  };
  dimensions: {
    width: number;
    depth: number;
    height: number;
    length?: number;
  };
  elevations: {
    base: number;
    top: number;
  };
  references: {
    footerId?: string;
    connectedBeamIds?: string[];
    sourceView?: 'plan' | 'elevation' | 'world';
    elevationFace?: ElevationFace;
  };
  footer?: DesignRenderFooterReference;
  sourceComponent: PlacedDesignComponent;
}

export interface DesignRenderModel {
  rcComponents: DesignRenderRcComponent[];
}

export { designComponentPlanPosition };

export function buildDesignRenderModel(params: {
  placedComponents?: readonly PlacedDesignComponent[];
  layoutBounds?: DesignLayoutBounds | null;
}): DesignRenderModel {
  return {
    rcComponents: buildDesignRenderRcComponents({
      placedComponents: params.placedComponents,
      layoutBounds: params.layoutBounds,
    }),
  };
}

export function elevationStationForPoint(face: ElevationFace, point: { x: number; z: number }): number {
  return face === 'north' || face === 'south' ? point.x : point.z;
}

export function coordinateLabelForElevationFace(face: ElevationFace): 'X / Z' | 'Y / Z' {
  return face === 'north' || face === 'south' ? 'X / Z' : 'Y / Z';
}
