/**
 * MVP upload validation for 3D Takeoff models.
 *
 * Production path: single-file `.glb` only.
 * Loose GLTF, ZIP packages, IFC, RVT/SKP, and visual-only formats are future
 * import-pipeline work and are rejected before storage upload.
 */

import { inferBimModelFormat } from './bimModelFormatRegistry';

export const GLTF_EXTERNAL_REFERENCE_ERROR =
  'Standalone GLTF files often require separate .bin and texture files. Upload a single-file .glb model for now.';

export const IFC_IMPORT_FUTURE_ERROR =
  'IFC BIM import is planned, but not supported in this MVP. Upload a .glb model for now.';

export const REVIT_SKETCHUP_EXPORT_ERROR =
  'Native Revit and SketchUp files are not supported directly. Export your model to .glb for now.';

export const INVALID_BIM_FILE_ERROR =
  'Unsupported model format. Upload a single-file .glb model.';

export const BIM_MODEL_LOAD_ERROR =
  'Model could not be loaded. This file may be missing required .bin or texture files. Try uploading a single-file .glb model.';

export interface BimUploadValidationResult {
  ok: boolean;
  error?: string;
}

export function isGlbFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.glb');
}

export function isGltfFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.gltf');
}

function isEmbeddedDataUri(uri: string): boolean {
  return uri.startsWith('data:');
}

function isExternalGltfUri(uri: unknown): boolean {
  if (typeof uri !== 'string' || uri.length === 0) return false;
  return !isEmbeddedDataUri(uri);
}

export function gltfJsonHasExternalReferences(doc: unknown): boolean {
  if (!doc || typeof doc !== 'object') return false;
  const root = doc as Record<string, unknown>;

  const buffers = Array.isArray(root.buffers) ? root.buffers : [];
  for (const buffer of buffers) {
    if (buffer && typeof buffer === 'object' && isExternalGltfUri((buffer as Record<string, unknown>).uri)) {
      return true;
    }
  }

  const images = Array.isArray(root.images) ? root.images : [];
  for (const image of images) {
    if (image && typeof image === 'object' && isExternalGltfUri((image as Record<string, unknown>).uri)) {
      return true;
    }
  }

  return false;
}

export async function validateBimModelFileForUpload(file: File): Promise<BimUploadValidationResult> {
  const format = inferBimModelFormat(file.name);
  if (format === 'glb') {
    return { ok: true };
  }

  if (format === 'gltf') {
    return { ok: false, error: GLTF_EXTERNAL_REFERENCE_ERROR };
  }

  if (format === 'ifc') {
    return { ok: false, error: IFC_IMPORT_FUTURE_ERROR };
  }

  if (format === 'rvt' || format === 'skp') {
    return { ok: false, error: REVIT_SKETCHUP_EXPORT_ERROR };
  }

  return { ok: false, error: INVALID_BIM_FILE_ERROR };
}

export function isMissingAssetLoadError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('scene.bin') ||
    lower.includes('failed to load buffer') ||
    lower.includes("couldn't load texture") ||
    lower.includes('failed to load texture') ||
    lower.includes('/object/sign/') ||
    lower.includes('400')
  );
}

export function formatBimViewerLoadError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (isMissingAssetLoadError(message)) {
    return BIM_MODEL_LOAD_ERROR;
  }
  return BIM_MODEL_LOAD_ERROR;
}
