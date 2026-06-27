import type { DesignGeometryResult } from '../geometry/designGeometry';
import { createDesignBuilderRcFrameDebugSnapshot } from '../domain/designBuilderRcFrameDebugSnapshot';
import { normalizeRcFrameFoundationSettings } from '../domain/foundationElevations';
import type {
  DesignBuilderViewMode,
  DesignVisualStyle,
  RoofSystemSettings,
  StructuralFoundationSettings,
} from '../types';
import { DraggableDebugOverlay } from './DraggableDebugOverlay';

type DesignBuilderRcDebugOverlaysProps = {
  viewMode: DesignBuilderViewMode;
  designGeometryResult: DesignGeometryResult;
  foundationSettings: StructuralFoundationSettings;
  roofSystem?: RoofSystemSettings | null;
  visualStyle: DesignVisualStyle;
  showRoofReferencePerimeters: boolean;
  showRoofFramingGuides: boolean;
};

export function DesignBuilderRcDebugOverlays({
  viewMode,
  designGeometryResult,
  foundationSettings,
  roofSystem,
  visualStyle,
  showRoofReferencePerimeters,
  showRoofFramingGuides,
}: DesignBuilderRcDebugOverlaysProps) {
  if (
    !import.meta.env.DEV ||
    viewMode !== '3d' ||
    designGeometryResult.buildingSystemMode !== 'reinforced_concrete_frame_with_cmu_infill'
  ) {
    return null;
  }

  const foundation = normalizeRcFrameFoundationSettings(foundationSettings);
  const roof = designGeometryResult.resolvedRoofSystem ?? null;
  const healthSnapshot = createDesignBuilderRcFrameDebugSnapshot({
    geometryResult: designGeometryResult,
    visualStyle,
    usePreviewMaterials: visualStyle === 'material_preview',
  });
  const missingBayCount = healthSnapshot.infillHealth.segmentHealth.reduce(
    (total, segment) => total + segment.missingExpectedBayIds.length,
    0,
  );
  const unmatchedPanelCount = healthSnapshot.infillHealth.segmentHealth.reduce(
    (total, segment) => total + segment.unmatchedAboveGradePanelIds.length,
    0,
  );

  return (
    <>
      {showRoofReferencePerimeters ? (
        <DraggableDebugOverlay
          id="roof-reference-perimeters"
          title="Roof Reference Perimeters"
          titleClassName="text-teal-300"
          className="border-teal-400/60"
        >
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 bg-white" aria-hidden />
            <span>Wall exterior footprint</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 bg-teal-400" aria-hidden />
            <span>Roof Beam structural bearing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-4 bg-yellow-400" aria-hidden />
            <span>Cladding / eave edge</span>
          </div>
          <div className="mt-2 space-y-0.5 border-t border-slate-700 pt-2 font-mono text-[11px]">
            <div>Roof Beam Outer Width: {foundation.roofBeam.widthMeters.toFixed(3)} m</div>
            <div>Roof Beam Outer Depth: {foundation.roofBeam.depthMeters.toFixed(3)} m</div>
            <div>Eave Overhang: {(roofSystem?.eaveOverhangMeters ?? 0).toFixed(3)} m</div>
            <div>Roof Bearing Source: {roof?.roofBearingSource ?? 'unknown'}</div>
          </div>
        </DraggableDebugOverlay>
      ) : null}

      {showRoofFramingGuides ? (
        <>
          <DraggableDebugOverlay
            id="rc-health"
            title="RC Health"
            titleClassName={healthSnapshot.issues.length ? 'text-red-300' : 'text-emerald-300'}
            className={healthSnapshot.issues.length ? 'border-red-400/60' : 'border-emerald-400/60'}
          >
          <div className="space-y-0.5 border-t border-slate-700 pt-2 font-mono text-[11px]">
              <div>Status: {healthSnapshot.status}</div>
              <div>
                Stages: layout {healthSnapshot.stageStatus.layout} | frame{' '}
                {healthSnapshot.stageStatus.frame} | infill {healthSnapshot.stageStatus.infill}
              </div>
              <div>
                Roof/Gable/Mat: {healthSnapshot.stageStatus.roof} |{' '}
                {healthSnapshot.stageStatus.gableEnd} | {healthSnapshot.stageStatus.materialPreview}
              </div>
              <div>Issues: {healthSnapshot.issues.length}</div>
              <div>
                Bays: {healthSnapshot.infillHealth.aboveGradePanelCount}/
                {healthSnapshot.infillHealth.expectedAboveGradeBayCount}
              </div>
              <div>
                Missing/Unmatched: {missingBayCount}/{unmatchedPanelCount}
              </div>
              <div>
                Panels w/ Blocks: {healthSnapshot.infillHealth.aboveGradePanelsWithBlocks}/
                {healthSnapshot.infillHealth.aboveGradePanelCount}
              </div>
              <div>
                Panels w/ Plaster: {healthSnapshot.infillHealth.aboveGradePanelsWithPlaster}/
                {healthSnapshot.infillHealth.aboveGradePanelCount}
              </div>
              <div>
                Roof: {healthSnapshot.roofHealth.supported ? 'supported' : 'not supported'} | planes{' '}
                {healthSnapshot.roofHealth.roofTopPlaneCount} | purlins {healthSnapshot.roofHealth.purlinCount}
              </div>
              <div>
                Gable CMU: {healthSnapshot.gableEndHealth.gableEndCmuBlockCount} blocks on{' '}
                {healthSnapshot.gableEndHealth.resolvedGableEndCount} ends
              </div>
              {healthSnapshot.issues.slice(0, 3).map((issue) => (
                <div key={`${issue.code}:${issue.path}`} className="text-red-200">
                  {issue.code}: {issue.path}
                </div>
              ))}
            </div>
          </DraggableDebugOverlay>

          <DraggableDebugOverlay
            id="roof-framing-guides"
            title="Roof Framing Guides"
            titleClassName="text-slate-300"
            className="border-slate-500/60"
          >
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-teal-400" aria-hidden />
              <span>Structural gable wall boundary</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-yellow-400" aria-hidden />
              <span>Gable-end cladding edge</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-blue-500" aria-hidden />
              <span>Purlins</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-slate-400" aria-hidden />
              <span>Roof sheets</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-green-500" aria-hidden />
              <span>Structural supports</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-orange-500" aria-hidden />
              <span>Truss top chords</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-purple-500" aria-hidden />
              <span>Truss bottom chords</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4 rounded-sm bg-yellow-400" aria-hidden />
              <span>Truss web members</span>
            </div>
          </DraggableDebugOverlay>

          {roof?.supported && roof.roofType === 'gable' ? (
            <DraggableDebugOverlay
              id="gable-end-overhang"
              title="Gable-End Overhang"
              titleClassName="text-cyan-300"
              className="border-cyan-400/60"
            >
              <GableEndOverhangInspector roof={roof} />
            </DraggableDebugOverlay>
          ) : null}

          {roof?.trussPlacements.length ? (
            <DraggableDebugOverlay
              id="truss-inspector"
              title="Truss Inspector"
              titleClassName="text-orange-300"
              className="border-orange-400/60"
            >
              <TrussInspector roof={roof} />
            </DraggableDebugOverlay>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function GableEndOverhangInspector({
  roof,
}: {
  roof: NonNullable<DesignGeometryResult['resolvedRoofSystem']>;
}) {
  const purlinLength = roof.purlinPlacements[0]
    ? Math.hypot(
        roof.purlinPlacements[0].end.x - roof.purlinPlacements[0].start.x,
        roof.purlinPlacements[0].end.z - roof.purlinPlacements[0].start.z,
      )
    : 0;
  return (
    <div className="space-y-0.5 border-t border-slate-700 pt-2 font-mono text-[11px]">
      <div>Structural Ridge Length: {roof.structuralRidgeLengthMeters.toFixed(3)} m</div>
      <div>Gable-End Overhang: {roof.gableEndOverhangMeters.toFixed(3)} m</div>
      <div>Purlin Full Length: {purlinLength.toFixed(3)} m</div>
      <div>Roof Cladding Length: {roof.claddingRidgeLengthMeters.toFixed(3)} m</div>
    </div>
  );
}

function TrussInspector({
  roof,
}: {
  roof: NonNullable<DesignGeometryResult['resolvedRoofSystem']>;
}) {
  const truss = roof.trussPlacements[0];
  if (!truss) return null;
  const topLeft = truss.members.find((member) => member.memberKind === 'top_chord_left');
  const bottom = truss.members.find((member) => member.memberKind === 'bottom_chord');
  const webCount = truss.members.filter(
    (member) => member.memberKind === 'diagonal_web' || member.memberKind === 'vertical_web',
  ).length;
  return (
    <div className="space-y-0.5 border-t border-slate-700 pt-2 font-mono text-[11px]">
      <div>Truss ID: {truss.id}</div>
      <div>Station: {truss.stationMeters.toFixed(3)} m</div>
      <div>
        Left Bearing: ({truss.bearingLeft.x.toFixed(2)}, {truss.bearingLeft.y.toFixed(2)},{' '}
        {truss.bearingLeft.z.toFixed(2)})
      </div>
      <div>
        Right Bearing: ({truss.bearingRight.x.toFixed(2)}, {truss.bearingRight.y.toFixed(2)},{' '}
        {truss.bearingRight.z.toFixed(2)})
      </div>
      <div>
        Apex: ({truss.apex.x.toFixed(2)}, {truss.apex.y.toFixed(2)}, {truss.apex.z.toFixed(2)})
      </div>
      <div>Top-Chord Length: {memberLength(topLeft).toFixed(3)} m</div>
      <div>Bottom-Chord Length: {memberLength(bottom).toFixed(3)} m</div>
      <div>Web Member Count: {webCount}</div>
    </div>
  );
}

function memberLength(member: { start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number } } | undefined): number {
  if (!member) return 0;
  return Math.hypot(
    member.end.x - member.start.x,
    member.end.y - member.start.y,
    member.end.z - member.start.z,
  );
}
