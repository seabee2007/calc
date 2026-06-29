import * as THREE from 'three';
import {
  resolveCastConcreteMaterial,
  resolvePlasterFinishMaterial,
  type ResolveCastConcreteMaterialOptions,
} from '../rendering/materials/designMaterialLibrary';
import type { DesignObjectType, DesignVisualStyle } from '../types';
import { selectionPriorityForObjectType } from './DesignBuilderViewerSceneRegistry';

export type TrackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => T;
export type TrackMaterial = <T extends THREE.Material>(material: T) => T;
export type MakeMaterial = (
  color: number,
  selected: boolean,
  options?: THREE.MeshStandardMaterialParameters,
) => THREE.MeshStandardMaterial;

export interface RcViewerMaterialContext {
  visualStyle: DesignVisualStyle;
  selected: boolean;
  usePreviewMaterials: boolean;
  trackMaterial: TrackMaterial;
  makeMaterial: MakeMaterial;
}

export function resolveRcConcreteMaterial(
  context: RcViewerMaterialContext,
  params: {
    role?: ResolveCastConcreteMaterialOptions['role'];
    technicalColor: number;
    technicalOptions?: THREE.MeshStandardMaterialParameters;
    transparent?: boolean;
    opacity?: number;
  },
): THREE.MeshStandardMaterial {
  return context.usePreviewMaterials
    ? resolveCastConcreteMaterial(
        {
          visualStyle: context.visualStyle,
          selected: context.selected,
          role: params.role ?? 'structural',
          ...(params.transparent ? { transparent: true, opacity: params.opacity } : {}),
        },
        context.trackMaterial,
      )
    : context.makeMaterial(params.technicalColor, context.selected, params.technicalOptions);
}

export function resolveRcPlasterMaterial(
  context: RcViewerMaterialContext,
  params: {
    plasterFinish: 'smooth' | 'textured' | 'painted';
    technicalSelected?: boolean;
  },
): THREE.MeshStandardMaterial {
  const selected = params.technicalSelected ?? context.selected;
  return context.usePreviewMaterials
    ? resolvePlasterFinishMaterial(
        {
          visualStyle: context.visualStyle,
          selected,
          plasterFinish: params.plasterFinish,
        },
        context.trackMaterial,
      )
    : context.makeMaterial(
        params.plasterFinish === 'smooth' ? 0xded8cf : 0xd8d1c5,
        selected,
        {
          side: THREE.DoubleSide,
        },
      );
}

export function collectStructuralFrameSelectables(params: {
  group: THREE.Group;
  objectType?: DesignObjectType;
  preserveExistingPriority?: boolean;
}): THREE.Object3D[] {
  const selectableObjects: THREE.Object3D[] = [];
  const objectType = params.objectType ?? 'structural_frame_system';
  const selectionPriority = selectionPriorityForObjectType(objectType);
  params.group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.userData.selectable = true;
      child.userData.designObjectType = objectType;
      child.userData.selectionPriority =
        params.preserveExistingPriority && typeof child.userData.selectionPriority === 'number'
          ? child.userData.selectionPriority
          : selectionPriority;
      selectableObjects.push(child);
    }
  });
  return selectableObjects;
}
