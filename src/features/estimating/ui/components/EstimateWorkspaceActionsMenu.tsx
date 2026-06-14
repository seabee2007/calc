import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronsDownUp,
  Download,
  FileSpreadsheet,
  HelpCircle,
  RotateCcw,
  Save,
  Upload,
  ArrowRightLeft,
} from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  ESTIMATE_WORKSPACE_ACTIONS_DROPDOWN_LABEL,
  runEstimateWorkspaceMenuAction,
  type EstimateWorkspaceActionsMenuItem,
  type EstimateWorkspaceActionsMenuItemKey,
} from '../estimateWorkspaceToolbar';

const MENU_WIDTH_PX = 220;

interface Props {
  items: EstimateWorkspaceActionsMenuItem[];
  disabled?: boolean;
  resetDisabled?: boolean;
  onImportEstimate: () => void;
  onExportEstimate: () => void;
  onDownloadTemplate: () => void;
  onOpenHelp?: () => void;
  onCollapseAll?: () => void;
  onResetForm?: () => void;
  onConvertToDetailed?: () => void;
  onSaveQuick?: () => void;
  onActionsMenuOpenChange?: (open: boolean) => void;
}

function menuIcon(key: EstimateWorkspaceActionsMenuItemKey) {
  switch (key) {
    case 'import-estimate':
      return <Upload className="h-4 w-4 shrink-0" aria-hidden />;
    case 'export-estimate':
      return <Download className="h-4 w-4 shrink-0" aria-hidden />;
    case 'download-template':
      return <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />;
    case 'help-definitions':
      return <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />;
    case 'collapse-all':
      return <ChevronsDownUp className="h-4 w-4 shrink-0" aria-hidden />;
    case 'reset-form':
      return <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />;
    case 'convert-to-detailed':
      return <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden />;
    case 'save-quick-estimate':
      return <Save className="h-4 w-4 shrink-0" aria-hidden />;
    default:
      return null;
  }
}

export default function EstimateWorkspaceActionsMenu({
  items,
  disabled = false,
  resetDisabled = false,
  onImportEstimate,
  onExportEstimate,
  onDownloadTemplate,
  onOpenHelp,
  onCollapseAll,
  onResetForm,
  onConvertToDetailed,
  onSaveQuick,
  onActionsMenuOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const handlers = {
    onImportEstimate,
    onExportEstimate,
    onDownloadTemplate,
    onOpenHelp,
    onCollapseAll,
    onResetForm,
    onConvertToDetailed,
    onSaveQuick,
  };

  const updateMenuPosition = () => {
    const anchor = wrapRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    let left = rect.right - MENU_WIDTH_PX;
    left = Math.max(margin, Math.min(left, window.innerWidth - MENU_WIDTH_PX - margin));
    let top = rect.bottom + margin;
    const menuHeight = menuRef.current?.offsetHeight ?? items.length * 40 + 16;
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
  }, [open, items.length]);

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

  useEffect(() => {
    onActionsMenuOpenChange?.(open);
  }, [open, onActionsMenuOpenChange]);

  if (items.length === 0) return null;

  const menu = open ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      data-testid="estimate-workspace-actions-menu"
      style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH_PX }}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
    >
      {items.map((item) => {
        const itemDisabled =
          disabled || (item.key === 'reset-form' && resetDisabled);
        return (
          <div key={item.key}>
            {item.showDividerBefore ? (
              <div
                role="separator"
                className="my-1 border-t border-slate-200 dark:border-slate-700"
              />
            ) : null}
            <button
              role="menuitem"
              type="button"
              disabled={itemDisabled}
              data-testid={`estimate-workspace-actions-item-${item.key}`}
              className={[
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                item.mobileOnly ? 'sm:hidden' : '',
                item.destructive
                  ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'
                  : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800',
              ].join(' ')}
              onClick={() => {
                if (itemDisabled) return;
                setOpen(false);
                runEstimateWorkspaceMenuAction(item.key, handlers);
              }}
            >
              {menuIcon(item.key)}
              <span>{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        data-testid="estimate-workspace-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{ESTIMATE_WORKSPACE_ACTIONS_DROPDOWN_LABEL}</span>
        <ChevronDown className="ml-1 h-4 w-4" aria-hidden />
      </Button>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : menu}
    </div>
  );
}
