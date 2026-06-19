import { supabase } from '../../../lib/supabase';
import { BIM_MODEL_BUCKET } from '../types';

export interface UploadBimModelParams {
  file: File;
  userId: string;
  projectId: string;
  modelId: string;
}

export interface UploadBimModelResult {
  storagePath: string;
  fileSize: number;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function buildBimModelStoragePath(params: {
  userId: string;
  projectId: string;
  modelId: string;
  fileName: string;
}): string {
  const safeName = sanitizeFileName(params.fileName);
  return `${params.userId}/${params.projectId}/${params.modelId}/${Date.now()}-${safeName}`;
}

export async function uploadBimModel(params: UploadBimModelParams): Promise<UploadBimModelResult> {
  const { file, userId, projectId, modelId } = params;
  const storagePath = buildBimModelStoragePath({
    userId,
    projectId,
    modelId,
    fileName: file.name,
  });

  const contentType =
    file.type ||
    (file.name.toLowerCase().endsWith('.gltf') ? 'model/gltf+json' : 'model/gltf-binary');

  const { error } = await supabase.storage.from(BIM_MODEL_BUCKET).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { storagePath, fileSize: file.size };
}

export async function getBimModelSignedUrl(
  storagePath: string,
  ttlSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BIM_MODEL_BUCKET)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Could not create signed URL for BIM model.');
  }

  return data.signedUrl;
}

export async function deleteBimModelFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from(BIM_MODEL_BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(error.message);
  }
}
