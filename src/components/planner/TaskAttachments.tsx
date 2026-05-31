import React, { useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon } from 'lucide-react';
import type { TaskAttachment } from '../../types/fieldPlanner';
import { addTaskAttachmentRecord } from '../../services/taskActivityService';
import { uploadFieldAttachment } from '../../services/storageService';
import Button from '../ui/Button';
import {
  PLANNER_ATTACHMENT_ICON,
  PLANNER_ATTACHMENT_NAME,
  PLANNER_ATTACHMENT_TILE,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  PLANNER_UPLOAD_ZONE,
} from './plannerTheme';

interface TaskAttachmentsProps {
  taskId: string;
  projectId: string;
  userId: string;
  attachments: TaskAttachment[];
  canUpload: boolean;
  onChange: () => void;
}

export default function TaskAttachments({
  taskId,
  projectId,
  userId,
  attachments,
  canUpload,
  onChange,
}: TaskAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !canUpload) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadFieldAttachment(file, userId, projectId, taskId);
        await addTaskAttachmentRecord({
          taskId,
          projectId,
          uploadedBy: userId,
          fileName: uploaded.fileName,
          fileUrl: uploaded.publicUrl,
          fileType: file.type,
          attachmentType: file.type.startsWith('image/') ? 'photo' : 'document',
        });
      }
      onChange();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={PLANNER_SECTION_TITLE}>Photos & documents</h4>
        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              variant="accent"
              size="sm"
              className="min-h-[44px] md:min-h-0"
              icon={<Camera className="h-4 w-4" />}
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Upload
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {attachments.map((a) => (
          <a
            key={a.id}
            href={a.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={PLANNER_ATTACHMENT_TILE}
          >
            {a.attachmentType === 'photo' ? (
              <img
                src={a.fileUrl}
                alt={a.fileName}
                className="aspect-square w-full rounded object-cover"
              />
            ) : (
              <div
                className={`flex aspect-square flex-col items-center justify-center ${PLANNER_ATTACHMENT_ICON}`}
              >
                <FileText className="h-8 w-8" />
              </div>
            )}
            <p className={PLANNER_ATTACHMENT_NAME}>{a.fileName}</p>
          </a>
        ))}
        {attachments.length === 0 && (
          <p className={`col-span-full ${PLANNER_MUTED}`}>No uploads yet.</p>
        )}
      </div>

      {canUpload && attachments.length === 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={PLANNER_UPLOAD_ZONE}
        >
          <ImageIcon className="h-5 w-5" />
          Tap to upload photo
        </button>
      )}
    </div>
  );
}
