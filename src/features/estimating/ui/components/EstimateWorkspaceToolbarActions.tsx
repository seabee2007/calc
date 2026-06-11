import { ChevronsDownUp, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  ADD_DIVISION_TOOLBAR_LABEL,
  ESTIMATE_WORKSPACE_TOOLBAR_MARKER,
  buildEstimateWorkspaceActionsMenuItems,
  type EstimateBuilderToolbarHandlers,
} from '../estimateWorkspaceToolbar';
import type { EstimateWorkspaceSaveStatusValue } from '../estimateWorkspaceSaveStatus';
import EstimateWorkspaceActionsMenu from './EstimateWorkspaceActionsMenu';
import EstimateWorkspaceSaveStatusControl from './EstimateWorkspaceSaveStatusControl';

interface Props {
  showAddDivision: boolean;
  showCollapseAll: boolean;
  showReset: boolean;
  showSaveBucket: boolean;
  showSaveQuick: boolean;
  showImportExport: boolean;
  showConvertToDetailed?: boolean;
  canEdit: boolean;
  canSaveQuick: boolean;
  saving: boolean;
  saveStatus: EstimateWorkspaceSaveStatusValue;
  saveStatusActiveOperations: number;
  hasPendingEstimateChanges: boolean;
  saveStatusErrorMessage?: string | null;
  handlers: EstimateBuilderToolbarHandlers | null;
  onReset: () => void;
  onSave: () => void;
  onRetrySave: () => void;
  onImportEstimate: () => void;
  onExportEstimate: () => void;
  onDownloadImportTemplate: () => void;
  onOpenHelp: () => void;
  onConvertToDetailed?: () => void;
}

const COMPACT_ICON_BUTTON_CLASS = 'h-10 w-10 px-0';

export default function EstimateWorkspaceToolbarActions({
  showAddDivision,
  showCollapseAll,
  showReset,
  showSaveBucket,
  showSaveQuick,
  showImportExport,
  showConvertToDetailed = false,
  canEdit,
  canSaveQuick,
  saving,
  saveStatus,
  saveStatusActiveOperations,
  hasPendingEstimateChanges,
  saveStatusErrorMessage,
  handlers,
  onReset,
  onSave,
  onRetrySave,
  onImportEstimate,
  onExportEstimate,
  onDownloadImportTemplate,
  onOpenHelp,
  onConvertToDetailed,
}: Props) {
  const desktopMenuItems = buildEstimateWorkspaceActionsMenuItems({
    showCollapseAll,
    showReset,
    showSaveBucket,
    showImportExport,
    showConvertToDetailed,
    includeMobileOverflow: false,
  });
  const mobileMenuItems = buildEstimateWorkspaceActionsMenuItems({
    showCollapseAll,
    showReset,
    showSaveBucket,
    showImportExport,
    showConvertToDetailed,
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
          disabled={!canEdit || saving}
          className="h-10 px-4"
          aria-label={ADD_DIVISION_TOOLBAR_LABEL}
          title={ADD_DIVISION_TOOLBAR_LABEL}
          onClick={() => handlers?.openAddDivision()}
        >
          + DIV
        </Button>
      ) : null}
      {showCollapseAll ? (
        <Button
          variant="outline"
          size="sm"
          className={`hidden sm:inline-flex ${COMPACT_ICON_BUTTON_CLASS}`}
          aria-label="Collapse all divisions"
          title="Collapse all"
          onClick={() => handlers?.collapseAll()}
        >
          <ChevronsDownUp className="h-4 w-4" aria-hidden />
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
        <EstimateWorkspaceSaveStatusControl
          show
          status={saveStatus}
          activeOperations={saveStatusActiveOperations}
          hasPendingEstimateChanges={hasPendingEstimateChanges}
          errorMessage={saveStatusErrorMessage}
          onSave={onSave}
          onRetry={onRetrySave}
        />
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
            onConvertToDetailed={onConvertToDetailed}
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
            onConvertToDetailed={onConvertToDetailed}
          />
        </div>
      ) : null}
    </div>
  );
}
