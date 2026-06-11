import React, { useState } from 'react';
import ModalShell from '../ui/ModalShell';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { createFieldAdjustment } from '../../services/fieldAdjustmentService';
import { uploadAdjustmentAttachments } from '../../services/fieldRecordAttachmentService';
import { dispatchPlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import { FAR_REASONS, FAR_SCHEDULE_IMPACTS } from '../../types/fieldPlanner';
import FieldFilePicker from './FieldFilePicker';

interface CreateFieldAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId?: string | null;
  userId: string;
  onCreated?: () => void;
  stackAboveDrawer?: boolean;
}

export default function CreateFieldAdjustmentModal({
  isOpen,
  onClose,
  projectId,
  taskId,
  userId,
  onCreated,
  stackAboveDrawer = false,
}: CreateFieldAdjustmentModalProps) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState('');
  const [proposed, setProposed] = useState('');
  const [reason, setReason] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [potentialCostImpact, setPotentialCostImpact] = useState(false);
  const [potentialScheduleImpact, setPotentialScheduleImpact] = useState(false);
  const [impactSafety, setImpactSafety] = useState(false);
  const [impactQuality, setImpactQuality] = useState(false);
  const [scheduleImpact, setScheduleImpact] = useState('None');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle('');
    setLocation('');
    setCondition('');
    setProposed('');
    setReason('');
    setRecommendedAction('');
    setPotentialCostImpact(false);
    setPotentialScheduleImpact(false);
    setImpactSafety(false);
    setImpactQuality(false);
    setScheduleImpact('None');
    setFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !condition.trim()) return;
    setBusy(true);
    try {
      const adj = await createFieldAdjustment({
        projectId,
        taskId,
        submittedBy: userId,
        title: title.trim(),
        conditionDescription: condition.trim(),
        proposedAdjustment: proposed.trim() || undefined,
        reason: reason || undefined,
        location: location.trim() || undefined,
        scheduleImpact: potentialScheduleImpact ? scheduleImpact : undefined,
        potentialCostImpact,
        potentialScheduleImpact,
        recommendedAction: recommendedAction.trim() || undefined,
        requiresChangeOrder: potentialCostImpact,
        impactSafety,
        impactQuality,
      });
      if (files.length > 0) {
        await uploadAdjustmentAttachments(files, {
          userId,
          projectId,
          taskId,
          adjustmentId: adj.id,
        });
      }
      console.log('[FAR Create] created adjustment', adj);
      console.log('[FAR Create] updating existing field activity path');
      console.log('[FAR Create] updating existing review queue path');
      console.log('[FAR Create] updating existing task path');
      console.log('[FAR Create] refresh planner side panels');
      dispatchPlannerRecordsChanged({ kind: 'far', projectId, id: adj.id });
      reset();
      await onCreated?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const checkboxClass =
    'flex items-center gap-2 text-sm text-gray-800 dark:text-slate-200';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Field adjustment request"
      size="md"
      stackAboveDrawer={stackAboveDrawer}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11">
            Cancel
          </Button>
          <Button type="submit" form="create-far-form" variant="accent" disabled={busy} className="min-h-11">
            Submit request
          </Button>
        </>
      }
    >
      <form id="create-far-form" onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          fullWidth
          placeholder="Short summary"
        />
        <Input
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          fullWidth
          placeholder="Where on site"
        />
        <Select
          label="Reason"
          value={reason}
          onChange={(v) => setReason(v)}
          options={[
            { value: '', label: 'Select reason…' },
            ...FAR_REASONS.map((r) => ({ value: r, label: r })),
          ]}
        />
        <div>
          <label className="mb-1 block text-sm font-medium">Condition found</label>
          <textarea
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            rows={3}
            required
            placeholder="What was found in the field?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Recommended adjustment</label>
          <textarea
            value={proposed}
            onChange={(e) => setProposed(e.target.value)}
            rows={2}
            placeholder="What change do you recommend?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <FieldFilePicker files={files} onChange={setFiles} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Impacts</legend>
          <label className={checkboxClass}>
            <input
              type="checkbox"
              checked={potentialCostImpact}
              onChange={(e) => setPotentialCostImpact(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Potential cost impact?
          </label>
          <label className={checkboxClass}>
            <input
              type="checkbox"
              checked={potentialScheduleImpact}
              onChange={(e) => setPotentialScheduleImpact(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Potential schedule impact?
          </label>
          <label className={checkboxClass}>
            <input
              type="checkbox"
              checked={impactSafety}
              onChange={(e) => setImpactSafety(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Safety concern
          </label>
          <label className={checkboxClass}>
            <input
              type="checkbox"
              checked={impactQuality}
              onChange={(e) => setImpactQuality(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Quality concern
          </label>
        </fieldset>
        {potentialScheduleImpact && (
          <Select
            label="Schedule impact"
            value={scheduleImpact}
            onChange={(v) => setScheduleImpact(v)}
            options={FAR_SCHEDULE_IMPACTS.map((s) => ({ value: s, label: s }))}
          />
        )}
        <Input
          label="Recommended action (optional)"
          value={recommendedAction}
          onChange={(e) => setRecommendedAction(e.target.value)}
          fullWidth
          placeholder="Next step for the owner"
        />
      </form>
    </ModalShell>
  );
}
