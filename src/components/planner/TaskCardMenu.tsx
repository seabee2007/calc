import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { PlannerTask } from '../../types/fieldPlanner';
import { updateTask } from '../../services/plannerService';
import type { TaskStatus } from '../../types/fieldPlanner';

interface TaskCardMenuProps {
  task: PlannerTask;
  isOwner: boolean;
  buckets: { id: string; title: string }[];
  onOpen: () => void;
  onRefresh: () => void;
  onCreateRfi: () => void;
  onCreateAdjustment: () => void;
}

export default function TaskCardMenu({
  task,
  isOwner,
  buckets,
  onOpen,
  onRefresh,
  onCreateRfi,
  onCreateAdjustment,
}: TaskCardMenuProps) {
  const [open, setOpen] = useState(false);

  const markComplete = async () => {
    await updateTask(task.id, { status: 'Completed' as TaskStatus });
    onRefresh();
    setOpen(false);
  };

  const moveToBucket = async (bucketId: string) => {
    await updateTask(task.id, { bucketId });
    onRefresh();
    setOpen(false);
  };

  return (
    <div className="absolute right-1 top-1 z-10">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 [[data-menu-open=true]_&]:opacity-100"
        aria-label="Task menu"
        data-menu-open={open}
      >
        <MoreHorizontal className="h-4 w-4 text-gray-500" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20"
            aria-label="Close menu"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className="absolute right-0 top-full z-30 mt-0.5 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => {
                setOpen(false);
                onOpen();
              }}
            >
              Open
            </button>
            {task.status !== 'Completed' && (
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => void markComplete()}
              >
                Mark complete
              </button>
            )}
            {isOwner &&
              buckets
                .filter((b) => b.id !== task.bucketId)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    onClick={() => void moveToBucket(b.id)}
                  >
                    Move to {b.title}
                  </button>
                ))}
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => {
                setOpen(false);
                onCreateRfi();
              }}
            >
              Create RFI
            </button>
            <button
              type="button"
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
              onClick={() => {
                setOpen(false);
                onCreateAdjustment();
              }}
            >
              Create FAR
            </button>
          </div>
        </>
      )}
    </div>
  );
}
