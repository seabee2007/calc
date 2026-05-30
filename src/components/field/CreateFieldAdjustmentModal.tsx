import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { createFieldAdjustment } from '../../services/fieldAdjustmentService';
import { uploadAdjustmentAttachments } from '../../services/fieldRecordAttachmentService';
import { FAR_REASONS, FAR_SCHEDULE_IMPACTS } from '../../types/fieldPlanner';
import FieldFilePicker from './FieldFilePicker';
import { PLANNER_BTN_PRIMARY } from '../planner/plannerTheme';

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
  const [labor, setLabor] = useState('');
  const [material, setMaterial] = useState('');
  const [equipment, setEquipment] = useState('');
  const [scheduleImpact, setScheduleImpact] = useState('None');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const estimatedCost = useMemo(() => {
    const l = labor ? Number(labor) : 0;
    const m = material ? Number(material) : 0;
    const e = equipment ? Number(equipment) : 0;
    const sum = l + m + e;
    return sum > 0 ? sum : undefined;
  }, [labor, material, equipment]);

  const reset = () => {
    setTitle('');
    setLocation('');
    setCondition('');
    setProposed('');
    setReason('');
    setLabor('');
    setMaterial('');
    setEquipment('');
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
        laborImpact: labor ? Number(labor) : undefined,
        materialImpact: material ? Number(material) : undefined,
        equipmentCost: equipment ? Number(equipment) : undefined,
        scheduleImpact: scheduleImpact || undefined,
        estimatedCost,
      });
      if (files.length > 0) {
        await uploadAdjustmentAttachments(files, {
          userId,
          projectId,
          taskId,
          adjustmentId: adj.id,
        });
      }
      reset();
      onCreated?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Field adjustment request"
      size="md"
      stackAboveDrawer={stackAboveDrawer}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
          <label className="mb-1 block text-sm font-medium">Condition description</label>
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
          <label className="mb-1 block text-sm font-medium">Proposed adjustment</label>
          <textarea
            value={proposed}
            onChange={(e) => setProposed(e.target.value)}
            rows={2}
            placeholder="What change do you recommend?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <FieldFilePicker files={files} onChange={setFiles} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Labor ($)"
            type="number"
            min={0}
            value={labor}
            onChange={(e) => setLabor(e.target.value)}
          />
          <Input
            label="Material ($)"
            type="number"
            min={0}
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
          />
          <Input
            label="Equipment ($)"
            type="number"
            min={0}
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          />
        </div>
        <Select
          label="Schedule impact"
          value={scheduleImpact}
          onChange={(v) => setScheduleImpact(v)}
          options={FAR_SCHEDULE_IMPACTS.map((s) => ({ value: s, label: s }))}
        />
        {estimatedCost != null && (
          <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
            Estimated cost impact: ${estimatedCost.toLocaleString()}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11">
            Cancel
          </Button>
          <Button type="submit" disabled={busy} className={`min-h-11 ${PLANNER_BTN_PRIMARY}`}>
            Submit request
          </Button>
        </div>
      </form>
    </Modal>
  );
}
