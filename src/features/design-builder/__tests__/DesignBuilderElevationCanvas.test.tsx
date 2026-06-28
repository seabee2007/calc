import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignBuilderElevationCanvas from '../ui/DesignBuilderElevationCanvas';
import type { PlacedDesignComponent, ResolvedFloorTileLayout, ResolvedPlywoodCeilingLayout, ResolvedRoofSystem } from '../types';
import type { ResolvedInteriorFloorSlab } from '../domain/interiorFloorSlab';
import type { DesignRenderModel } from '../domain/designRenderModel';
import type { SegmentFrame } from '../geometry/designGeometry';

const layoutBounds = {
  minX: 0,
  maxX: 4,
  minY: -0.6,
  maxY: 3,
  minZ: 0,
  maxZ: 3,
  center: { x: 2, y: 1.2, z: 1.5 },
  width: 4,
  depth: 3,
  height: 3.6,
};

const frameSystem = {
  kind: 'structural_frame_system',
  buildingSystemMode: 'reinforced_concrete_frame_with_cmu_infill',
  defaultColumnWidthMeters: 0.3,
  defaultColumnDepthMeters: 0.3,
  defaultGradeBeamWidthMeters: 0.2,
  defaultGradeBeamDepthMeters: 0.3,
  defaultRingBeamWidthMeters: 0.2,
  defaultRingBeamDepthMeters: 0.3,
  columns: [
    {
      id: 'column-a',
      name: 'Column A',
      kind: 'rc_column',
      position: { x: 0, z: 0 },
      widthMeters: 0.3,
      depthMeters: 0.3,
      heightMeters: 3,
      baseElevationMeters: 0,
      topElevationMeters: 3,
      hostNodeId: 'node-a',
      source: 'auto_frame_layout',
    },
    {
      id: 'column-b',
      name: 'Column B',
      kind: 'rc_column',
      position: { x: 4, z: 0 },
      widthMeters: 0.3,
      depthMeters: 0.3,
      heightMeters: 3,
      baseElevationMeters: 0,
      topElevationMeters: 3,
      hostNodeId: 'node-b',
      source: 'auto_frame_layout',
    },
  ],
  beams: [
    {
      id: 'plinth-a-b',
      name: 'Plinth A-B',
      kind: 'plinth_beam',
      startColumnId: 'column-a',
      endColumnId: 'column-b',
      startPoint: { x: 0, y: 0.3, z: 0 },
      endPoint: { x: 4, y: 0.3, z: 0 },
      widthMeters: 0.2,
      depthMeters: 0.3,
      baseElevationMeters: 0,
      topElevationMeters: 0.3,
      source: 'auto_frame_layout',
    },
    {
      id: 'roof-a-b',
      name: 'Roof A-B',
      kind: 'roof_beam',
      startColumnId: 'column-a',
      endColumnId: 'column-b',
      startPoint: { x: 0, y: 3, z: 0 },
      endPoint: { x: 4, y: 3, z: 0 },
      widthMeters: 0.2,
      depthMeters: 0.3,
      baseElevationMeters: 2.7,
      topElevationMeters: 3,
      source: 'auto_frame_layout',
    },
  ],
} as const;

const isolatedFootings = [
  {
    id: 'footing-a',
    name: 'Footing A',
    columnId: 'column-a',
    position: { x: 0, z: 0 },
    widthMeters: 0.9,
    lengthMeters: 1.1,
    thicknessMeters: 0.3,
    topElevationMeters: -0.3,
    bottomElevationMeters: -0.6,
    centerElevationMeters: -0.45,
    source: 'auto_at_column',
  },
] as const;

const interiorFloorSlab: ResolvedInteriorFloorSlab = {
  enabled: true,
  thicknessMeters: 0.125,
  bottomElevationMeters: 0.175,
  topElevationMeters: 0.3,
  areaSquareMeters: 12,
  volumeCubicMeters: 1.5,
};

