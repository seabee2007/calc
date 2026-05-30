import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface BucketColumnMenuProps {
  bucketTitle: string;
  taskCount: number;
  canDelete: boolean;
  onRename: () => void;
  onDelete: () => void;
}

export default function BucketColumnMenu({
  bucketTitle,
  taskCount,
  canDelete,
  onRename,
  onDelete,
}: BucketColumnMenuProps) {
  const [open, setOpen] = useState(false);

  const handleDelete = () => {
    setOpen(false);
    const taskWarning =
      taskCount > 0
        ? ` All ${taskCount} task${taskCount === 1 ? '' : 's'} in this column will be permanently deleted.`
        : '';
    const confirmed = window.confirm(
      `Delete bucket "${bucketTitle}"?${taskWarning} This cannot be undone.`,
    );
    if (confirmed) onDelete();
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded p-1 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        aria-label={`Bucket options for ${bucketTitle}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20"
            aria-label="Close bucket menu"
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
                onRename();
              }}
            >
              Rename
            </button>
            <button
              type="button"
              disabled={!canDelete}
              title={
                canDelete
                  ? undefined
                  : 'At least one bucket is required on the board'
              }
              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/40 dark:disabled:text-red-400/50"
              onClick={() => {
                if (!canDelete) return;
                handleDelete();
              }}
            >
              Delete bucket
            </button>
          </div>
        </>
      )}
    </div>
  );
}
