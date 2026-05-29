import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const MENU_WIDTH_PX = 192;

function OverflowMenu({ items }: { items: OverflowItem[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const safeItems = useMemo(() => items.filter(Boolean), [items]);

  const updateMenuPosition = () => {
    const anchor = wrapRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    let left = rect.right - MENU_WIDTH_PX;
    left = Math.max(margin, Math.min(left, window.innerWidth - MENU_WIDTH_PX - margin));
    let top = rect.bottom + margin;
    const menuHeight = menuRef.current?.offsetHeight ?? safeItems.length * 40 + 16;
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - menuHeight - margin);
    }
    setMenuPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, safeItems.length]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  if (safeItems.length === 0) return null;

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH_PX }}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
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
  ) : null;

  return (
    <div className="relative" ref={wrapRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              requestAnimationFrame(() => updateMenuPosition());
            }
            return next;
          });
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </Button>
      {menu ? createPortal(menu, document.body) : null}
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
