export type BimModelFormat =
  | 'glb'
  | 'gltf'
  | 'gltf_zip'
  | 'ifc'
  | 'obj'
  | 'fbx'
  | 'rvt'
  | 'skp'
  | 'unknown';

export type BimFormatSupportStatus = 'supported' | 'unsupported_mvp' | 'future' | 'unsupported';

export interface BimFormatSupportInfo {
  status: BimFormatSupportStatus;
  viewerReady: boolean;
  reason: string;
}

export const BIM_FORMAT_SUPPORT: Record<BimModelFormat, BimFormatSupportInfo> = {
  glb: {
    status: 'supported',
    viewerReady: true,
    reason: 'Single-file browser-ready model for MVP 3D takeoff.',
  },
  gltf: {
    status: 'unsupported_mvp',
    viewerReady: false,
    reason: 'Standalone GLTF files often require separate .bin and texture files.',
  },
  gltf_zip: {
    status: 'future',
    viewerReady: false,
    reason: 'Will support packaged GLTF assets later.',
  },
  ifc: {
    status: 'future',
    viewerReady: false,
    reason: 'IFC BIM import is planned later.',
  },
  obj: {
    status: 'future',
    viewerReady: false,
    reason: 'Maybe later as a visual-only model format.',
  },
  fbx: {
    status: 'future',
    viewerReady: false,
    reason: 'Maybe later as a visual-only model format.',
  },
  rvt: {
    status: 'unsupported',
    viewerReady: false,
    reason: 'Native Revit files are not supported directly. Export to GLB or IFC first.',
  },
  skp: {
    status: 'unsupported',
    viewerReady: false,
    reason: 'Native SketchUp files are not supported directly. Export to GLB or IFC first.',
  },
  unknown: {
    status: 'unsupported',
    viewerReady: false,
    reason: 'Unsupported model format.',
  },
};

export function inferBimModelFormat(fileName: string): BimModelFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.glb')) return 'glb';
  if (lower.endsWith('.gltf')) return 'gltf';
  if (lower.endsWith('.zip')) return 'gltf_zip';
  if (lower.endsWith('.ifc')) return 'ifc';
  if (lower.endsWith('.obj')) return 'obj';
  if (lower.endsWith('.fbx')) return 'fbx';
  if (lower.endsWith('.rvt')) return 'rvt';
  if (lower.endsWith('.skp')) return 'skp';
  return 'unknown';
}

export function isViewerReadyBimFormat(fileName: string, fileType?: string | null): boolean {
  const format = inferBimModelFormat(fileName);
  return format === 'glb' || fileType === 'glb';
}
