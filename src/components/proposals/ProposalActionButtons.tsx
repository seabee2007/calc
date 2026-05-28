import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import Button from '../ui/Button';

type OverflowItem = {
  key: string;
  label: string;
  variant?: 'danger' | 'outline' | 'ghost' | 'secondary' | 'primary';
  onClick: () => void;
};

function OverflowMenu({
  items,
}: {
  items: OverflowItem[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const safeItems = useMemo(() => items.filter(Boolean), [items]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  if (safeItems.length === 0) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {safeItems.map((item) => (
            <button
              key={item.key}
              role="menuitem"
              type="button"
              className={[
                'w-full px-3 py-2 text-left text-sm transition-colors',
                item.variant === 'danger'
                  ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20'
                  : 'text-slate-800 hover:bg-slate-50 dark:text-gray-200 dark:hover:bg-gray-800',
              ].join(' ')}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ProposalActionButtons({
  onOpen,
  onSend,
  onDuplicate,
  onPdf,
  onShareLink,
  overflowItems,
}: {
  onOpen: () => void;
  onSend: () => void;
  onDuplicate: () => void;
  onPdf: () => void;
  onShareLink: () => void;
  overflowItems?: OverflowItem[];
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
        <Button variant="secondary" size="sm" onClick={onOpen} className="justify-center">
          Open
        </Button>
        <Button variant="outline" size="sm" onClick={onSend} className="justify-center">
          Send
        </Button>
        <Button variant="outline" size="sm" onClick={onDuplicate} className="justify-center">
          Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={onPdf} className="justify-center">
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={onShareLink} className="justify-center sm:w-auto">
          Share Link
        </Button>
      </div>
      <div className="flex justify-end">
        <OverflowMenu items={overflowItems ?? []} />
      </div>
    </div>
  );
}

