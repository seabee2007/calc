import * as THREE from "three";
import type { DesignBuilderRoofDebugSnapshot } from "../domain/designBuilderRoofDebugSnapshot";
import type { DesignBuilderViewerCmuInfillScene } from "./DesignBuilderViewerCmuInfillScene";
import type { DesignBuilderViewerRoofAssemblyScene } from "./DesignBuilderViewerRoofAssemblyScene";

export type DesignBuilderViewerRoofRenderComponent =
  | "roofCladding"
  | "steelTrusses"
  | "purlins"
  | "gableEndCmu"
  | "rakedCaps"
  | "ridgeCap"
  | "fascia"
  | "soffit";

export type DesignBuilderViewerRenderBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  widthMeters: number;
  heightMeters: number;
  depthMeters: number;
};

export type DesignBuilderViewerRenderGroupSummary = {
  name: string;
  childCount: number;
  meshCount: number;
  instancedMeshCount: number;
  instancedInstanceCount: number;
  selectableCount: number;
  bounds: DesignBuilderViewerRenderBounds | null;
};

export type DesignBuilderViewerRoofRenderIssue = {
  component: DesignBuilderViewerRoofRenderComponent;
  code:
    | "expected_component_not_rendered"
    | "non_finite_render_bounds"
    | "render_bounds_mismatch"
    | "render_instance_count_mismatch"
    | "roof_cladding_detached_from_framing";
  message: string;
};

export type DesignBuilderViewerRoofRenderDebugSnapshot = {
  groups: Record<string, DesignBuilderViewerRenderGroupSummary>;
  components: Record<
    DesignBuilderViewerRoofRenderComponent,
    {
      expected: boolean;
      rendered: boolean;
      meshCount: number;
      instancedInstanceCount: number;
      bounds: DesignBuilderViewerRenderBounds | null;
      expectedPlanBounds: DesignBuilderViewerPlanBounds | null;
    }
  >;
  expectedRoofBeamWorldY: number | null;
  expectedRoofPeakWorldY: number | null;
  selectableCount: number;
  issues: DesignBuilderViewerRoofRenderIssue[];
};

type ComponentExpectation = Partial<
  Record<DesignBuilderViewerRoofRenderComponent, boolean>
>;

type DesignBuilderViewerPlanBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  widthMeters: number;
  depthMeters: number;
};

export function createDesignBuilderViewerRoofRenderDebugSnapshot(params: {
  roofAssemblyScene: DesignBuilderViewerRoofAssemblyScene;
  cmuInfillScene?: DesignBuilderViewerCmuInfillScene | null;
  solverSnapshot?: DesignBuilderRoofDebugSnapshot | null;
  expectedVisibleComponents?: ComponentExpectation;
}): DesignBuilderViewerRoofRenderDebugSnapshot {
  const roofGroups = params.roofAssemblyScene.groups;
  const cmuGroups = params.cmuInfillScene?.groups ?? [];
  const allGroups = [...roofGroups, ...cmuGroups];
  const groups = Object.fromEntries(
    allGroups.map((group) => [group.name, summarizeRenderGroup(group)]),
  );

  const solver = params.solverSnapshot ?? null;
  const expected = resolveExpectedComponents(
    solver,
    params.expectedVisibleComponents,
  );
  const expectedPlanBounds = resolveExpectedPlanBounds(solver);
  const components = {
    roofCladding: summarizeComponent(
      expected.roofCladding,
      [groups.roofCladdingGroup],
      expectedPlanBounds.roofCladding,
    ),
    steelTrusses: summarizeComponent(
      expected.steelTrusses,
      [
        groups.trussChordGroup,
        groups.trussWebGroup,
        groups.basePlateGroup,
        groups.anchorBoltGroup,
      ],
      expectedPlanBounds.steelTrusses,
    ),
    purlins: summarizeComponent(
      expected.purlins,
      [groups.purlinGroup],
      expectedPlanBounds.purlins,
    ),
    gableEndCmu: summarizeComponent(
      expected.gableEndCmu,
      [groups.cmuGableBlockInstanceGroup, groups.cmuBlockInstanceGroup],
      expectedPlanBounds.gableEndCmu,
    ),
    rakedCaps: summarizeComponent(
      expected.rakedCaps,
      [groups.rakedCapGroup],
      expectedPlanBounds.rakedCaps,
    ),
    ridgeCap: summarizeComponent(
      expected.ridgeCap,
      [groups.ridgeCapGroup],
      expectedPlanBounds.ridgeCap,
    ),
    fascia: summarizeComponent(
      expected.fascia,
      [groups.fasciaGroup],
      expectedPlanBounds.fascia,
    ),
    soffit: summarizeComponent(
      expected.soffit,
      [groups.soffitGroup],
      expectedPlanBounds.soffit,
    ),
  };
  const issues = collectRenderIssues(components, solver);

  return {
    groups,
    components,
    expectedRoofBeamWorldY:
      solver?.slabTopMeters != null && solver.resolvedRoof.roofBeamTopY != null
        ? round(solver.slabTopMeters + solver.resolvedRoof.roofBeamTopY)
        : null,
    expectedRoofPeakWorldY:
      solver?.slabTopMeters != null && solver.resolvedRoof.roofPeakY != null
        ? round(solver.slabTopMeters + solver.resolvedRoof.roofPeakY)
        : null,
    selectableCount:
      params.roofAssemblyScene.selectableObjects.length +
      (params.cmuInfillScene?.selectableObjects.length ?? 0),
    issues,
  };
}