const floorTileLayout: ResolvedFloorTileLayout = {
  enabled: true,
  tileSizeKey: '600x600',
  tileWidthMeters: 0.6,
  tileDepthMeters: 0.6,
  groutJointMeters: 0.003,
  thinsetThicknessMeters: 0.012,
  wasteFactor: 0.1,
  floorAreaSquareMeters: 12,
  installedAreaSquareMeters: 12,
  fullTileCount: 2,
  cutTileCount: 1,
  totalTileCount: 3,
  orderTileCount: 4,
  thinsetVolumeCubicMeters: 0.144,
  thinsetBags: 3,
  groutVolumeCubicMeters: 0.01,
  groutBags: 1,
  placements: [
    {
      id: 'tile-full-a',
      kind: 'full',
      center: { x: 1, z: 1 },
      widthMeters: 0.6,
      depthMeters: 0.6,
      renderCenter: { x: 1, z: 1 },
      renderWidthMeters: 0.6,
      renderDepthMeters: 0.6,
      installedAreaSquareMeters: 0.36,
      rotationY: 0,
    },
    {
      id: 'tile-cut-a',
      kind: 'cut',
      center: { x: 1.6, z: 1 },
      widthMeters: 0.6,
      depthMeters: 0.6,
      renderCenter: { x: 1.6, z: 1 },
      renderWidthMeters: 0.3,
      renderDepthMeters: 0.6,
      installedAreaSquareMeters: 0.18,
      rotationY: 0,
    },
  ],
};

const plywoodCeilingLayout: ResolvedPlywoodCeilingLayout = {
  enabled: true,
  ceilingHeightMeters: 2.55,
  frameBottomElevationMeters: 2.55,
  plywoodColor: '#c8a882',
  sheetWidthMeters: 1.2,
  sheetLengthMeters: 2.4,
  sheetThicknessMeters: 0.019,
  braceSpacingMeters: 0.6,
  tubeSizeMeters: 0.04,
  ceilingAreaSquareMeters: 12,
  fullPanelCount: 1,
  cutPanelCount: 1,
  totalPanelCount: 2,
  orderPanelCount: 3,
  longAxis: 'x',
  shortSpanMeters: 3,
  longSpanMeters: 4,
  warnings: [],
  frameMembers: [
    {
      id: 'ceiling-frame-a',
      kind: 'cross_brace',
      start: { x: 0.5, y: 2.55, z: 0.5 },
      end: { x: 3.5, y: 2.55, z: 0.5 },
      widthMeters: 0.04,
      heightMeters: 0.04,
    },
  ],
  panelPlacements: [
    {
      id: 'ceiling-panel-a',
      kind: 'full',
      center: { x: 1.2, y: 2.52, z: 1.2 },
      widthMeters: 1.2,
      lengthMeters: 2.4,
      thicknessMeters: 0.019,
    },
  ],
};

function createResolvedRoofFixture(): ResolvedRoofSystem {
  const perimeter = [
    { x: -0.6, y: 3, z: -0.6 },
    { x: 4.6, y: 3, z: -0.6 },
    { x: 4.6, y: 3, z: 2.6 },
    { x: -0.6, y: 3, z: 2.6 },
  ];
  const ridgeStart = { x: 0.4, y: 3.8, z: 1 };
  const ridgeEnd = { x: 3.6, y: 3.8, z: 1 };
  const trussPlacements: ResolvedRoofSystem['trussPlacements'] = [0.4, 2, 3.6].map((x, index) => {
    const bearingLeft = { x, y: 3, z: -0.6 };
    const bearingRight = { x, y: 3, z: 2.6 };
    const apex = { x, y: 3.8, z: 1 };
    return {
      id: `truss-${index + 1}`,
      stationMeters: index * 1.6,
      bearingLeft,
      bearingRight,
      apex,
      ridgeAxis: 'x',
      planeNormal: { x: 1, y: 0, z: 0 },
      members: [
        { id: `truss-${index + 1}-bottom`, memberKind: 'bottom_chord', start: bearingLeft, end: bearingRight },
        { id: `truss-${index + 1}-top-left`, memberKind: 'top_chord_left', start: bearingLeft, end: apex },
        { id: `truss-${index + 1}-top-right`, memberKind: 'top_chord_right', start: apex, end: bearingRight },
        { id: `truss-${index + 1}-web`, memberKind: 'diagonal_web', start: { x, y: 3, z: 0.1 }, end: apex },
      ],
    };
  });
  return {
    supported: true,
    roofType: 'gable',
    roofBearingSource: 'roof_beam_outer_faces',
    exteriorRoofBeamBounds: { footprint: perimeter, center: { x: 2, y: 3, z: 1 }, widthMeters: 4, depthMeters: 2 },
    structuralBearingPerimeter: perimeter,
    claddingPerimeter: perimeter,
    roofSheetPerimeter: perimeter,
    eaveFootprint: perimeter,
    ridgeStart,
    ridgeEnd,
    structuralRidgeStart: ridgeStart,
    structuralRidgeEnd: ridgeEnd,
    claddingRidgeStart: ridgeStart,
    claddingRidgeEnd: ridgeEnd,
    structuralRidgeLengthMeters: 3.2,
    claddingRidgeLengthMeters: 3.2,
    gableEndOverhangMeters: 0.6,
    ridgeCapPlacement: null,
    ridgeCapPlacements: [],
    roofBeamTopElevationMeters: 3,
    roofBeamTopY: 3,
    peakElevationMeters: 3.8,
    roofPeakY: 3.8,
    roofAssemblyThicknessMeters: 0.15,
    roofTopPlanes: [
      { id: 'north-slope', corners: [perimeter[0]!, perimeter[1]!, ridgeEnd, ridgeStart], normal: { x: 0, y: 1, z: -0.25 } },
      { id: 'south-slope', corners: [ridgeStart, ridgeEnd, perimeter[2]!, perimeter[3]!], normal: { x: 0, y: 1, z: 0.25 } },
    ],
    claddingDisplayPlanes: [],
    roofUndersidePlanes: [],
    gableEndSegmentIds: [],
    rafterRunMeters: 1,
    rafterRiseMeters: 0.8,
    rafterLengthMeters: 1.28,
    structuralRafterRunMeters: 1,
    claddingRafterRunMeters: 1.6,
    claddingRafterLengthMeters: 1.79,
    roofPitchRadians: Math.atan(0.8),
    roofRunMeters: 1,
    roofRiseMeters: 0.8,
    roofMemberReferenceLengthMeters: 1.28,
    ridgeLengthMeters: 3.2,
    roofSurfaceAreaSquareMeters: 12,
    trussCount: trussPlacements.length,
    actualTrussSpacingMeters: 1.6,
    trussStations: trussPlacements.map((truss) => truss.stationMeters),
    trussPlacements,
    purlinRowsPerSlope: 2,
    actualPurlinSpacingMeters: 0.8,
    purlinPlacements: [
      { id: 'north-purlin', slopePlaneId: 'north-slope', rowIndex: 1, start: { x: -0.2, y: 3.42, z: 0.35 }, end: { x: 4.2, y: 3.42, z: 0.35 }, planeNormal: { x: 0, y: 1, z: -0.25 } },
      { id: 'south-purlin', slopePlaneId: 'south-slope', rowIndex: 1, start: { x: -0.2, y: 3.42, z: 1.65 }, end: { x: 4.2, y: 3.42, z: 1.65 }, planeNormal: { x: 0, y: 1, z: 0.25 } },
    ],
    hipFramingMembers: [],
    gableCmuAreaSquareMeters: 0,
    rakedCapVolumeCubicMeters: 0,
    gableEnds: [],
    gableEndRoofingClosures: [],
    fasciaPlacements: [],
    soffitPlacements: [],
    warnings: [],
  };
}

