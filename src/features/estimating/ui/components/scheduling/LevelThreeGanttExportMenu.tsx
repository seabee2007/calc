import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import Button from '../../../../../components/ui/Button';

const MENU_WIDTH_PX = 180;

interface Props {
  exportReady: boolean;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  buttonClassName?: string;
}

export default function LevelThreeGanttExportMenu({
  exportReady,
  onExportPdf,
  onExportExcel,
  buttonClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const updateMenuPosition = () => {
    const anchor = wrapRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    let left = rect.right - MENU_WIDTH_PX;
    left = Math.max(margin, Math.min(left, window.innerWidth - MENU_WIDTH_PX - margin));
    let top = rect.bottom + margin;
    const menuHeight = menuRef.current?.offsetHeight ?? 88;
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
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      data-testid="level-three-gantt-export-menu"
      style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH_PX }}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        role="menuitem"
        type="button"
        disabled={!exportReady}
        data-testid="level-three-gantt-export-pdf"
        className="flex w-full px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => {
          if (!exportReady) return;
          setOpen(false);
          onExportPdf?.();
        }}
      >
        Export PDF
      </button>
      <button
        role="menuitem"
        type="button"
        disabled={!exportReady}
        data-testid="level-three-gantt-export-excel"
        className="flex w-full px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
        onClick={() => {
          if (!exportReady) return;
          setOpen(false);
          onExportExcel?.();
        }}
      >
        Export Excel
      </button>
    </div>
  ) : null;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!exportReady}
        title={!exportReady ? 'Run CPM before exporting.' : undefined}
        data-testid="level-three-gantt-export-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={
          buttonClassName ??
          'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }
        onClick={() => setOpen((current) => !current)}
      >
        <span>Export</span>
        <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
      </Button>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}
