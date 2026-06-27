import * as THREE from 'three';
import { FOUNDATION_CONTACT_EPSILON_METERS } from '../domain/foundationElevations';
import type { DesignRenderModel } from '../domain/designRenderModel';
import {
  buildRcBoxMesh,
  buildRcElevationBoxMesh,
  type TrackGeometry,
} from './DesignBuilderRcPrimitiveScene';

export interface SupplementalRcSceneMaterials {
  structural: THREE.Material;
  footing: THREE.Material;
  beam: THREE.Material;
  createPlaster: () => THREE.Material;
}

function markSupplementalMesh(
  mesh: THREE.Mesh,
  componentId: string,
  selectionPriority: number,
): THREE.Mesh {
  mesh.userData.supplementalRcComponentId = componentId;
  mesh.userData.selectionPriority = selectionPriority;
  return mesh;
}

export function buildSupplementalRcComponentSceneGroup(params: {
  renderModel: DesignRenderModel;
  slabTopMeters: number;
  useSupplementalPlasterFinish: boolean;
  supplementalPlinthTopElevationMeters: number;
  materials: SupplementalRcSceneMaterials;
  trackGeometry: TrackGeometry;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'supplementalRcComponentGroup';

  params.renderModel.rcComponents.forEach((component) => {
    const position = { x: component.position.x, z: component.position.z };
    if (component.type === 'column') {
      const width = Math.max(0.02, component.dimensions.width);
      const depth = Math.max(0.02, component.dimensions.depth);
      const base = component.elevations.base;
      const top = Math.max(base + 0.02, component.elevations.top);
      if (component.footer) {
        const footerWidth = Math.max(width, component.footer.widthMeters);
        const footerLength = Math.max(depth, component.footer.lengthMeters);
        const footerBottom = component.footer.bottomElevationMeters;
        const footerTop = component.footer.topElevationMeters;
        const footerMesh = markSupplementalMesh(
          buildRcElevationBoxMesh({
            name: `supplementalColumnFooter:${component.id}`,
            xSizeMeters: footerWidth,
            zSizeMeters: footerLength,
            bottomElevationMeters: footerBottom,
            topElevationMeters: footerTop,
            x: position.x,
            z: position.z,
            slabTopMeters: params.slabTopMeters,
            material: params.materials.footing,
            trackGeometry: params.trackGeometry,
          }),
          component.id,
          55,
        );
        group.add(footerMesh);
      }
      if (params.useSupplementalPlasterFinish) {
        const concreteTop = Math.min(top, params.supplementalPlinthTopElevationMeters);
        const concreteHeight = Math.max(0, concreteTop - base);
        if (concreteHeight > FOUNDATION_CONTACT_EPSILON_METERS) {
          const concreteMesh = markSupplementalMesh(
            buildRcElevationBoxMesh({
              name: `supplementalColumn:${component.id}:concrete`,
              xSizeMeters: width,
              zSizeMeters: depth,
              bottomElevationMeters: base,
              topElevationMeters: base + concreteHeight,
              x: position.x,
              z: position.z,
              slabTopMeters: params.slabTopMeters,
              material: params.materials.structural,
              trackGeometry: params.trackGeometry,
              minHeightMeters: 0,
            }),
            component.id,
            60,
          );
          group.add(concreteMesh);
        }
        const plasterBase = Math.max(base, params.supplementalPlinthTopElevationMeters);
        const plasterHeight = Math.max(0, top - plasterBase);
        if (plasterHeight > FOUNDATION_CONTACT_EPSILON_METERS) {
          const plasterMesh = markSupplementalMesh(
            buildRcElevationBoxMesh({
              name: `supplementalColumn:${component.id}:plaster`,
              xSizeMeters: width,
              zSizeMeters: depth,
              bottomElevationMeters: plasterBase,
              topElevationMeters: plasterBase + plasterHeight,
              x: position.x,
              z: position.z,
              slabTopMeters: params.slabTopMeters,
              material: params.materials.createPlaster(),
              trackGeometry: params.trackGeometry,
              minHeightMeters: 0,
            }),
            component.id,
            60,
          );
          group.add(plasterMesh);
        }
        return;
      }
      const height = Math.max(0.02, top - base);
      const mesh = markSupplementalMesh(
        buildRcElevationBoxMesh({
          name: `supplementalColumn:${component.id}`,
          xSizeMeters: width,
          zSizeMeters: depth,
          bottomElevationMeters: base,
          topElevationMeters: base + height,
          x: position.x,
          z: position.z,
          slabTopMeters: params.slabTopMeters,
          material: params.materials.structural,
          trackGeometry: params.trackGeometry,
          minHeightMeters: 0,
        }),
        component.id,
        60,
      );
      group.add(mesh);
      return;
    }

    if (component.type === 'footer') {
      const width = Math.max(0.02, component.dimensions.width);
      const length = Math.max(0.02, component.dimensions.length ?? component.dimensions.depth);
      const bottom = component.elevations.base;
      const top = component.elevations.top;
      const mesh = markSupplementalMesh(
        buildRcElevationBoxMesh({
          name: `supplementalFooter:${component.id}`,
          xSizeMeters: width,
          zSizeMeters: length,
          bottomElevationMeters: bottom,
          topElevationMeters: top,
          x: position.x,
          z: position.z,
          slabTopMeters: params.slabTopMeters,
          material: params.materials.footing,
          trackGeometry: params.trackGeometry,
        }),
        component.id,
        55,
      );
      group.add(mesh);
      return;
    }

    if (component.type === 'slab') {
      const width = Math.max(0.02, component.dimensions.width);
      const length = Math.max(0.02, component.dimensions.length ?? 2);
      const thickness = Math.max(0.02, component.dimensions.height);
      const top = component.elevations.top;
      const mesh = markSupplementalMesh(
        buildRcElevationBoxMesh({
          name: `supplementalSlab:${component.id}`,
          xSizeMeters: length,
          zSizeMeters: width,
          bottomElevationMeters: top - thickness,
          topElevationMeters: top,
          x: position.x,
          z: position.z,
          slabTopMeters: params.slabTopMeters,
          material: params.materials.structural,
          trackGeometry: params.trackGeometry,
        }),
        component.id,
        50,
      );
      group.add(mesh);
      return;
    }

    if (
      component.type === 'tie_beam' ||
      component.type === 'plinth_beam' ||
      component.type === 'roof_beam'
    ) {
      const length = Math.max(0.02, component.dimensions.length ?? 1.2);
      const width = Math.max(0.02, component.dimensions.width);
      const depth = Math.max(0.02, component.dimensions.depth);
      const elevation = component.elevations.base;
      const rotation = component.sourceComponent.viewPlacement.plan?.rotationRadians ?? 0;
      const mesh = markSupplementalMesh(
        buildRcBoxMesh({
          name: `supplementalBeam:${component.id}`,
          xSizeMeters: length,
          ySizeMeters: depth,
          zSizeMeters: width,
          center: {
            x: position.x,
            y: params.slabTopMeters + elevation + depth / 2,
            z: position.z,
          },
          rotationY: -rotation,
          material: params.materials.beam,
          trackGeometry: params.trackGeometry,
        }),
        component.id,
        55,
      );
      group.add(mesh);
    }
  });

  return group;
}
