import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type {
  DesignRenderModel,
  DesignRenderRcComponent,
} from '../domain/designRenderModel';
import {
  buildSupplementalRcComponentSceneGroup,
  type SupplementalRcSceneMaterials,
} from '../ui/DesignBuilderSupplementalStructureScene';

function material(name: string): THREE.Material {
  const meshMaterial = new THREE.MeshBasicMaterial();
  meshMaterial.name = name;
  return meshMaterial;
}

function sceneMaterials(createPlaster = () => material('plaster')): SupplementalRcSceneMaterials {
  return {
    structural: material('structural'),
    footing: material('footing'),
    beam: material('beam'),
    createPlaster,
  };
}

function sourceComponent(rotationRadians = 0): DesignRenderRcComponent['sourceComponent'] {
  return {
    viewPlacement: {
      plan: {
        xMeters: 0,
        zMeters: 0,
        rotationRadians,
      },
    },
  } as DesignRenderRcComponent['sourceComponent'];
}

function rcComponent(
  component: Pick<
    DesignRenderRcComponent,
    'id' | 'type' | 'position' | 'dimensions' | 'elevations'
  > &
    Partial<DesignRenderRcComponent>,
): DesignRenderRcComponent {
  return {
    sourceComponentId: component.id,
    category: 'structure',
    system: 'reinforced-concrete',
    references: {},
    sourceComponent: sourceComponent(),
    ...component,
  };
}

function meshByName(group: THREE.Group, name: string): THREE.Mesh {
  const mesh = group.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
  return mesh as THREE.Mesh;
}

describe('DesignBuilderSupplementalStructureScene', () => {
  it('builds manual column, footer, slab, and beam meshes with preserved priorities', () => {
    const tracked: THREE.BufferGeometry[] = [];
    const materials = sceneMaterials();
    const renderModel: DesignRenderModel = {
      rcComponents: [
        rcComponent({
          id: 'column-1',
          type: 'column',
          position: { x: 1, y: 0, z: 2 },
          dimensions: { width: 0.3, depth: 0.35, height: 2.8 },
          elevations: { base: 0, top: 2.8 },
          footer: {
            id: 'column-1-footer',
            widthMeters: 0.8,
            lengthMeters: 0.9,
            thicknessMeters: 0.25,
            bottomElevationMeters: -0.25,
            topElevationMeters: 0,
          },
        }),
        rcComponent({
          id: 'footer-1',
          type: 'footer',
          position: { x: -1, y: -0.3, z: -2 },
          dimensions: { width: 0.7, depth: 0.8, height: 0.3, length: 0.8 },
          elevations: { base: -0.3, top: 0 },
        }),
        rcComponent({
          id: 'slab-1',
          type: 'slab',
          position: { x: 0, y: 0.28, z: 0 },
          dimensions: { width: 2, depth: 0.12, height: 0.12, length: 3 },
          elevations: { base: 0.28, top: 0.4 },
        }),
        rcComponent({
          id: 'beam-1',
          type: 'tie_beam',
          position: { x: 0, y: 0.4, z: 1 },
          dimensions: { width: 0.25, depth: 0.3, height: 0.3, length: 2 },
          elevations: { base: 0.4, top: 0.7 },
          sourceComponent: sourceComponent(Math.PI / 4),
        }),
      ],
    };

    const group = buildSupplementalRcComponentSceneGroup({
      renderModel,
      slabTopMeters: 0.1,
      useSupplementalPlasterFinish: false,
      supplementalPlinthTopElevationMeters: 0.4,
      materials,
      trackGeometry: (geometry) => {
        tracked.push(geometry);
        return geometry;
      },
    });

    expect(group.name).toBe('supplementalRcComponentGroup');
    expect(group.children).toHaveLength(5);
    expect(tracked).toHaveLength(5);
    expect(meshByName(group, 'supplementalColumnFooter:column-1').position.y).toBeCloseTo(-0.025, 6);
    expect(meshByName(group, 'supplementalColumn:column-1').position.y).toBeCloseTo(1.5, 6);
    expect(meshByName(group, 'supplementalFooter:footer-1').position.y).toBeCloseTo(-0.05, 6);
    expect(meshByName(group, 'supplementalSlab:slab-1').position.y).toBeCloseTo(0.44, 6);
    expect(meshByName(group, 'supplementalBeam:beam-1').position.y).toBeCloseTo(0.65, 6);
    expect(meshByName(group, 'supplementalBeam:beam-1').rotation.y).toBeCloseTo(-Math.PI / 4, 6);
    expect(meshByName(group, 'supplementalColumnFooter:column-1').material).toBe(materials.footing);
    expect(meshByName(group, 'supplementalColumn:column-1').material).toBe(materials.structural);
    expect(meshByName(group, 'supplementalBeam:beam-1').material).toBe(materials.beam);
    expect(meshByName(group, 'supplementalColumnFooter:column-1').userData.selectionPriority).toBe(55);
    expect(meshByName(group, 'supplementalColumn:column-1').userData.selectionPriority).toBe(60);
    expect(meshByName(group, 'supplementalSlab:slab-1').userData.selectionPriority).toBe(50);
    expect(meshByName(group, 'supplementalBeam:beam-1').userData.selectionPriority).toBe(55);
  });

  it('splits supplemental columns at the plinth top when plaster finish is active', () => {
    const plasterMaterial = material('plaster');
    const materials = sceneMaterials(() => plasterMaterial);
    const renderModel: DesignRenderModel = {
      rcComponents: [
        rcComponent({
          id: 'column-1',
          type: 'column',
          position: { x: 1, y: 0, z: 2 },
          dimensions: { width: 0.3, depth: 0.35, height: 2.8 },
          elevations: { base: 0, top: 2.8 },
        }),
      ],
    };

    const group = buildSupplementalRcComponentSceneGroup({
      renderModel,
      slabTopMeters: 0.1,
      useSupplementalPlasterFinish: true,
      supplementalPlinthTopElevationMeters: 0.4,
      materials,
      trackGeometry: (geometry) => geometry,
    });

    expect(group.children).toHaveLength(2);
    const concrete = meshByName(group, 'supplementalColumn:column-1:concrete');
    const plaster = meshByName(group, 'supplementalColumn:column-1:plaster');
    expect(concrete.position.y).toBeCloseTo(0.3, 6);
    expect(plaster.position.y).toBeCloseTo(1.7, 6);
    expect(concrete.material).toBe(materials.structural);
    expect(plaster.material).toBe(plasterMaterial);
    expect(concrete.userData.selectionPriority).toBe(60);
    expect(plaster.userData.selectionPriority).toBe(60);
  });
});
