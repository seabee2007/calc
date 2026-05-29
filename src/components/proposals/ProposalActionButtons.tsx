import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import Button from '../ui/Button';

type OverflowItem = {
  key: string;
  label: string;
  variant?: 'danger' | 'outline' | 'ghost' | 'secondary' | 'primary';
  onClick: () => void;
};

const MOBILE_PRIMARY =
  'h-12 w-full rounded-xl bg-slate-700 font-semibold text-white transition hover:bg-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600';
const MOBILE_OUTLINE =
  'h-12 w-full rounded-xl border border-slate-300 font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800';

function OverflowMenu({ items }: { items: OverflowItem[] }) {
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
          className="absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
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
  const hasOverflow = (overflowItems?.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      {/* Mobile: aligned 2×2 grid + full-width share */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <button type="button" className={MOBILE_PRIMARY} onClick={onOpen}>
          Open
        </button>
        <button type="button" className={MOBILE_OUTLINE} onClick={onSend}>
          Send
        </button>
        <button type="button" className={MOBILE_OUTLINE} onClick={onDuplicate}>
          Duplicate
        </button>
        <button type="button" className={MOBILE_OUTLINE} onClick={onPdf}>
          PDF
        </button>
        <button
          type="button"
          className={`col-span-2 ${MOBILE_OUTLINE}`}
          onClick={onShareLink}
        >
          Share Link
        </button>
      </div>

      {/* Desktop: compact row */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onOpen}>
            Open
          </Button>
          <Button variant="outline" size="sm" onClick={onSend}>
            Send
          </Button>
          <Button variant="outline" size="sm" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={onPdf}>
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onShareLink}>
            Share Link
          </Button>
        </div>
        {hasOverflow ? <OverflowMenu items={overflowItems ?? []} /> : null}
      </div>

      {hasOverflow ? (
        <div className="flex justify-end sm:hidden">
          <OverflowMenu items={overflowItems ?? []} />
        </div>
      ) : null}
    </div>
  );
}