function resolveExpectedComponents(
  solver: DesignBuilderRoofDebugSnapshot | null,
  expectedVisibleComponents: ComponentExpectation | undefined,
): Record<DesignBuilderViewerRoofRenderComponent, boolean> {
  const solverExpected = {
    roofCladding: (solver?.counts.claddingDisplayPlanes ?? 0) > 0,
    steelTrusses: (solver?.trusses.count ?? 0) > 0,
    purlins: (solver?.counts.purlins ?? 0) > 0,
    gableEndCmu: (solver?.gableEnd.cmuBlockCount ?? 0) > 0,
    rakedCaps: (solver?.rakedCaps.count ?? 0) > 0,
    ridgeCap: (solver?.resolvedRoof.claddingRidgeLengthMeters ?? 0) > 0,
    fascia: (solver?.counts.fascia ?? 0) > 0,
    soffit: (solver?.counts.soffit ?? 0) > 0,
  };
  return {
    ...solverExpected,
    ...expectedVisibleComponents,
  };
}

function resolveExpectedPlanBounds(
  solver: DesignBuilderRoofDebugSnapshot | null,
): Record<
  DesignBuilderViewerRoofRenderComponent,
  DesignBuilderViewerPlanBounds | null
> {
  return {
    roofCladding:
      solver?.resolvedRoof.roofSheetBounds ??
      solver?.resolvedRoof.claddingBounds ??
      null,
    steelTrusses: solver?.trusses.bounds ?? null,
    purlins: null,
    gableEndCmu: solver?.gableEnd.cmuBounds ?? null,
    rakedCaps: null,
    ridgeCap: null,
    fascia: null,
    soffit: null,
  };
}

function summarizeComponent(
  expected: boolean,
  summaries: (DesignBuilderViewerRenderGroupSummary | undefined)[],
  expectedPlanBounds: DesignBuilderViewerPlanBounds | null,
) {
  const visibleSummaries = summaries.filter(
    (summary): summary is DesignBuilderViewerRenderGroupSummary =>
      summary !== undefined,
  );
  const meshCount = visibleSummaries.reduce(
    (total, summary) => total + summary.meshCount,
    0,
  );
  const instancedInstanceCount = visibleSummaries.reduce(
    (total, summary) => total + summary.instancedInstanceCount,
    0,
  );
  return {
    expected,
    rendered: meshCount + instancedInstanceCount > 0,
    meshCount,
    instancedInstanceCount,
    bounds: mergeBounds(visibleSummaries.map((summary) => summary.bounds)),
    expectedPlanBounds,
  };
}

function collectRenderIssues(
  components: DesignBuilderViewerRoofRenderDebugSnapshot["components"],
  solver: DesignBuilderRoofDebugSnapshot | null,
): DesignBuilderViewerRoofRenderIssue[] {
  const issues: DesignBuilderViewerRoofRenderIssue[] = [];
  for (const [component, summary] of Object.entries(components) as [
    DesignBuilderViewerRoofRenderComponent,
    (typeof components)[DesignBuilderViewerRoofRenderComponent],
  ][]) {
    if (summary.expected && !summary.rendered) {
      issues.push({
        component,
        code: "expected_component_not_rendered",
        message: `${component} was expected from solver output but no 3D render objects were built.`,
      });
    }
    if (
      summary.rendered &&
      summary.bounds &&
      !boundsAreFinite(summary.bounds)
    ) {
      issues.push({
        component,
        code: "non_finite_render_bounds",
        message: `${component} rendered with non-finite bounds.`,
      });
    }
    if (
      summary.rendered &&
      summary.bounds &&
      summary.expectedPlanBounds &&
      !planBoundsMatch(summary.bounds, summary.expectedPlanBounds)
    ) {
      issues.push({
        component,
        code: "render_bounds_mismatch",
        message: `${component} rendered outside the solver plan bounds.`,
      });
    }
  }
  const expectedGableCmuInstances = solver?.gableEnd.cmuBlockCount ?? 0;
  const renderedGableCmuInstances =
    components.gableEndCmu.instancedInstanceCount;
  if (
    expectedGableCmuInstances > 0 &&
    renderedGableCmuInstances !== expectedGableCmuInstances
  ) {
    issues.push({
      component: "gableEndCmu",
      code: "render_instance_count_mismatch",
      message: `gableEndCmu rendered ${renderedGableCmuInstances} instances, but the solver produced ${expectedGableCmuInstances}.`,
    });
  }

  const roofBounds = components.roofCladding.bounds;
  const purlinBounds = components.purlins.bounds;
  if (
    components.roofCladding.rendered &&
    components.purlins.rendered &&
    roofBounds &&
    purlinBounds
  ) {
    const ridgeGapMeters = roofBounds.maxY - purlinBounds.maxY;
    if (ridgeGapMeters > 0.35) {
      issues.push({
        component: "roofCladding",
        code: "roof_cladding_detached_from_framing",
        message: `roofCladding ridge is ${round(ridgeGapMeters)} m above the purlin ridge envelope.`,
      });
    }
  }
  return issues;
}

