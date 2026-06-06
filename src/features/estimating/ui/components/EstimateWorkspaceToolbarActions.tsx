import { ChevronsDownUp, Download, FileSpreadsheet, RotateCcw, Save, Upload } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  ESTIMATE_WORKSPACE_TOOLBAR_MARKER,
  type EstimateBuilderToolbarHandlers,
} from '../estimateWorkspaceToolbar';

interface Props {
  showCollapseAll: boolean;
  showReset: boolean;
  showSaveBucket: boolean;
  showSaveQuick: boolean;
  showImportExport: boolean;
  canEdit: boolean;
  canSave: boolean;
  canSaveQuick: boolean;
  saving: boolean;
  handlers: EstimateBuilderToolbarHandlers | null;
  onReset: () => void;
  onSave: () => void;
  onImportEstimate: () => void;
  onExportEstimate: () => void;
  onDownloadImportTemplate: () => void;
}

export default function EstimateWorkspaceToolbarActions({
  showCollapseAll,
  showReset,
  showSaveBucket,
  showSaveQuick,
  showImportExport,
  canEdit,
  canSave,
  canSaveQuick,
  saving,
  handlers,
  onReset,
  onSave,
  onImportEstimate,
  onExportEstimate,
  onDownloadImportTemplate,
}: Props) {
  const hasActions =
    showCollapseAll || showReset || showSaveBucket || showSaveQuick || showImportExport;
  if (!hasActions) return null;

  return (
    <div
      data-testid={ESTIMATE_WORKSPACE_TOOLBAR_MARKER}
      className="flex flex-wrap items-center gap-2 px-2 pb-2 sm:px-0 sm:pb-0"
    >
      {showCollapseAll ? (
        <Button
          variant="outline"
          size="sm"
          icon={<ChevronsDownUp className="h-4 w-4" />}
          onClick={() => handlers?.collapseAll()}
        >
          Collapse all
        </Button>
      ) : null}
      {showReset ? (
        <Button
          variant="outline"
          size="sm"
          icon={<RotateCcw className="h-4 w-4" />}
          disabled={!canEdit}
          className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
          onClick={onReset}
        >
          Reset form
        </Button>
      ) : null}
      {showSaveQuick ? (
        <Button
          variant="accent"
          size="sm"
          icon={<Save className="h-4 w-4" />}
          disabled={!canEdit || !canSaveQuick}
          isLoading={saving}
          onClick={() => handlers?.saveQuick()}
        >
          {saving ? 'Saving...' : 'Save quick estimate'}
        </Button>
      ) : null}
      {showSaveBucket ? (
        <Button
          variant="accent"
          size="sm"
          icon={<Save className="h-4 w-4" />}
          disabled={!canSave || saving}
          isLoading={saving}
          title={
            canSave
              ? 'Save the current project estimate'
              : 'Add activities or selected divisions to enable save'
          }
          onClick={onSave}
        >
          {saving ? 'Saving...' : 'Save estimate'}
        </Button>
      ) : null}
      {showImportExport ? (
        <>
          <Button
            variant="outline"
            size="sm"
            icon={<Upload className="h-4 w-4" />}
            disabled={!canEdit || saving}
            onClick={onImportEstimate}
          >
            Import estimate
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            disabled={saving}
            onClick={onExportEstimate}
          >
            Export estimate
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            disabled={saving}
            onClick={onDownloadImportTemplate}
          >
            Download import template
          </Button>
        </>
      ) : null}
    </div>
  );
}
