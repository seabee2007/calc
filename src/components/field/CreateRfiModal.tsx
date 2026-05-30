import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { createRfi } from '../../services/rfiService';
import { uploadRfiAttachments } from '../../services/fieldRecordAttachmentService';
import { RFI_PRIORITIES } from '../../types/fieldPlanner';
import FieldFilePicker from './FieldFilePicker';
import { PLANNER_BTN_PRIMARY } from '../planner/plannerTheme';

interface CreateRfiModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId?: string | null;
  userId: string;
  onCreated?: () => void;
}

export default function CreateRfiModal({
  isOpen,
  onClose,
  projectId,
  taskId,
  userId,
  onCreated,
}: CreateRfiModalProps) {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [solution, setSolution] = useState('');
  const [location, setLocation] = useState('');
  const [drawingRef, setDrawingRef] = useState('');
  const [specRef, setSpecRef] = useState('');
  const [urgency, setUrgency] = useState('Normal');
  const [impactSchedule, setImpactSchedule] = useState(false);
  const [impactCost, setImpactCost] = useState(false);
  const [impactQuality, setImpactQuality] = useState(false);
  const [impactSafety, setImpactSafety] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle('');
    setQuestion('');
    setSolution('');
    setLocation('');
    setDrawingRef('');
    setSpecRef('');
    setUrgency('Normal');
    setImpactSchedule(false);
    setImpactCost(false);
    setImpactQuality(false);
    setImpactSafety(false);
    setFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !question.trim()) return;
    setBusy(true);
    try {
      const rfi = await createRfi({
        projectId,
        taskId,
        submittedBy: userId,
        title: title.trim(),
        question: question.trim(),
        suggestedSolution: solution.trim() || undefined,
        urgency,
        location: location.trim() || undefined,
        drawingReference: drawingRef.trim() || undefined,
        specReference: specRef.trim() || undefined,
        impactSchedule,
        impactCost,
        impactQuality,
        impactSafety,
      });
      if (files.length > 0) {
        await uploadRfiAttachments(files, {
          userId,
          projectId,
          taskId,
          rfiId: rfi.id,
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
    <Modal isOpen={isOpen} onClose={onClose} title="Create RFI" size="md">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Select
          label="Priority"
          value={urgency}
          onChange={(v) => setUrgency(v)}
          options={RFI_PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <Input
          label="Subject"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Brief subject"
        />
        <Input
          label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Grid, area, or station"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Drawing ref"
            value={drawingRef}
            onChange={(e) => setDrawingRef(e.target.value)}
          />
          <Input label="Spec ref" value={specRef} onChange={(e) => setSpecRef(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Question</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            required
            placeholder="What needs clarification?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Impact</legend>
          <div className="flex flex-wrap gap-3">
            {(
              [
                ['Schedule', impactSchedule, setImpactSchedule],
                ['Cost', impactCost, setImpactCost],
                ['Quality', impactQuality, setImpactQuality],
                ['Safety', impactSafety, setImpactSafety],
              ] as const
            ).map(([label, checked, setter]) => (
              <label key={label} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setter(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="mb-1 block text-sm font-medium">Suggested solution (optional)</label>
          <textarea
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>
        <FieldFilePicker files={files} onChange={setFiles} />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11">
            Cancel
          </Button>
          <Button type="submit" disabled={busy} className={`min-h-11 ${PLANNER_BTN_PRIMARY}`}>
            Submit RFI
          </Button>
        </div>
      </form>
    </Modal>
  );
}
