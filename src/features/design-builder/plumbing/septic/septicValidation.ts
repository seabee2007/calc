import type { PlumbingNode } from '../plumbingTypes';
import { IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M } from '../domain/ipcDrainageSlope';
import { calculateSepticCapacity } from './septicCapacity';
import { pointInsideSepticTankFootprint, septicTankFootprintPolygon } from './septicGeometry';
import type { SepticPoint2D } from './septicGeometry';
import type { SepticTankModel } from './septicTypes';

export type SepticValidationIssue = {
  severity: 'info' | 'warning' | 'error';
  code: string;
  objectId: string;
  message: string;
  ruleSource: 'conceptual' | 'code_profile' | 'coordination';
};

export type SepticValidationContext = {
  nodes?: readonly PlumbingNode[];
  buildingFootprint?: readonly SepticPoint2D[];
};

function hasNode(nodes: readonly PlumbingNode[] | undefined, id: string): boolean {
  return Boolean(nodes?.some((node) => node.id === id));
}

function polygonBounds(points: readonly SepticPoint2D[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minZ: Math.min(bounds.minZ, point.z),
      maxZ: Math.max(bounds.maxZ, point.z),
    }),
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  );
}

function boundsOverlap(a: ReturnType<typeof polygonBounds>, b: ReturnType<typeof polygonBounds>): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

function boundsDistance(a: ReturnType<typeof polygonBounds>, b: ReturnType<typeof polygonBounds>): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dz = Math.max(0, Math.max(a.minZ - b.maxZ, b.minZ - a.maxZ));
  return Math.hypot(dx, dz);
}

export function validateSepticTank(
  tank: SepticTankModel,
  context: SepticValidationContext = {},
): SepticValidationIssue[] {
  const issues: SepticValidationIssue[] = [];
  const push = (issue: Omit<SepticValidationIssue, 'objectId'>) =>
    issues.push({ objectId: tank.id, ...issue });

  if (!hasNode(context.nodes, tank.connectionNodes.inletNodeId)) {
    push({
      severity: 'error',
      code: 'missing_inlet_node',
      message: 'Septic tank is missing its model inlet node.',
      ruleSource: 'coordination',
    });
  }
  if (!hasNode(context.nodes, tank.connectionNodes.outletNodeId)) {
    push({
      severity: 'error',
      code: 'missing_outlet_node',
      message: 'Septic tank is missing its model outlet node.',
      ruleSource: 'coordination',
    });
  }
  if (tank.connectionNodes.cleanoutNodeIds.length < 2) {
    push({
      severity: 'error',
      code: 'missing_access_opening',
      message: 'Septic tank requires access openings over both compartments.',
      ruleSource: 'conceptual',
    });
  }
  if (tank.geometry.firstCompartmentRatio < 0.5) {
    push({
      severity: 'error',
      code: 'first_compartment_smaller_than_second',
      message: 'First septic tank compartment must be equal to or larger than the second compartment.',
      ruleSource: 'conceptual',
    });
  }
  if (tank.geometry.liquidDepthM < 1.2192 || tank.geometry.liquidDepthM > 1.8288) {
    push({
      severity: 'warning',
      code: 'liquid_depth_outside_conceptual_range',
      message: 'Liquid depth is outside the conceptual 4 ft to 6 ft planning range.',
      ruleSource: 'conceptual',
    });
  }
  if (tank.geometry.insideWidthM < 1.2192) {
    push({
      severity: 'error',
      code: 'inside_width_below_4ft',
      message: 'Inside tank width is below 4 ft / 1.2192 m.',
      ruleSource: 'conceptual',
    });
  }
  if (tank.geometry.inletInvertAboveOutletM <= 0) {
    push({
      severity: 'error',
      code: 'inlet_invert_not_above_outlet',
      message: 'Inlet invert must be above outlet invert.',
      ruleSource: 'conceptual',
    });
  }
  if (tank.placement.topSlabTopElevationM > tank.placement.gradeElevationM) {
    push({
      severity: 'warning',
      code: 'tank_placed_above_grade',
      message: 'Top slab elevation is above grade.',
      ruleSource: 'coordination',
    });
  }
  if (tank.placement.burialDepthBelowGradeM > 0.91 && tank.designBasis.codeProfileId !== 'custom') {
    push({
      severity: 'warning',
      code: 'burial_depth_exceeds_3ft',
      message: 'Burial depth exceeds 0.91 m / 3 ft; verify access and construction requirements.',
      ruleSource: 'conceptual',
    });
  }
  if (calculateSepticCapacity(tank).mismatchWarning) {
    push({
      severity: 'warning',
      code: 'capacity_mismatch',
      message: 'Calculated liquid volume does not match selected capacity preset.',
      ruleSource: 'conceptual',
    });
  }
  if (context.buildingFootprint && context.buildingFootprint.length > 0) {
    const tankBounds = polygonBounds(septicTankFootprintPolygon(tank));
    const buildingBounds = polygonBounds(context.buildingFootprint);
    if (boundsOverlap(tankBounds, buildingBounds) || context.buildingFootprint.some((point) => pointInsideSepticTankFootprint(tank, point))) {
      push({
        severity: 'warning',
        code: 'tank_overlaps_building_footprint',
        message: 'Septic tank overlaps the building footprint.',
        ruleSource: 'coordination',
      });
    } else if (boundsDistance(tankBounds, buildingBounds) < IPC_2024_MIN_SEPTIC_SETBACK_FROM_BUILDING_M) {
      push({
        severity: 'warning',
        code: 'tank_too_close_to_building_footprint',
        message: 'Septic tank is less than 10 ft / 3.048 m from the building footprint.',
        ruleSource: 'coordination',
      });
    }
  }
  push({
    severity: 'info',
    code: 'future_leach_field_outlet_missing',
    message: 'Outlet node is reserved for a future leach field/disposal field object.',
    ruleSource: 'coordination',
  });
  push({
    severity: 'info',
    code: 'conceptual_permitting_note',
    message:
      'Confirm public sewer availability, lot size, setbacks, soil/percolation requirements, groundwater conditions, and local permitting before construction.',
    ruleSource: 'conceptual',
  });
  return issues;
}
