import { ChevronsDownUp, Plus, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  ADD_DIVISION_TOOLBAR_LABEL,
  ESTIMATE_WORKSPACE_TOOLBAR_MARKER,
  buildEstimateWorkspaceActionsMenuItems,
  type EstimateBuilderToolbarHandlers,
} from '../estimateWorkspaceToolbar';
import EstimateWorkspaceActionsMenu from './EstimateWorkspaceActionsMenu';

interface Props {
  showAddDivision: boolean;
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
  onOpenHelp: () => void;
}

export default function EstimateWorkspaceToolbarActions({
  showAddDivision,
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
  onOpenHelp,
}: Props) {
  const desktopMenuItems = buildEstimateWorkspaceActionsMenuItems({
    showCollapseAll,
    showReset,
    showSaveBucket,
    showImportExport,
    includeMobileOverflow: false,
  });
  const mobileMenuItems = buildEstimateWorkspaceActionsMenuItems({
    showCollapseAll,
    showReset,
    showSaveBucket,
    showImportExport,
    includeMobileOverflow: true,
  });
  const showDesktopActionsDropdown = desktopMenuItems.length > 0;
  const showMobileActionsDropdown = mobileMenuItems.length > 0;

  const hasActions =
    showAddDivision ||
    showCollapseAll ||
    showReset ||
    showSaveBucket ||
    showSaveQuick ||
    showDesktopActionsDropdown ||
    showMobileActionsDropdown;
  if (!hasActions) return null;

  return (
    <div
      data-testid={ESTIMATE_WORKSPACE_TOOLBAR_MARKER}
      className="flex flex-wrap items-center justify-end gap-2 px-2 pb-2 sm:px-0 sm:pb-0"
    >
      {showAddDivision ? (
        <Button
          variant="outline"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          disabled={!canEdit || saving}
          className="hidden sm:inline-flex"
          onClick={() => handlers?.openAddDivision()}
        >
          {ADD_DIVISION_TOOLBAR_LABEL}
        </Button>
      ) : null}
      {showAddDivision ? (
        <Button
          variant="outline"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          disabled={!canEdit || saving}
          className="sm:hidden"
          onClick={() => handlers?.openAddDivision()}
        >
          Add division
        </Button>
      ) : null}
      {showCollapseAll ? (
        <Button
          variant="outline"
          size="sm"
          icon={<ChevronsDownUp className="h-4 w-4" />}
          className="hidden sm:inline-flex"
          onClick={() => handlers?.collapseAll()}
        >
          Collapse all
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
        <>
          <Button
            variant="accent"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            disabled={!canSave || saving}
            isLoading={saving}
            className="hidden sm:inline-flex"
            title={
              canSave
                ? 'Save the current project estimate'
                : 'Add activities or selected divisions to enable save'
            }
            onClick={onSave}
          >
            {saving ? 'Saving...' : 'Save estimate'}
          </Button>
          <Button
            variant="accent"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            disabled={!canSave || saving}
            isLoading={saving}
            className="sm:hidden"
            title={
              canSave
                ? 'Save the current project estimate'
                : 'Add activities or selected divisions to enable save'
            }
            onClick={onSave}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      ) : null}
      {showDesktopActionsDropdown ? (
        <div className="hidden sm:block">
          <EstimateWorkspaceActionsMenu
            items={desktopMenuItems}
            disabled={saving}
            resetDisabled={!canEdit}
            onImportEstimate={onImportEstimate}
            onExportEstimate={onExportEstimate}
            onDownloadTemplate={onDownloadImportTemplate}
            onOpenHelp={onOpenHelp}
            onCollapseAll={() => handlers?.collapseAll()}
            onResetForm={onReset}
          />
        </div>
      ) : null}
      {showMobileActionsDropdown ? (
        <div className="sm:hidden">
          <EstimateWorkspaceActionsMenu
            items={mobileMenuItems}
            disabled={saving}
            resetDisabled={!canEdit}
            onImportEstimate={onImportEstimate}
            onExportEstimate={onExportEstimate}
            onDownloadTemplate={onDownloadImportTemplate}
            onOpenHelp={onOpenHelp}
            onCollapseAll={() => handlers?.collapseAll()}
            onResetForm={onReset}
          />
        </div>
      ) : null}
    </div>
  );
}
