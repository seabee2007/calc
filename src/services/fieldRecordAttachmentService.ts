import { supabase } from '../lib/supabase';
import type { FieldRecordAttachment } from '../types/fieldPlanner';

function mapAttachment(row: Record<string, unknown>): FieldRecordAttachment {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    taskId: (row.task_id as string) ?? null,
    rfiId: (row.rfi_id as string) ?? null,
    adjustmentId: (row.adjustment_id as string) ?? null,
    uploadedBy: row.uploaded_by as string,
    fileName: row.file_name as string,
    fileUrl: row.file_url as string,
    fileType: (row.file_type as string) ?? null,
    attachmentType: (row.attachment_type as string) ?? 'photo',
    createdAt: row.created_at as string,
  };
}

async function uploadToStorage(
  file: File,
  userId: string,
  projectId: string,
  folder: string,
): Promise<{ publicUrl: string; path: string; fileName: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${userId}/${projectId}/${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('field-attachments').upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });

  if (error) throw new Error(`Failed to upload attachment: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from('field-attachments').getPublicUrl(filePath);

  return { publicUrl, path: filePath, fileName: file.name };
}

export async function fetchRfiAttachments(rfiId: string): Promise<FieldRecordAttachment[]> {
  const { data, error } = await supabase
    .from('field_record_attachments')
    .select('*')
    .eq('rfi_id', rfiId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAttachment);
}

export async function fetchAdjustmentAttachments(
  adjustmentId: string,
): Promise<FieldRecordAttachment[]> {
  const { data, error } = await supabase
    .from('field_record_attachments')
    .select('*')
    .eq('adjustment_id', adjustmentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapAttachment);
}

export async function uploadRfiAttachments(
  files: File[],
  input: {
    userId: string;
    projectId: string;
    taskId?: string | null;
    rfiId: string;
  },
): Promise<FieldRecordAttachment[]> {
  const results: FieldRecordAttachment[] = [];
  for (const file of files) {
    const { publicUrl, fileName } = await uploadToStorage(
      file,
      input.userId,
      input.projectId,
      `rfi/${input.rfiId}`,
    );
    const { data, error } = await supabase
      .from('field_record_attachments')
      .insert({
        project_id: input.projectId,
        task_id: input.taskId ?? null,
        rfi_id: input.rfiId,
        uploaded_by: input.userId,
        file_name: fileName,
        file_url: publicUrl,
        file_type: file.type || null,
        attachment_type: file.type.startsWith('image/') ? 'photo' : 'document',
      })
      .select('*')
      .single();
    if (error) throw error;
    results.push(mapAttachment(data));
  }
  return results;
}

export async function uploadAdjustmentAttachments(
  files: File[],
  input: {
    userId: string;
    projectId: string;
    taskId?: string | null;
    adjustmentId: string;
  },
): Promise<FieldRecordAttachment[]> {
  const results: FieldRecordAttachment[] = [];
  for (const file of files) {
    const { publicUrl, fileName } = await uploadToStorage(
      file,
      input.userId,
      input.projectId,
      `far/${input.adjustmentId}`,
    );
    const { data, error } = await supabase
      .from('field_record_attachments')
      .insert({
        project_id: input.projectId,
        task_id: input.taskId ?? null,
        adjustment_id: input.adjustmentId,
        uploaded_by: input.userId,
        file_name: fileName,
        file_url: publicUrl,
        file_type: file.type || null,
        attachment_type: file.type.startsWith('image/') ? 'photo' : 'document',
      })
      .select('*')
      .single();
    if (error) throw error;
    results.push(mapAttachment(data));
  }
  return results;
}
