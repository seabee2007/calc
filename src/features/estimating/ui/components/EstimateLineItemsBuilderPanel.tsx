import { useMemo } from 'react';
import { AlertTriangle, Plus, Save } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import DrawerPanel from '../../../../components/ui/DrawerPanel';
import { PLANNER_DRAWER_FOOTER } from '../../../../components/planner/plannerTheme';
import type { EstimateDomainVersion, EstimateSummary } from '../../infrastructure/estimateDbTypes';
import { buildEstimateDraftSnapshot } from '../../application/buildEstimateDraftSnapshot';
import type { UseEstimateLineItemDraftResult } from '../hooks/useEstimateLineItemDraft';
import EstimateDraftLineRow from './EstimateDraftLineRow';
import EstimateManualLineItemForm from './EstimateManualLineItemForm';
import EstimateLineItemPreviewCard from './EstimateLineItemPreviewCard';
import EstimateReadOnlyLineItemsTable from './EstimateReadOnlyLineItemsTable';
import EstimateSummaryCard from './EstimateSummaryCard';
import {
  formatEstimateCurrency,
  formatEstimateHours,
} from '../estimateFormatters';
import {
  PLANNER_FORM_PANEL,
  PLANNER_MUTED,
  PLANNER_SECTION_TITLE,
  TEXT_BODY,
} from '../estimateWorkspaceTheme';

interface Props {
  estimate: EstimateSummary;
  version: EstimateDomainVersion;
  canEdit: boolean;
  draft: UseEstimateLineItemDraftResult;
}

export default function EstimateLineItemsBuilderPanel({
  estimate,
  version,
  canEdit,
  draft,
}: Props) {

  const draftSnapshot = useMemo(() => {
    if (draft.draftLines.length === 0) return null;
    return buildEstimateDraftSnapshot({
      estimateId: estimate.id,
      projectId: estimate.projectId,
      versionNumber: version.versionNumber,
      estimateType: version.estimateType,
      status: version.status,
      draftLines: draft.draftLines,
      pricing: version.snapshot.pricing,
    });
  }, [draft.draftLines, estimate.id, estimate.projectId, version]);

  const draftSummary = useMemo(() => {
    if (!draftSnapshot) {
      return {
        laborHours: '—',
        directCost: '—',
        sellPrice: '—',
      };
    }

    let laborHours = 0;
    for (const line of draftSnapshot.lineItems) {
      laborHours += line.metrics.adjustedLaborHours;
    }

    return {
      laborHours: laborHours > 0 ? formatEstimateHours(laborHours) : '—',
      directCost: formatEstimateCurrency(draftSnapshot.totals.directCost),
      sellPrice: formatEstimateCurrency(draftSnapshot.totals.finalSellPrice),
    };
  }, [draftSnapshot]);

  const drawerTitle = draft.editingClientId ? 'Edit line item' : 'Add line item';

  return (
    <div className="space-y-4">
      {draft.dirty ? (
        <div
          className={`flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 ${TEXT_BODY}`}
          role="status"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Unsaved changes — draft line items have not been saved to a new estimate version yet.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={PLANNER_SECTION_TITLE}>Draft line items</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            disabled={!canEdit}
            onClick={draft.openAddDrawer}
          >
            Add line item
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Save className="h-4 w-4" />}
            disabled
            title="Save will be added in the next phase"
          >
            Save coming next phase
          </Button>
        </div>
      </div>

      {draft.draftLines.length === 0 ? (
        <div className={`${PLANNER_FORM_PANEL} text-sm ${PLANNER_MUTED}`}>
          No draft line items yet. Add a line item to build your estimate locally.
        </div>
      ) : (
        <div className="space-y-2">
          {draft.draftLines.map((line) => (
            <EstimateDraftLineRow
              key={line.clientId}
              draft={line}
              onEdit={() => draft.openEditDrawer(line.clientId)}
              onRemove={() => draft.removeDraftLine(line.clientId)}
            />
          ))}
        </div>
      )}

      {draft.draftLines.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <EstimateSummaryCard label="Draft labor hours" value={draftSummary.laborHours} />
          <EstimateSummaryCard label="Draft direct cost" value={draftSummary.directCost} />
          <EstimateSummaryCard label="Draft sell price" value={draftSummary.sellPrice} />
        </div>
      ) : null}

      <div className="space-y-2 pt-2">
        <h3 className={PLANNER_SECTION_TITLE}>Current saved version</h3>
        <p className={`text-sm ${PLANNER_MUTED}`}>
          Read-only snapshot from version {version.versionNumber}. Draft edits above do not change
          saved data until a future save phase.
        </p>
        <EstimateReadOnlyLineItemsTable
          lineItems={version.lineItems}
          caption="Saved line items"
        />
      </div>

      <DrawerPanel
        isOpen={draft.drawerOpen}
        onClose={draft.closeDrawer}
        title={drawerTitle}
        className="max-w-2xl"
      >
        {draft.formDraft ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <EstimateManualLineItemForm
                draft={draft.formDraft}
                onChange={draft.updateFormDraft}
              />
              <EstimateLineItemPreviewCard draft={draft.formDraft} />
            </div>
            <div className={PLANNER_DRAWER_FOOTER}>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={draft.closeDrawer}>
                  Cancel
                </Button>
                <Button type="button" variant="accent" onClick={draft.commitFormDraft}>
                  {draft.editingClientId ? 'Update draft line' : 'Add to draft'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </DrawerPanel>
    </div>
  );
}
