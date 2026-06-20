import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import { GROUT_CELL_RENDER_COLOR, LINTEL_RENDER_COLOR } from '../domain/groutCellPlacements';
import {
  createOpeningRenderGroups,
  groutMeshCentersInsideLintelMeshes,
  populateOpeningAssemblyRenderGroups,
} from '../domain/openingAssembly3dRender';
import {
  buildDesignGeometryInputFromLayout,
  generateDesignGeometry,
} from '../geometry/designGeometry';

function countMeshes(group: THREE.Group, userDataKey: string): number {
  let count = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData[userDataKey]) count += 1;
  });
  return count;
}

function makeMaterial(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color });
}

describe('openingAssembly3dRender', () => {
  const preset = createFiveBySixCmuBuildingPreset();
  const geometry = generateDesignGeometry(
    buildDesignGeometryInputFromLayout({
      wallLayout: preset.wallLayout,
      cmuSettings: preset.wall,
      openings: preset.wall.openings,
      slabSettings: preset.slab,
      roofSettings: preset.roof,
      trussSettings: preset.truss,
    }),
  );
  const cmuLayout = geometry.wallCmuLayout;
  const trackGeometry = <T extends THREE.BufferGeometry>(g: T) => g;
  const makeMat = (color: number) => makeMaterial(color);

  it('always renders lintel solids independent of show grout and show opening layout', () => {
    const offGroups = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(offGroups, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: false,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });
    const onGroups = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(onGroups, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });

    expect(countMeshes(offGroups.lintelGroup, 'lintelSolid')).toBe(cmuLayout.lintels.length);
    expect(countMeshes(onGroups.lintelGroup, 'lintelSolid')).toBe(cmuLayout.lintels.length);
    expect(offGroups.lintelGroup.children.length).toBeGreaterThan(0);
  });

  it('toggling grout only changes grout-cell group visibility content', () => {
    const groutOff = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(groutOff, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: false,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });
    const groutOn = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(groutOn, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });

    expect(countMeshes(groutOff.groutCellGroup, 'groutSolid')).toBe(0);
    expect(countMeshes(groutOff.lintelGroup, 'lintelSolid')).toBe(cmuLayout.lintels.length);
    expect(countMeshes(groutOn.lintelGroup, 'lintelSolid')).toBe(cmuLayout.lintels.length);
    if (cmuLayout.groutFillPlacements.length > 0) {
      expect(countMeshes(groutOn.groutCellGroup, 'groutSolid')).toBe(cmuLayout.groutFillPlacements.length);
    }
  });

  it('show opening layout only affects rough-opening guide group', () => {
    const layoutOff = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(layoutOff, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: false,
      showOpeningLayout: false,
      selectedOpeningId: preset.wall.openings[0]?.id,
      trackGeometry,
      makeMaterial: makeMat,
    });
    const layoutOn = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(layoutOn, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: false,
      showOpeningLayout: true,
      selectedOpeningId: preset.wall.openings[0]?.id,
      trackGeometry,
      makeMaterial: makeMat,
    });

    expect(layoutOff.roughOpeningGuideGroup.children.length).toBe(0);
    expect(layoutOff.frameGroup.children.length).toBe(cmuLayout.roughOpenings.length);
    expect(layoutOn.frameGroup.children.length).toBe(cmuLayout.roughOpenings.length);
    expect(layoutOn.roughOpeningGuideGroup.children.length).toBeGreaterThan(0);
    expect(countMeshes(layoutOn.lintelGroup, 'lintelSolid')).toBe(cmuLayout.lintels.length);
  });

  it('uses subdued grout material color, not bright teal, for grout cells', () => {
    if (cmuLayout.groutFillPlacements.length === 0) return;
    const groups = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(groups, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });
    groups.groutCellGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.groutSolid) {
        const material = child.material as THREE.MeshStandardMaterial;
        expect(material.color.getHex()).toBe(GROUT_CELL_RENDER_COLOR);
        expect(material.color.getHex()).not.toBe(0x5eead4);
      }
    });
  });

  it('lintel solids use concrete material distinct from grout cells', () => {
    const groups = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(groups, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });
    groups.lintelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.lintelSolid) {
        const material = child.material as THREE.MeshStandardMaterial;
        expect(material.color.getHex()).toBe(LINTEL_RENDER_COLOR);
      }
    });
  });

  it('precast lintel openings do not receive lintel_cell grout placements', () => {
    const precastPreset = createFiveBySixCmuBuildingPreset();
    const wall = {
      ...precastPreset.wall,
      lintelType: 'precast_concrete' as const,
      openings: precastPreset.wall.openings.map((opening) => ({
        ...opening,
        lintelType: 'precast_concrete' as const,
      })),
    };
    const precastGeometry = generateDesignGeometry(
      buildDesignGeometryInputFromLayout({
        wallLayout: precastPreset.wallLayout,
        cmuSettings: wall,
        openings: wall.openings,
        slabSettings: precastPreset.slab,
        roofSettings: precastPreset.roof,
        trussSettings: precastPreset.truss,
      }),
    );
    const lintelGrout = precastGeometry.wallCmuLayout.groutFillPlacements.filter(
      (placement) => placement.kind === 'lintel_cell' || placement.kind === 'bond_beam_cell',
    );
    expect(lintelGrout).toHaveLength(0);
    expect(precastGeometry.wallCmuLayout.lintels.length).toBeGreaterThan(0);
  });

  it('bond-beam lintel may include lintel_cell grout but still renders solid lintel geometry', () => {
    const lintelGrout = cmuLayout.groutFillPlacements.filter((placement) => placement.kind === 'lintel_cell');
    expect(cmuLayout.lintels.length).toBeGreaterThan(0);
    if (preset.wall.lintelType === 'bond_beam' || preset.wall.openings.some((o) => o.lintelType === 'bond_beam')) {
      expect(lintelGrout.length).toBeGreaterThanOrEqual(0);
    }
    const groups = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(groups, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });
    expect(countMeshes(groups.lintelGroup, 'lintelSolid')).toBe(cmuLayout.lintels.length);
  });

  it('jamb and closure grout centers stay outside lintel solid geometry', () => {
    const jambOrClosurePlacements = cmuLayout.groutFillPlacements.filter(
      (placement) => placement.kind === 'jamb_cell' || placement.kind === 'closure_void',
    );
    if (jambOrClosurePlacements.length === 0) return;

    const groups = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(groups, {
      cmuLayout: {
        ...cmuLayout,
        groutFillPlacements: jambOrClosurePlacements,
      },
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });
    expect(groutMeshCentersInsideLintelMeshes(groups.lintelGroup, groups.groutCellGroup)).toBe(false);
  });

  it('grout cell mesh width never spans the full rough opening width', () => {
    cmuLayout.roughOpenings.forEach((opening) => {
      const openingGrout = cmuLayout.groutFillPlacements.filter((placement) => placement.openingId === opening.id);
      openingGrout.forEach((placement) => {
        expect(placement.lengthMeters).toBeLessThan(opening.roughOpeningWidthMeters);
      });
    });
  });

  it('grout cell mesh depth stays inside CMU core void space, not full wall thickness', () => {
    if (cmuLayout.groutFillPlacements.length === 0) return;
    const groups = createOpeningRenderGroups();
    populateOpeningAssemblyRenderGroups(groups, {
      cmuLayout,
      wall: preset.wall,
      slabTopMeters: preset.slab.slabThicknessMeters,
      showGroutCells: true,
      showOpeningLayout: false,
      trackGeometry,
      makeMaterial: makeMat,
    });
    groups.groutCellGroup.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.userData.groutSolid) return;
      if (child.userData.groutKind === 'closure_void') return;
      const depth = (child.geometry as THREE.BoxGeometry).parameters.depth;
      expect(depth).toBeLessThanOrEqual(preset.wall.wallThicknessMeters);
      expect(depth).toBeLessThan(preset.wall.wallThicknessMeters);
    });
  });
});
