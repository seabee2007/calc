import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProjectStore, useSettingsStore } from '../../store';
import { formatUSAddress, hasProjectJobsite } from '../../types/address';
import type { ConcreteInspectionChecklist } from '../../types/fieldTools';
import {
  fetchConcreteInspection,
  upsertConcreteInspection,
} from '../../services/concreteInspectionService';
import { exportConcreteInspectionPdf } from '../../utils/concreteInspectionPdf';
import FieldToolPageLayout from '../../components/tools/FieldToolPageLayout';
import ToolSectionCard from '../../components/tools/ToolSectionCard';
import InspectionChecklistSection from '../../components/tools/InspectionChecklistSection';
import FieldToolStickyActions from '../../components/tools/FieldToolStickyActions';
import SignatureBlock from '../../components/change-order/SignatureBlock';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import { FIELD_TOOL_MUTED } from '../../components/tools/fieldToolTheme';
import { emptyConcreteInspection } from './inspectionDefaults';

const ACI_NOTE =
  'This checklist is general field guidance based on common concrete quality practices and references ACI 301 and ACI 318 concepts. Always follow the project specifications, approved drawings, local code, and engineer of record requirements.';

export default function ConcreteInspectionChecklistPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { companySettings } = useSettingsStore();
  const [checklist, setChecklist] = useState<ConcreteInspectionChecklist>(emptyConcreteInspection);
  const [inspectorName, setInspectorName] = useState('');
  const [contractorName, setContractorName] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const recordId = searchParams.get('id');

  useEffect(() => {
    if (!recordId) return;
    void fetchConcreteInspection(recordId).then((row) => {
      if (!row) return;
      setChecklist(row);
      setInspectorName(row.inspector);
      setContractorName(row.contractor);
      if (row.projectId) setCurrentProject(row.projectId);
    });
  }, [recordId]);

  const applyProjectPrefill = useCallback((projectId: string | null) => {
    if (!projectId) {
      setChecklist((c) => ({ ...c, projectId: null }));
      return;
    }
    const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
    if (!project) return;
    setChecklist((c) => ({
      ...c,
      projectId,
      projectName: project.name,
      projectAddress: hasProjectJobsite(project.jobsiteAddress)
        ? formatUSAddress(project.jobsiteAddress)
        : c.projectAddress,
    }));
  }, []);

  useEffect(() => {
    if (currentProject?.id) applyProjectPrefill(currentProject.id);
  }, [currentProject?.id, applyProjectPrefill]);

  const patch = (patch: Partial<ConcreteInspectionChecklist>) =>
    setChecklist((c) => ({ ...c, ...patch }));

  const companyHeader = {
    companyName: companySettings.companyName || '',
    address: companySettings.address || '',
    phone: companySettings.phone || '',
    email: companySettings.email || '',
  };

  const handleSave = async () => {
    if (!user?.id) {
      setToast({ title: 'Sign in required', message: 'Log in to save checklists.', type: 'error' });
      return;
    }
    const projectId = currentProject?.id ?? checklist.projectId ?? null;
    if (!projectId) {
      setToast({
        title: 'Select a project',
        message: 'Choose a project so this checklist appears in Planner → Documents.',
        type: 'error',
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertConcreteInspection(
        {
          ...checklist,
          inspector: inspectorName || checklist.inspector,
          contractor: contractorName || checklist.contractor,
          projectId,
        },
        user.id,
      );
      setChecklist(saved);
      if (saved.id) {
        const next = new URLSearchParams();
        next.set('id', saved.id);
        next.set('project', projectId);
        setSearchParams(next, { replace: true });
      }
      const projectName = currentProject?.name ?? checklist.projectName;
      setToast({
        title: 'Saved',
        message: `Checklist saved to Planner documents for ${projectName}.`,
        type: 'success',
      });
    } catch (e) {
      console.error(e);
      setToast({ title: 'Save failed', message: 'Could not save. Try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await exportConcreteInspectionPdf(
        {
          ...checklist,
          inspector: inspectorName || checklist.inspector,
          contractor: contractorName || checklist.contractor,
        },
        companyHeader,
      );
    } catch (e) {
      console.error(e);
      setToast({ title: 'Export failed', message: 'Could not generate PDF.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    if (!window.confirm('Clear all fields on this form?')) return;
    setChecklist(emptyConcreteInspection());
    setInspectorName('');
    setContractorName('');
    setSearchParams({}, { replace: true });
    if (currentProject?.id) applyProjectPrefill(currentProject.id);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <FieldToolPageLayout
        title="Concrete Inspection Checklist"
        subtitle="Pre-Placement, Placing, Post Placement"
        icon={ClipboardList}
        onProjectPrefill={applyProjectPrefill}
        actions={
          <FieldToolStickyActions
            onSave={() => void handleSave()}
            onPrint={() => window.print()}
            onExportPdf={() => void handleExportPdf()}
            onClear={handleClear}
            saving={saving}
            exporting={exporting}
            saveLabel="Save Checklist"
          />
        }
      >
        <ToolSectionCard eyebrow="Section 1" title="Project information">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Project name"
              value={checklist.projectName}
              onChange={(e) => patch({ projectName: e.target.value })}
              fullWidth
            />
            <Input
              label="Date"
              type="date"
              value={checklist.inspectionDate}
              onChange={(e) => patch({ inspectionDate: e.target.value })}
              fullWidth
            />
            <div className="sm:col-span-2">
              <Input
                label="Project address"
                value={checklist.projectAddress}
                onChange={(e) => patch({ projectAddress: e.target.value })}
                fullWidth
              />
            </div>
            <Input
              label="Inspector"
              value={checklist.inspector}
              onChange={(e) => {
                setInspectorName(e.target.value);
                patch({ inspector: e.target.value });
              }}
              fullWidth
            />
            <Input
              label="Contractor"
              value={checklist.contractor}
              onChange={(e) => {
                setContractorName(e.target.value);
                patch({ contractor: e.target.value });
              }}
              fullWidth
            />
            <Input
              label="Mix design / PSI"
              value={checklist.mixDesign}
              onChange={(e) => patch({ mixDesign: e.target.value })}
              fullWidth
            />
            <Input
              label="Placement type"
              value={checklist.placementType}
              onChange={(e) => patch({ placementType: e.target.value })}
              fullWidth
            />
            <Input
              label="Pour area"
              value={checklist.pourArea}
              onChange={(e) => patch({ pourArea: e.target.value })}
              fullWidth
            />
            <Input
              label="Estimated cubic yards"
              type="number"
              min={0}
              step="0.1"
              value={checklist.estimatedYards}
              onChange={(e) => patch({ estimatedYards: e.target.value })}
              fullWidth
            />
          </div>
        </ToolSectionCard>

        <ToolSectionCard eyebrow="Section 2" title="Pre-pour checklist">
          <InspectionChecklistSection
            items={checklist.prePourItems}
            onChange={(prePourItems) => patch({ prePourItems })}
          />
        </ToolSectionCard>

        <ToolSectionCard eyebrow="Section 3" title="During placement checklist">
          <InspectionChecklistSection
            items={checklist.duringPlacementItems}
            onChange={(duringPlacementItems) => patch({ duringPlacementItems })}
          />
        </ToolSectionCard>

        <ToolSectionCard eyebrow="Section 4" title="Post-placement checklist">
          <InspectionChecklistSection
            items={checklist.postPlacementItems}
            onChange={(postPlacementItems) => patch({ postPlacementItems })}
          />
        </ToolSectionCard>

        <div className="rounded-xl border border-amber-500/30 bg-amber-50/40 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            ACI reference note
          </p>
          <p className={`mt-2 text-sm ${FIELD_TOOL_MUTED}`}>{ACI_NOTE}</p>
        </div>

        <ToolSectionCard eyebrow="Section 5" title="General notes">
          <Input
            label="Notes"
            value={checklist.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            fullWidth
          />
        </ToolSectionCard>

        <ToolSectionCard eyebrow="Section 6" title="Signatures">
          <div className="grid gap-6 lg:grid-cols-2">
            <SignatureBlock
              title="Inspector"
              name={inspectorName}
              signature={checklist.inspectorSignature}
              onNameChange={(v) => {
                setInspectorName(v);
                patch({ inspector: v });
              }}
              onSignatureChange={(v) => patch({ inspectorSignature: v })}
            />
            <SignatureBlock
              title="Contractor"
              name={contractorName}
              signature={checklist.contractorSignature}
              onNameChange={(v) => {
                setContractorName(v);
                patch({ contractor: v });
              }}
              onSignatureChange={(v) => patch({ contractorSignature: v })}
            />
          </div>
        </ToolSectionCard>
      </FieldToolPageLayout>

      {toast && (
        <Toast
          id="inspection-toast"
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </motion.div>
  );
}
