import * as THREE from "three";
import type { DesignBuilderRcFrameDebugSnapshot } from "../domain/designBuilderRcFrameDebugSnapshot";
import type { DesignBuilderViewerCmuInfillScene } from "./DesignBuilderViewerCmuInfillScene";

export type DesignBuilderViewerCmuInfillRenderIssue = {
  component: "wallProxy" | "plaster" | "cmuBlocks";
  code: "expected_component_not_rendered" | "rendered_count_below_solver_count";
  message: string;
};

export type DesignBuilderViewerCmuInfillRenderDebugSnapshot = {
  components: {
    wallProxy: {
      rendered: boolean;
      meshCount: number;
      expectedMinimumMeshCount: number;
    };
    plaster: {
      rendered: boolean;
      meshCount: number;
      expectedMinimumMeshCount: number;
    };
    cmuBlocks: {
      rendered: boolean;
      instancedInstanceCount: number;
    };
  };
  selectableCount: number;
  issues: DesignBuilderViewerCmuInfillRenderIssue[];
};

export function createDesignBuilderViewerCmuInfillRenderDebugSnapshot(params: {
  cmuInfillScene: DesignBuilderViewerCmuInfillScene;
  rcFrameSnapshot: DesignBuilderRcFrameDebugSnapshot;
  showCmuInfill: boolean;
  showIndividualBlocks: boolean;
}): DesignBuilderViewerCmuInfillRenderDebugSnapshot {
  const groups = params.cmuInfillScene.groups;
  const wallProxyMeshCount = countMeshesByNamePrefix(groups, "infillWallProxy:");
  const plasterMeshCount = countMeshesByNamePrefix(groups, "infillPlaster:");
  const cmuBlockInstanceCount = countInstancedMeshInstancesByNamePrefix(
    groups,
    "cmuBlocks:",
  );
  const expectedWallProxyMeshCount =
    params.showCmuInfill && !params.showIndividualBlocks
      ? params.rcFrameSnapshot.infillHealth.aboveGradePanelCount
      : 0;
  const expectedPlasterMeshCount =
    params.showCmuInfill && !params.showIndividualBlocks
      ? params.rcFrameSnapshot.infillHealth.aboveGradePanelsWithPlaster
      : 0;
  const issues: DesignBuilderViewerCmuInfillRenderIssue[] = [];

  if (expectedWallProxyMeshCount > 0 && wallProxyMeshCount === 0) {
    issues.push({
      component: "wallProxy",
      code: "expected_component_not_rendered",
      message: "CMU infill wall proxy meshes were expected but none were rendered.",
    });
  } else if (wallProxyMeshCount < expectedWallProxyMeshCount) {
    issues.push({
      component: "wallProxy",
      code: "rendered_count_below_solver_count",
      message: `Rendered ${wallProxyMeshCount} CMU infill wall proxy mesh(es), expected at least ${expectedWallProxyMeshCount}.`,
    });
  }

  if (expectedPlasterMeshCount > 0 && plasterMeshCount === 0) {
    issues.push({
      component: "plaster",
      code: "expected_component_not_rendered",
      message: "Plaster meshes were expected but none were rendered.",
    });
  } else if (plasterMeshCount < expectedPlasterMeshCount) {
    issues.push({
      component: "plaster",
      code: "rendered_count_below_solver_count",
      message: `Rendered ${plasterMeshCount} plaster mesh(es), expected at least ${expectedPlasterMeshCount}.`,
    });
  }

  return {
    components: {
      wallProxy: {
        rendered: wallProxyMeshCount > 0,
        meshCount: wallProxyMeshCount,
        expectedMinimumMeshCount: expectedWallProxyMeshCount,
      },
      plaster: {
        rendered: plasterMeshCount > 0,
        meshCount: plasterMeshCount,
        expectedMinimumMeshCount: expectedPlasterMeshCount,
      },
      cmuBlocks: {
        rendered: cmuBlockInstanceCount > 0,
        instancedInstanceCount: cmuBlockInstanceCount,
      },
    },
    selectableCount: params.cmuInfillScene.selectableObjects.length,
    issues,
  };
}

function countMeshesByNamePrefix(
  groups: readonly THREE.Group[],
  prefix: string,
): number {
  let count = 0;
  for (const group of groups) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.name.startsWith(prefix)) {
        count += 1;
      }
    });
  }
  return count;
}

function countInstancedMeshInstancesByNamePrefix(
  groups: readonly THREE.Group[],
  prefix: string,
): number {
  let count = 0;
  for (const group of groups) {
    group.traverse((child) => {
      if (child instanceof THREE.InstancedMesh && child.name.startsWith(prefix)) {
        count += child.count;
      }
    });
  }
  return count;
}
