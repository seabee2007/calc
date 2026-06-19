/**
 * Arden BIM Takeoff — core type definitions.
 * Pure TypeScript; no React or Supabase dependencies.
 */

export type BimModelStatus = 'uploaded' | 'processing' | 'ready' | 'unsupported' | 'failed';

export type BimObjectTakeoffStatus = 'unmapped' | 'mapped' | 'ignored';

export type TakeoffSource =
  | 'manual'
  | 'model_property'
  | 'calculated_from_geometry'
  | 'measured_from_model'
  | 'needs_review';

export type TakeoffConfidence =
  | 'manual'
  | 'model_property'
  | 'calculated_from_geometry'
  | 'measured_from_model'
  | 'needs_review';

export type BimTakeoffType = 'count' | 'line' | 'area' | 'volume' | 'manual';

export type BimModelUnit = 'meters' | 'feet' | 'inches' | 'millimeters';

export type BimMeasurementMode = 'off' | 'line' | 'area';

export interface GeometryMetrics {
  /** Bounding-box width (model units, typically meters). */
  width?: number;
  /** Bounding-box height. */
  height?: number;
  /** Bounding-box depth. */
  depth?: number;
  /** Approximate volume from bounding box (width × height × depth). */
  approximateVolume?: number;
  /** Approximate surface area from bounding box. */
  approximateSurfaceArea?: number;
}

export interface BimModel {
  id: string;
  projectId: string;
  estimateId: string | null;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  originalFileName: string;
  originalFileType: string;
  viewerFileType: string | null;
  storagePath: string;
  fileSize: number | null;
  status: BimModelStatus;
  processingStatus: BimModelStatus;
  unsupportedReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BimModelObject {
  id: string;
  modelId: string;
  projectId: string;
  externalObjectId: string;
  name: string | null;
  objectType: string | null;
  category: string | null;
  material: string | null;
  level: string | null;
  properties: Record<string, unknown>;
  geometryMetrics: GeometryMetrics;
  takeoffStatus: BimObjectTakeoffStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BimTakeoffItem {
  id: string;
  projectId: string;
  estimateId: string | null;
  modelId: string;
  objectId: string | null;
  divisionCode: string | null;
  activityCode: string | null;
  estimateLineId: string | null;
  quantity: number;
  unit: string;
  source: TakeoffSource;
  confidence: TakeoffConfidence;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Runtime selection state for the viewer (not persisted until takeoff is saved). */
export interface BimSelectedObjectSnapshot {
  externalObjectId: string;
  name: string | null;
  takeoffName?: string | null;
  objectType: string | null;
  category: string | null;
  material: string | null;
  level: string | null;
  properties: Record<string, unknown>;
  geometryMetrics: GeometryMetrics;
}

export interface CreateBimModelInput {
  id?: string;
  projectId: string;
  estimateId?: string | null;
  uploadedBy: string;
  fileName: string;
  fileType: string;
  originalFileName?: string;
  originalFileType?: string;
  viewerFileType?: string | null;
  storagePath: string;
  fileSize?: number | null;
  status?: BimModelStatus;
  processingStatus?: BimModelStatus;
  unsupportedReason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface InsertBimModelObjectInput {
  modelId: string;
  projectId: string;
  externalObjectId: string;
  name?: string | null;
  objectType?: string | null;
  category?: string | null;
  material?: string | null;
  level?: string | null;
  properties?: Record<string, unknown>;
  geometryMetrics?: GeometryMetrics;
  takeoffStatus?: BimObjectTakeoffStatus;
}

export interface CreateBimTakeoffItemInput {
  projectId: string;
  estimateId?: string | null;
  modelId: string;
  objectId?: string | null;
  divisionCode?: string | null;
  activityCode?: string | null;
  estimateLineId?: string | null;
  quantity: number;
  unit: string;
  source: TakeoffSource;
  confidence: TakeoffConfidence;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export const BIM_MODEL_BUCKET = 'bim-models';

export const ACCEPTED_BIM_FILE_EXTENSIONS = ['.glb'] as const;

/** MVP file-picker extensions — `.gltf` packages are Phase 2 (ZIP upload). */
export const MVP_BIM_UPLOAD_EXTENSIONS = ['.glb'] as const;

export function isAcceptedBimFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return MVP_BIM_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

