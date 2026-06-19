import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import Button from '../../../../../components/ui/Button';
import type { GanttExportMode } from '../../../export/ganttExcelExport';

const MENU_WIDTH_PX = 230;

interface Props {
  exportReady: boolean;
  hasLeveling?: boolean;
  onExportPdf?: (mode: GanttExportMode) => void;
  onExportExcel?: (mode: GanttExportMode) => void;
  buttonClassName?: string;
}

interface MenuItem {
  label: string;
  sublabel?: string;
  mode: GanttExportMode;
  format: 'pdf' | 'excel';
}

export default function LevelThreeGanttExportMenu({
  exportReady,
  hasLeveling = false,
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
    const menuHeight = menuRef.current?.offsetHeight ?? 120;
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

  const handleItem = (item: MenuItem) => {
    if (!exportReady) return;
    setOpen(false);
    if (item.format === 'pdf') onExportPdf?.(item.mode);
    else onExportExcel?.(item.mode);
  };

  // When leveling is active, offer two variants per format.
  // When not leveled, the single export is implicitly "CPM baseline = leveled" (same thing).
  const items: MenuItem[] = hasLeveling
    ? [
        { label: 'Export PDF', sublabel: 'Resource Leveled', mode: 'leveled', format: 'pdf' },
        { label: 'Export PDF', sublabel: 'CPM Baseline', mode: 'baseline', format: 'pdf' },
        { label: 'Export Excel', sublabel: 'Resource Leveled', mode: 'leveled', format: 'excel' },
        { label: 'Export Excel', sublabel: 'CPM Baseline', mode: 'baseline', format: 'excel' },
      ]
    : [
        { label: 'Export PDF', mode: 'leveled', format: 'pdf' },
        { label: 'Export Excel', mode: 'leveled', format: 'excel' },
      ];

  // Group items by format when leveling is active so we can insert a divider
  const pdfItems = items.filter((item) => item.format === 'pdf');
  const excelItems = items.filter((item) => item.format === 'excel');

  const renderItem = (item: MenuItem, key: string) => (
    <button
      key={key}
      role="menuitem"
      type="button"
      disabled={!exportReady}
      data-testid={`level-three-gantt-export-${item.format}${item.sublabel ? `-${item.mode}` : ''}`}
      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
      onClick={() => handleItem(item)}
    >
      <span>{item.label}</span>
      {item.sublabel ? (
        <span
          className={
            item.mode === 'leveled'
              ? 'ml-2 rounded px-1.5 py-0.5 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-400/50 dark:text-cyan-400'
              : 'ml-2 rounded px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-400/50 dark:text-amber-400'
          }
        >
          {item.sublabel}
        </span>
      ) : null}
    </button>
  );

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      data-testid="level-three-gantt-export-menu"
      style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH_PX }}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      {pdfItems.map((item, i) => renderItem(item, `pdf-${i}`))}
      {hasLeveling ? (
        <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
      ) : null}
      {excelItems.map((item, i) => renderItem(item, `excel-${i}`))}
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
