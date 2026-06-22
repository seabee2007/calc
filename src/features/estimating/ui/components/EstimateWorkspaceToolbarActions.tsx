import { ChevronsDownUp, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import {
  ADD_DIVISION_TOOLBAR_LABEL,
  ESTIMATE_WORKSPACE_TOOLBAR_MARKER,
  SAVE_QUICK_ESTIMATE_TOOLBAR_LABEL,
  buildEstimateWorkspaceActionsMenuItems,
  type EstimateBuilderToolbarHandlers,
} from '../estimateWorkspaceToolbar';
import type { EstimateWorkspaceSaveStatusValue } from '../estimateWorkspaceSaveStatus';
import { useEstimateWorkspaceHeaderCollapse } from '../EstimateWorkspaceHeaderCollapseContext';
import EstimateWorkspaceActionsMenu from './EstimateWorkspaceActionsMenu';
import EstimateWorkspaceSaveStatusControl from './EstimateWorkspaceSaveStatusControl';
import EstimateWorkspaceFocusModeButton from './EstimateWorkspaceFocusModeButton';
import EstimateGuidedHelpBadge from './EstimateGuidedHelpBadge';

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
  saveBlockedReason?: string | null;
  handlers: EstimateBuilderToolbarHandlers | null;
  onReset: () => void;
  onSave: () => void;
  onRetrySave: () => void;
  onImportEstimate: () => void;
  onExportEstimate: () => void;
  onDownloadImportTemplate: () => void;
  onOpenSettings?: () => void;
  onOpenHelp: () => void;
  onConvertToDetailed?: () => void;
  onActionsMenuOpenChange?: (open: boolean) => void;
  showGuidedHelpBadge?: boolean;
  onOpenGuidedHelp?: () => void;
  onDismissGuidedHelp?: () => void;
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
  saveBlockedReason,
  handlers,
  onReset,
  onSave,
  onRetrySave,
  onImportEstimate,
  onExportEstimate,
  onDownloadImportTemplate,
  onOpenSettings,
  onOpenHelp,
  onConvertToDetailed,
  onActionsMenuOpenChange,
  showGuidedHelpBadge = false,
  onOpenGuidedHelp,
  onDismissGuidedHelp,
}: Props) {
  const headerCollapse = useEstimateWorkspaceHeaderCollapse();
  const showHeaderFocus = Boolean(headerCollapse?.enabled && !headerCollapse.isMobile);

  const desktopMenuItems = buildEstimateWorkspaceActionsMenuItems({
    showCollapseAll,
    showReset,
    showSaveBucket,
    showImportExport,
    showConvertToDetailed,
    showSaveQuick,
    includeMobileOverflow: false,
  });
  const mobileMenuItems = buildEstimateWorkspaceActionsMenuItems({
    showCollapseAll,
    showReset,
    showSaveBucket,
    showImportExport,
    showConvertToDetailed,
    showSaveQuick,
    includeMobileOverflow: true,
  });
  const showDesktopActionsDropdown = desktopMenuItems.length > 0;
  const showMobileActionsDropdown = mobileMenuItems.length > 0;

  const hasActions =
    showHeaderFocus ||
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
          variant="outline"
          size="sm"
          icon={<Save className="h-4 w-4" />}
          disabled={!canEdit || !canSaveQuick}
          isLoading={saving}
          data-testid="estimate-workspace-save-quick-button"
          onClick={() => handlers?.saveQuick()}
        >
          {saving ? 'Saving...' : SAVE_QUICK_ESTIMATE_TOOLBAR_LABEL}
        </Button>
      ) : null}
      {showSaveBucket ? (
        <EstimateWorkspaceSaveStatusControl
          show
          status={saveStatus}
          activeOperations={saveStatusActiveOperations}
          hasPendingEstimateChanges={hasPendingEstimateChanges}
          errorMessage={saveStatusErrorMessage}
          saveBlockedReason={saveBlockedReason}
          onSave={onSave}
          onRetry={onRetrySave}
        />
      ) : null}
      <EstimateWorkspaceFocusModeButton />
      {showDesktopActionsDropdown ? (
        <div className="relative hidden sm:block">
          {showGuidedHelpBadge && onOpenGuidedHelp && onDismissGuidedHelp ? (
            <EstimateGuidedHelpBadge
              onOpenGuide={onOpenGuidedHelp}
              onDismiss={onDismissGuidedHelp}
            />
          ) : null}
          <EstimateWorkspaceActionsMenu
            items={desktopMenuItems}
            disabled={saving}
            resetDisabled={!canEdit}
            onImportEstimate={onImportEstimate}
            onExportEstimate={onExportEstimate}
            onDownloadTemplate={onDownloadImportTemplate}
            onOpenSettings={onOpenSettings}
            onOpenHelp={onOpenHelp}
            onCollapseAll={() => handlers?.collapseAll()}
            onResetForm={onReset}
            onConvertToDetailed={onConvertToDetailed}
            onSaveQuick={() => handlers?.saveQuick()}
            onActionsMenuOpenChange={onActionsMenuOpenChange}
          />
        </div>
      ) : null}
      {showMobileActionsDropdown ? (
        <div className="relative flex w-full flex-col items-end gap-2 sm:hidden">
          {showGuidedHelpBadge && onOpenGuidedHelp && onDismissGuidedHelp ? (
            <EstimateGuidedHelpBadge
              onOpenGuide={onOpenGuidedHelp}
              onDismiss={onDismissGuidedHelp}
            />
          ) : null}
          <EstimateWorkspaceActionsMenu
            items={mobileMenuItems}
            disabled={saving}
            resetDisabled={!canEdit}
            onImportEstimate={onImportEstimate}
            onExportEstimate={onExportEstimate}
            onDownloadTemplate={onDownloadImportTemplate}
            onOpenSettings={onOpenSettings}
            onOpenHelp={onOpenHelp}
            onCollapseAll={() => handlers?.collapseAll()}
            onResetForm={onReset}
            onConvertToDetailed={onConvertToDetailed}
            onSaveQuick={() => handlers?.saveQuick()}
            onActionsMenuOpenChange={onActionsMenuOpenChange}
          />
        </div>
      ) : null}
    </div>
  );
}