describe('DesignBuilderElevationCanvas', () => {
  it('uses the shared architectural drawing shell and elevation annotations', () => {
    const { container } = render(
      <DesignBuilderElevationCanvas
        toolMode="select"
        elevationView={{ face: 'north' }}
        layoutBounds={layoutBounds}
        drawingStyleMode="architectural"
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-drawing-style-mode="architectural"]')).toBeTruthy();
    expect(container.querySelector('[data-canvas-layer="drawing-sheet"]')).toHaveAttribute('fill', '#f8fafc');
    expect(container.querySelector('[data-drawing-annotation="elevation-title"]')?.textContent).toContain('Elevation View');
    expect(container.querySelector('[data-drawing-annotation="front-elevation-title"]')?.textContent).toContain('Front Elevation');
    expect(container.querySelector('[data-drawing-annotation="side-elevation-title"]')?.textContent).toContain('Side Elevation');
    expect(container.querySelector('[data-drawing-annotation="ground-line"]')).toBeTruthy();
    expect(container.querySelector('[data-drawing-annotation="level-marker"]')).toBeTruthy();
    expect(container.querySelector('[data-drawing-annotation="elevation-dimension"]')).toBeNull();
  });

  it('projects the full structural system into front and side elevation drawings', () => {
    const { container } = render(
      <DesignBuilderElevationCanvas
        toolMode="select"
        elevationView={{ face: 'north' }}
        layoutBounds={layoutBounds}
        drawingStyleMode="architectural"
        frameSystem={frameSystem}
        isolatedFootings={isolatedFootings}
        resolvedRoofSystem={createResolvedRoofFixture()}
        interiorFloorSlab={interiorFloorSlab}
        floorTileLayout={floorTileLayout}
        plywoodCeilingLayout={plywoodCeilingLayout}
        openings={[{ id: 'window-a', type: 'window', wallFace: 'north', offsetMeters: 2, widthMeters: 0.8, heightMeters: 0.6, sillHeightMeters: 1.2 }]}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-elevation-wall-envelope="front"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-infill-panel="front"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-footing="footing-a"]')).toBeTruthy();
    expect(container.querySelector('[data-beam-kind="roof_beam"]')).toBeTruthy();
    expect(container.querySelector('[data-canvas-layer="columns"] rect')).toBeTruthy();
    expect(container.querySelector('[data-opening-type="window"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-roof-projection="front"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-roof-projection="side"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-roof-plane="north-slope"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-roof-purlin="north-slope"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-roof-truss-member="diagonal_web"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-roof-ridge="true"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-roof-purlin="north-slope"]')?.tagName.toLowerCase()).toBe('polygon');
    expect(container.querySelector('[data-elevation-roof-truss-member="diagonal_web"]')?.tagName.toLowerCase()).toBe('polygon');
    expect(container.querySelector('[data-elevation-floor-thinset="front"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-floor-tile="full"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-ceiling-frame="cross_brace"]')?.tagName.toLowerCase()).toBe('polygon');
    expect(container.querySelector('[data-elevation-ceiling-plywood="full"]')).toBeTruthy();
    expect(container.querySelector('[data-elevation-ceiling-plywood-continuous]')).toBeFalsy();

    const layerNames = Array.from(container.querySelectorAll('svg > g[data-canvas-layer]')).map((layer) =>
      layer.getAttribute('data-canvas-layer'),
    );
    expect(layerNames.indexOf('ceiling-finishes')).toBeLessThan(layerNames.indexOf('beams-walls'));
    expect(layerNames.indexOf('ceiling-finishes')).toBeLessThan(layerNames.indexOf('columns'));
  });

  it('uses face-specific RC component extents for front and side elevation projections', () => {
    const sourceComponent = {
      id: 'wide-column',
      type: 'column',
      division: 'Concrete',
      category: 'structure',
      viewPlacement: { plan: { xMeters: 1, zMeters: 1 } },
      parameters: {},
      derived: {},
      metadata: {
        createdAt: '2026-06-27T00:00:00.000Z',
        updatedAt: '2026-06-27T00:00:00.000Z',
      },
    } as PlacedDesignComponent;
    const designRenderModel: DesignRenderModel = {
      rcComponents: [
        {
          id: 'wide-column',
          sourceComponentId: 'wide-column',
          type: 'column',
          category: 'structure',
          system: 'reinforced-concrete',
          position: { x: 1, y: 0, z: 1 },
          dimensions: { width: 0.3, depth: 0.9, height: 3 },
          elevations: { base: 0, top: 3 },
          references: { sourceView: 'plan' },
          sourceComponent,
        },
      ],
    };

    const { container } = render(
      <DesignBuilderElevationCanvas
        toolMode="select"
        elevationView={{ face: 'north' }}
        layoutBounds={layoutBounds}
        drawingStyleMode="architectural"
        designRenderModel={designRenderModel}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-component-id="wide-column"][data-elevation-projection="front"]')).toHaveAttribute(
      'data-projected-width-meters',
      '0.300',
    );
    expect(container.querySelector('[data-component-id="wide-column"][data-elevation-projection="side"]')).toHaveAttribute(
      'data-projected-width-meters',
      '0.900',
    );
  });

  it('projects wall openings from their host segment world station in elevation view', () => {
    const segmentFrames: SegmentFrame[] = [
      {
        segmentId: 'north-wall',
        start: { x: 10, z: 0 },
        end: { x: 14, z: 0 },
        exteriorStart: { x: 10, z: 0 },
        exteriorEnd: { x: 14, z: 0 },
        interiorStart: { x: 10, z: 0.2 },
        interiorEnd: { x: 14, z: 0.2 },
        centerlineStart: { x: 10, z: 0.1 },
        centerlineEnd: { x: 14, z: 0.1 },
        lengthMeters: 4,
        tangent: { x: 1, z: 0 },
        inwardNormal: { x: 0, z: 1 },
        outwardNormal: { x: 0, z: -1 },
        rotationY: 0,
        wallHeightMeters: 3,
        wallThicknessMeters: 0.2,
      },
    ];

    const { container } = render(
      <DesignBuilderElevationCanvas
        toolMode="select"
        elevationView={{ face: 'north' }}
        layoutBounds={layoutBounds}
        drawingStyleMode="architectural"
        segmentFrames={segmentFrames}
        openings={[
          {
            id: 'hosted-window',
            type: 'window',
            wallFace: 'north',
            wallSegmentId: 'north-wall',
            positionAlongSegment: 1,
            placementUsesCenterStation: true,
            widthMeters: 0.8,
            heightMeters: 0.6,
            sillHeightMeters: 1.2,
          },
        ]}
        onInteraction={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-opening-id="hosted-window"]')).toHaveAttribute(
      'data-opening-station-meters',
      '11.000',
    );
  });
});
