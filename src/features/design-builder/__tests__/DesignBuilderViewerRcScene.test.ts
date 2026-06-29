import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  collectStructuralFrameSelectables,
  resolveRcConcreteMaterial,
  resolveRcPlasterMaterial,
} from '../ui/DesignBuilderViewerRcScene';
import { createDesignBuilderViewerResources } from '../ui/DesignBuilderViewerResources';

describe('DesignBuilderViewerRcScene', () => {
  it('resolves technical RC concrete and plaster materials through viewer resources', () => {
    const resources = createDesignBuilderViewerResources();
    const context = {
      visualStyle: 'technical' as const,
      selected: false,
      usePreviewMaterials: false,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    };

    const concrete = resolveRcConcreteMaterial(context, {
      role: 'structural',
      technicalColor: 0x78716c,
      technicalOptions: { roughness: 0.9 },
    });
    const plaster = resolveRcPlasterMaterial(context, {
      plasterFinish: 'smooth',
    });

    expect(concrete.color.getHex()).toBe(0x78716c);
    expect(concrete.roughness).toBeCloseTo(0.9, 6);
    expect(plaster.color.getHex()).toBe(0xded8cf);
    expect(plaster.side).toBe(THREE.DoubleSide);
    expect(resources.trackedMaterialCount()).toBe(2);

    resources.disposeTrackedResources();
  });

  it('keeps selected RC concrete opaque in preview and technical material modes', () => {
    const resources = createDesignBuilderViewerResources();
    const technicalContext = {
      visualStyle: 'technical' as const,
      selected: true,
      usePreviewMaterials: false,
      trackMaterial: resources.trackMaterial,
      makeMaterial: resources.makeMaterial,
    };
    const previewContext = {
      ...technicalContext,
      visualStyle: 'material_preview' as const,
      usePreviewMaterials: true,
    };

    const technical = resolveRcConcreteMaterial(technicalContext, {
      role: 'structural',
      technicalColor: 0x78716c,
    });
    const preview = resolveRcConcreteMaterial(previewContext, {
      role: 'beam',
      technicalColor: 0x57534e,
    });

    for (const material of [technical, preview]) {
      expect(material.color.getHex()).toBe(0x22d3ee);
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.depthWrite).toBe(true);
    }

    resources.disposeTrackedResources();
  });

  it('marks structural frame meshes selectable while preserving existing RC priorities when requested', () => {
    const group = new THREE.Group();
    const column = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const footer = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    footer.userData.selectionPriority = 55;
    group.add(column, footer);

    const selectables = collectStructuralFrameSelectables({
      group,
      preserveExistingPriority: true,
    });

    expect(selectables).toEqual([column, footer]);
    expect(column.userData.selectable).toBe(true);
    expect(column.userData.designObjectType).toBe('structural_frame_system');
    expect(column.userData.selectionPriority).toBe(1);
    expect(footer.userData.selectable).toBe(true);
    expect(footer.userData.designObjectType).toBe('structural_frame_system');
    expect(footer.userData.selectionPriority).toBe(55);
  });
});
