import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Camera, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForEmployee } from '../../services/plannerService';
import { addTaskAttachmentRecord } from '../../services/taskActivityService';
import { uploadFieldAttachment } from '../../services/storageService';
import type { PlannerTask } from '../../types/fieldPlanner';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadedPreview {
  fileName: string;
  publicUrl: string;
  previewUrl: string;
  uploadedAt: string;
}

function formatUploadCount(count: number): string {
  return count === 1 ? '✅ 1 photo uploaded' : `✅ ${count} photos uploaded`;
}

function formatUploadedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function EmployeeUploadsPage() {
  useEmployeePageTitle('Upload');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetTaskId = searchParams.get('taskId') ?? '';
  const presetTaskTitle = searchParams.get('taskTitle') ?? '';
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [taskId, setTaskId] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [lastUploadedCount, setLastUploadedCount] = useState(0);
  const [lastUploadedTaskTitle, setLastUploadedTaskTitle] = useState<string | null>(null);
  const [lastUploadedPreviews, setLastUploadedPreviews] = useState<UploadedPreview[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const revokePreviewUrls = useCallback(() => {
    for (const url of previewUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    previewUrlsRef.current = [];
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetchTasksForEmployee(user.id).then((t) => {
      setTasks(t);
      if (presetTaskId && t.some((task) => task.id === presetTaskId)) {
        setTaskId(presetTaskId);
      } else if (t[0]) {
        setTaskId(t[0].id);
      }
    });
  }, [user, presetTaskId]);

  useEffect(() => {
    return () => {
      revokePreviewUrls();
    };
  }, [revokePreviewUrls]);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = window.setTimeout(() => setToastVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, [toastVisible, uploadStatus, lastUploadedCount]);

  const selectedTask = tasks.find((t) => t.id === taskId);
  const isUploading = uploadStatus === 'uploading';

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !user || !taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setUploadStatus('uploading');
    setErrorMessage(null);
    setToastVisible(false);
    revokePreviewUrls();

    const fileList = Array.from(files);
    const previews: UploadedPreview[] = [];

    try {
      for (const file of fileList) {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.push(previewUrl);

        const uploaded = await uploadFieldAttachment(
          file,
          user.id,
          task.projectId,
          taskId,
        );
        await addTaskAttachmentRecord({
          taskId,
          projectId: task.projectId,
          uploadedBy: user.id,
          fileName: uploaded.fileName,
          fileUrl: uploaded.publicUrl,
          fileType: file.type,
        });

        previews.push({
          fileName: uploaded.fileName,
          publicUrl: uploaded.publicUrl,
          previewUrl,
          uploadedAt: new Date().toISOString(),
        });
      }

      setLastUploadedCount(fileList.length);
      setLastUploadedTaskTitle(task.title);
      setLastUploadedPreviews(previews);
      setUploadStatus('success');
      setToastVisible(true);

      if (presetTaskId) {
        window.setTimeout(() => navigate(-1), 1200);
      }
    } catch (e) {
      revokePreviewUrls();
      setLastUploadedPreviews([]);
      setLastUploadedCount(0);
      setUploadStatus('error');
      setErrorMessage(e instanceof Error ? e.message : 'Photo upload failed');
      setToastVisible(true);
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toast =
    toastVisible && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="alert"
            aria-live="assertive"
            className="pointer-events-none fixed z-[9999] left-4 right-4"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4.25rem)' }}
          >
            {uploadStatus === 'success' ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-400/50 bg-emerald-600/95 p-4 text-white shadow-lg shadow-emerald-950/40">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold">Photo uploaded successfully</p>
                  {lastUploadedTaskTitle ? (
                    <p className="mt-0.5 text-sm text-emerald-50/95">
                      Photo uploaded to {lastUploadedTaskTitle}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : uploadStatus === 'error' ? (
              <div className="flex items-start gap-3 rounded-xl border border-red-400/50 bg-red-600/95 p-4 text-white shadow-lg shadow-red-950/40">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold">Photo upload failed</p>
                  <p className="mt-0.5 text-sm text-red-50/95">
                    {errorMessage ?? 'Check connection and try again.'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-4 pb-28">
      {toast}

      {presetTaskId && presetTaskTitle ? (
        <p className="text-sm text-slate-400">
          Uploading to: <span className="text-slate-200">{presetTaskTitle}</span>
        </p>
      ) : null}

      {uploadStatus === 'success' && lastUploadedCount > 0 ? (
        <div
          role="status"
          className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 p-4 text-emerald-100"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold text-emerald-50">Photo uploaded successfully</p>
              {lastUploadedTaskTitle ? (
                <p className="mt-1 text-sm text-emerald-100/90">
                  Attached to: {lastUploadedTaskTitle}
                </p>
              ) : null}
              <p className="mt-2 text-sm font-medium text-emerald-50">
                {formatUploadCount(lastUploadedCount)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {uploadStatus === 'error' ? (
        <div
          role="alert"
          className="w-full rounded-xl border border-red-400/40 bg-red-500/15 p-4 text-red-100"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold text-red-50">Photo upload failed</p>
              <p className="mt-1 text-sm text-red-100/90">
                {errorMessage ?? 'Check connection and try again.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isUploading ? (
        <div
          role="status"
          className="w-full rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-cyan-100"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" aria-hidden />
            <p className="font-medium text-cyan-50">Uploading photo…</p>
          </div>
        </div>
      ) : null}

      <Select
        label="Attach to task"
        value={taskId}
        onChange={setTaskId}
        disabled={isUploading}
        options={[
          { value: '', label: 'Select task' },
          ...tasks.map((t) => ({ value: t.id, label: t.title })),
        ]}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        disabled={isUploading || !taskId}
        onChange={(e) => void handleUpload(e.target.files)}
      />

      <button
        type="button"
        disabled={isUploading || !taskId}
        onClick={() => inputRef.current?.click()}
        className="flex w-full min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-cyan-500/50 bg-cyan-950/30 text-cyan-300 disabled:opacity-50"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
            <span className="font-semibold">Uploading photo…</span>
          </>
        ) : (
          <>
            <Camera className="h-10 w-10" aria-hidden />
            <span className="font-semibold">Tap to upload photo</span>
          </>
        )}
      </button>

      {uploadStatus === 'success' && lastUploadedCount > 0 ? (
        <p className="text-sm font-medium text-emerald-200">{formatUploadCount(lastUploadedCount)}</p>
      ) : null}

      {lastUploadedPreviews.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Latest upload
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {lastUploadedPreviews.map((preview) => (
              <li
                key={`${preview.publicUrl}-${preview.fileName}`}
                className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/60"
              >
                <img
                  src={preview.previewUrl}
                  alt={preview.fileName}
                  className="aspect-square w-full object-cover"
                />
                <div className="space-y-0.5 p-2">
                  <p className="truncate text-xs font-medium text-slate-200" title={preview.fileName}>
                    {preview.fileName}
                  </p>
                  <p className="text-[10px] text-slate-500">{formatUploadedAt(preview.uploadedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading || !taskId}
        fullWidth
      >
        Choose files
      </Button>

      {selectedTask && uploadStatus !== 'uploading' ? (
        <p className="text-xs text-slate-500">
          Photos attach to <span className="text-slate-400">{selectedTask.title}</span>
        </p>
      ) : null}
    </div>
  );
}