function summarizeRenderGroup(
  group: THREE.Group,
): DesignBuilderViewerRenderGroupSummary {
  let meshCount = 0;
  let instancedMeshCount = 0;
  let instancedInstanceCount = 0;
  let selectableCount = 0;
  const bounds = new THREE.Box3();
  let hasBounds = false;

  group.updateWorldMatrix(true, true);
  group.traverse((child) => {
    if (
      !(child instanceof THREE.Mesh) &&
      !(child instanceof THREE.InstancedMesh)
    )
      return;
    meshCount += 1;
    if (child instanceof THREE.InstancedMesh) {
      instancedMeshCount += 1;
      instancedInstanceCount += child.count;
    }
    if (child.userData.selectable) selectableCount += 1;
    const childBounds = objectBounds(child);
    if (childBounds) {
      bounds.union(childBounds);
      hasBounds = true;
    }
  });

  return {
    name: group.name,
    childCount: group.children.length,
    meshCount,
    instancedMeshCount,
    instancedInstanceCount,
    selectableCount,
    bounds: hasBounds ? toBoundsSummary(bounds) : null,
  };
}

function objectBounds(
  object: THREE.Mesh | THREE.InstancedMesh,
): THREE.Box3 | null {
  const geometry = object.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const geometryBounds = geometry.boundingBox;
  if (!geometryBounds) return null;

  if (object instanceof THREE.InstancedMesh) {
    const merged = new THREE.Box3();
    const instanceMatrix = new THREE.Matrix4();
    for (let index = 0; index < object.count; index += 1) {
      object.getMatrixAt(index, instanceMatrix);
      merged.union(
        geometryBounds
          .clone()
          .applyMatrix4(instanceMatrix)
          .applyMatrix4(object.matrixWorld),
      );
    }
    return merged.isEmpty() ? null : merged;
  }

  return geometryBounds.clone().applyMatrix4(object.matrixWorld);
}

function mergeBounds(
  summaries: (DesignBuilderViewerRenderBounds | null)[],
): DesignBuilderViewerRenderBounds | null {
  const finiteSummaries = summaries.filter(
    (summary): summary is DesignBuilderViewerRenderBounds => summary !== null,
  );
  if (finiteSummaries.length === 0) return null;
  const minX = Math.min(...finiteSummaries.map((summary) => summary.minX));
  const maxX = Math.max(...finiteSummaries.map((summary) => summary.maxX));
  const minY = Math.min(...finiteSummaries.map((summary) => summary.minY));
  const maxY = Math.max(...finiteSummaries.map((summary) => summary.maxY));
  const minZ = Math.min(...finiteSummaries.map((summary) => summary.minZ));
  const maxZ = Math.max(...finiteSummaries.map((summary) => summary.maxZ));
  return toBoundsSummary(
    new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ),
    ),
  );
}

function toBoundsSummary(bounds: THREE.Box3): DesignBuilderViewerRenderBounds {
  return {
    minX: round(bounds.min.x),
    maxX: round(bounds.max.x),
    minY: round(bounds.min.y),
    maxY: round(bounds.max.y),
    minZ: round(bounds.min.z),
    maxZ: round(bounds.max.z),
    widthMeters: round(bounds.max.x - bounds.min.x),
    heightMeters: round(bounds.max.y - bounds.min.y),
    depthMeters: round(bounds.max.z - bounds.min.z),
  };
}

function boundsAreFinite(bounds: DesignBuilderViewerRenderBounds): boolean {
  return Object.values(bounds).every((value) => Number.isFinite(value));
}

function planBoundsMatch(
  actual: DesignBuilderViewerRenderBounds,
  expected: DesignBuilderViewerPlanBounds,
): boolean {
  const toleranceMeters = 0.25;
  return (
    Math.abs(actual.minX - expected.minX) <= toleranceMeters &&
    Math.abs(actual.maxX - expected.maxX) <= toleranceMeters &&
    Math.abs(actual.minZ - expected.minZ) <= toleranceMeters &&
    Math.abs(actual.maxZ - expected.maxZ) <= toleranceMeters
  );
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
