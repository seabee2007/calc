import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFiveBySixCmuBuildingPreset } from '../domain/designBuilderPreset';
import type {
  DesignRenderModel,
  DesignRenderRcComponent,
} from '../domain/designRenderModel';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';
import {
  buildDesignBuilderViewerSupplementalScene,
  type DesignBuilderViewerSupplementalState,
} from '../ui/DesignBuilderViewerSupplementalScene';

function sourceComponent(): DesignRenderRcComponent['sourceComponent'] {
  return {
    viewPlacement: {
      plan: {
        xMeters: 0,
        zMeters: 0,
        rotationRadians: 0,
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

function supplementalState(
  partial: Partial<DesignBuilderViewerSupplementalState> = {},
): DesignBuilderViewerSupplementalState {
  const preset = createFiveBySixCmuBuildingPreset();
  return {
    currentDesignRenderModel: undefined,
    currentPlacedComponents: [],
    currentLayoutBounds: null,
    currentGeometry: undefined,
    currentSlab: preset.slab,
    currentFoundationViewMode: 'full_model',
    currentVisualStyle: 'technical',
    usePreviewMaterials: false,
    frameSelected: false,
    ...partial,
  };
}

function meshByName(group: THREE.Group, name: string): THREE.Mesh {
  const mesh = group.getObjectByName(name);
  expect(mesh).toBeInstanceOf(THREE.Mesh);
  return mesh as THREE.Mesh;
}

describe('DesignBuilderViewerSupplementalScene', () => {
  it('builds selectable supplemental footer and column scene geometry', () => {
    const resources = createDesignBuilderViewerResources();
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
      ],
    };

    const scene = buildDesignBuilderViewerSupplementalScene({
      state: supplementalState({ currentDesignRenderModel: renderModel }),
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.group.name).toBe('supplementalRcComponentGroup');
    expect(scene.group.children).toHaveLength(2);
    expect(scene.selectableObjects).toHaveLength(2);
    expect(resources.trackedGeometryCount()).toBe(2);
    expect(resources.trackedMaterialCount()).toBe(3);

    const footer = meshByName(scene.group, 'supplementalColumnFooter:column-1');
    const column = meshByName(scene.group, 'supplementalColumn:column-1');
    expect(footer.userData.selectable).toBe(true);
    expect(footer.userData.designObjectType).toBe('structural_frame_system');
    expect(footer.userData.selectionPriority).toBe(55);
    expect(column.userData.selectable).toBe(true);
    expect(column.userData.designObjectType).toBe('structural_frame_system');
    expect(column.userData.selectionPriority).toBe(60);
    expect((footer.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x78716c);
    expect((column.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xcbd5e1);

    resources.disposeTrackedResources();
  });

  it('returns an empty scene when there are no supplemental components', () => {
    const resources = createDesignBuilderViewerResources();

    const scene = buildDesignBuilderViewerSupplementalScene({
      state: supplementalState(),
      trackGeometry: resources.trackGeometry,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    });

    expect(scene.group.children).toHaveLength(0);
    expect(scene.selectableObjects).toHaveLength(0);
    expect(resources.trackedGeometryCount()).toBe(0);
    expect(resources.trackedMaterialCount()).toBe(0);
  });
});
