import React, { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { RecurrenceEditScope } from '../../types/scheduleEvent';
import {
  RECURRENCE_EDIT_SCOPE_LABELS,
  RECURRENCE_EDIT_SCOPES,
} from '../../types/scheduleEvent';
import { SCHEDULE_BODY } from './scheduleTheme';

interface Props {
  isOpen: boolean;
  mode: 'edit' | 'delete';
  onClose: () => void;
  onConfirm: (scope: RecurrenceEditScope) => void;
}

export default function ScheduleRecurrenceEditScopeModal({
  isOpen,
  mode,
  onClose,
  onConfirm,
}: Props) {
  const [scope, setScope] = useState<RecurrenceEditScope>('this');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'delete' ? 'Delete recurring event' : 'Edit recurring event'}
      size="sm"
      stackAboveDrawer
    >
      <p className={`mb-4 text-sm ${SCHEDULE_BODY}`}>
        {mode === 'delete'
          ? 'This event is part of a series. What would you like to delete?'
          : 'This event is part of a series. What would you like to change?'}
      </p>
      <div className="space-y-2">
        {RECURRENCE_EDIT_SCOPES.map((s) => (
          <label
            key={s}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#E5E7EB] px-3 py-2.5 dark:border-slate-600"
          >
            <input
              type="radio"
              name="recurrence-scope"
              checked={scope === s}
              onChange={() => setScope(s)}
            />
            <span className="text-sm font-medium text-[#1F2937] dark:text-slate-100">
              {RECURRENCE_EDIT_SCOPE_LABELS[s]}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          variant={mode === 'delete' ? 'danger' : 'primary'}
          onClick={() => onConfirm(scope)}
        >
          {mode === 'delete' ? 'Delete' : 'Continue'}
        </Button>
      </div>
    </Modal>
  );
}
