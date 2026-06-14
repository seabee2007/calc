import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import ProjectCalculatorShell from '../../components/calculators/ProjectCalculatorShell';
import ChangeOrderLineItemsEditor from '../../components/change-order/ChangeOrderLineItemsEditor';
import Button from '../../components/ui/Button';
import {
  getWorkflowProjectId,
  isWorkflowActive,
  workflowQuery,
  workflowNavigateState,
  type WorkflowLocationState,
} from '../../utils/workflow';
import { useProjectStore } from '../../store';
import type { ChangeOrderLineItem } from '../../types/changeOrder';
import { EMPTY_PROJECT_CUSTOM_ESTIMATES } from '../../types/projectEstimate';
import {
  CUSTOM_ESTIMATE_SOURCE,
  isGeneralTradeLaborLine,
  totalsFromCustomEstimateItems,
} from '../../utils/customEstimateUtils';
import { formatChangeOrderMoney } from '../../utils/changeOrderFinancials';
import { PLANNER_FORM_PANEL } from '../../components/planner/plannerTheme';

export default function CustomEstimatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const workflowState = location.state as WorkflowLocationState | null;
  const inWorkflow = isWorkflowActive(location.search, workflowState);
  const workflowProjectId = getWorkflowProjectId(location.search, workflowState);

  const { currentProject, projects, setCurrentProject, saveCustomEstimates } = useProjectStore();
  const [laborItems, setLaborItems] = useState<ChangeOrderLineItem[]>([]);
  const [materialItems, setMaterialItems] = useState<ChangeOrderLineItem[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<ChangeOrderLineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const hubProject = useMemo(() => {
    const id = workflowProjectId ?? currentProject?.id;
    if (!id) return currentProject;
    return projects.find((p) => p.id === id) ?? currentProject;
  }, [workflowProjectId, currentProject, projects]);

  useEffect(() => {
    const id = workflowProjectId ?? currentProject?.id;
    if (id) setCurrentProject(id);
  }, [workflowProjectId, currentProject?.id, setCurrentProject]);

  useEffect(() => {
    const e = hubProject?.customEstimates ?? EMPTY_PROJECT_CUSTOM_ESTIMATES;
    setLaborItems(e.laborItems.filter((item) => !isGeneralTradeLaborLine(item)));
    setMaterialItems(e.materialItems);
    setEquipmentItems(e.equipmentItems);
  }, [hubProject?.id, hubProject?.customEstimates, hubProject?.updatedAt]);

  const previewTotals = useMemo(
    () => totalsFromCustomEstimateItems({ laborItems, materialItems, equipmentItems }),
    [laborItems, materialItems, equipmentItems],
  );

  const handleSave = async () => {
    if (!hubProject) return;
    setSaving(true);
    setSavedFlash(false);
    try {
      const existing = hubProject.customEstimates ?? EMPTY_PROJECT_CUSTOM_ESTIMATES;
      const generalTradeLaborItems = existing.laborItems.filter(isGeneralTradeLaborLine);
      await saveCustomEstimates(hubProject.id, {
        laborItems: [
          ...generalTradeLaborItems,
          ...laborItems.map((item) => ({
            ...item,
            source: item.source ?? CUSTOM_ESTIMATE_SOURCE,
          })),
        ],
        materialItems: materialItems.map((item) => ({
          ...item,
          source: item.source ?? CUSTOM_ESTIMATE_SOURCE,
        })),
        equipmentItems: equipmentItems.map((item) => ({
          ...item,
          source: item.source ?? CUSTOM_ESTIMATE_SOURCE,
        })),
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save custom estimate.');
    } finally {
      setSaving(false);
    }
  };

  const backToHub = () => {
    navigate(
      {
        pathname: '/calculator',
        search: inWorkflow ? workflowQuery(hubProject?.id) : '',
      },
      { state: inWorkflow ? workflowNavigateState(hubProject?.id) : undefined },
    );
  };

  return (
    <ProjectCalculatorShell
      title="Custom estimate"
      description="Enter labor, material, and equipment line items manually. Saved totals import into your proposal like the other estimates."
      toolKind="legacy"
      footer={
        inWorkflow && hubProject ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />} onClick={backToHub}>
              Back to estimates
            </Button>
          </div>
        ) : undefined
      }
    >
      {!hubProject && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Select or create a project above before saving your estimate.
        </p>
      )}

      {hubProject && (
        <div className="space-y-6">
          <ChangeOrderLineItemsEditor
            label="Labor"
            category="labor"
            items={laborItems}
            onChange={setLaborItems}
          />
          <ChangeOrderLineItemsEditor
            label="Material"
            category="material"
            items={materialItems}
            onChange={setMaterialItems}
          />
          <ChangeOrderLineItemsEditor
            label="Equipment"
            category="equipment"
            items={equipmentItems}
            onChange={setEquipmentItems}
          />

          <div className={PLANNER_FORM_PANEL}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Estimate total
            </p>
            <div className="mt-2 space-y-1 text-sm text-gray-800 dark:text-slate-200">
              <div className="flex justify-between gap-4">
                <span>Labor</span>
                <span className="tabular-nums font-medium">
                  {formatChangeOrderMoney(previewTotals.labor)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Material</span>
                <span className="tabular-nums font-medium">
                  {formatChangeOrderMoney(previewTotals.material)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Equipment</span>
                <span className="tabular-nums font-medium">
                  {formatChangeOrderMoney(previewTotals.equipment)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-semibold dark:border-slate-600">
                <span>Total</span>
                <span className="tabular-nums">{formatChangeOrderMoney(previewTotals.total)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon={<Save className="h-4 w-4" />}
              onClick={() => void handleSave()}
              disabled={saving || !hubProject}
            >
              {saving ? 'Saving…' : 'Save estimate'}
            </Button>
            {savedFlash && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved to project
              </span>
            )}
          </div>
        </div>
      )}
    </ProjectCalculatorShell>
  );
}
