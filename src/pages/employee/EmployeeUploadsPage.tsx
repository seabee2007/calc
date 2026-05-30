import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchTasksForEmployee } from '../../services/plannerService';
import { addTaskAttachmentRecord } from '../../services/taskActivityService';
import { uploadFieldAttachment } from '../../services/storageService';
import type { PlannerTask } from '../../types/fieldPlanner';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { Camera } from 'lucide-react';

export default function EmployeeUploadsPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [taskId, setTaskId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    void fetchTasksForEmployee(user.id).then((t) => {
      setTasks(t);
      if (t[0]) setTaskId(t[0].id);
    });
  }, [user]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || !user || !taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setBusy(true);
    setMessage(null);
    try {
      for (const file of Array.from(files)) {
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
      }
      setMessage(`Uploaded ${files.length} file(s)`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Upload photos</h1>

      <Select
        label="Attach to task"
        value={taskId}
        onChange={setTaskId}
        options={[
          { value: '', label: 'Select task' },
          ...tasks.map((t) => ({ value: t.id, label: t.title })),
        ]}
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleUpload(e.target.files)}
      />

      <button
        type="button"
        disabled={busy || !taskId}
        onClick={() => inputRef.current?.click()}
        className="flex w-full min-h-[120px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-cyan-500/50 bg-cyan-950/30 text-cyan-300 disabled:opacity-50"
      >
        <Camera className="h-10 w-10" />
        <span className="font-semibold">Tap to upload photo</span>
      </button>

      {message && <p className="text-sm text-cyan-300">{message}</p>}

      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy || !taskId}>
        Choose files
      </Button>
    </div>
  );
}
