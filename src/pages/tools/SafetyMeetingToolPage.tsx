import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProjectStore, useSettingsStore } from '../../store';
import { formatUSAddress, hasProjectJobsite } from '../../types/address';
import type { SafetyMeeting } from '../../types/fieldTools';
import { fetchSafetyMeeting, upsertSafetyMeeting } from '../../services/safetyMeetingService';
import { exportSafetyMeetingPdf } from '../../utils/safetyMeetingPdf';
import FieldToolPageLayout from '../../components/tools/FieldToolPageLayout';
import ToolSectionCard from '../../components/tools/ToolSectionCard';
import JhaRowsEditor from '../../components/tools/JhaRowsEditor';
import ToolboxTalkSection from '../../components/tools/ToolboxTalkSection';
import AttendanceRowsEditor from '../../components/tools/AttendanceRowsEditor';
import FieldToolStickyActions from '../../components/tools/FieldToolStickyActions';
import Input from '../../components/ui/Input';
import Toast from '../../components/ui/Toast';
import { emptySafetyMeeting } from './safetyMeetingDefaults';

export default function SafetyMeetingToolPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProject, setCurrentProject } = useProjectStore();
  const { companySettings } = useSettingsStore();
  const [meeting, setMeeting] = useState<SafetyMeeting>(emptySafetyMeeting);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(
    null,
  );

  const recordId = searchParams.get('id');

  useEffect(() => {
    if (!recordId) return;
    void fetchSafetyMeeting(recordId).then((row) => {
      if (!row) return;
      setMeeting(row);
      if (row.projectId) setCurrentProject(row.projectId);
    });
  }, [recordId]);

  const applyProjectPrefill = useCallback(
    (projectId: string | null) => {
      if (!projectId) {
        setMeeting((m) => ({ ...m, projectId: null }));
        return;
      }
      const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
      if (!project) return;
      setMeeting((m) => ({
        ...m,
        projectId,
        projectName: project.name,
        projectAddress: hasProjectJobsite(project.jobsiteAddress)
          ? formatUSAddress(project.jobsiteAddress)
          : m.projectAddress,
        companyName: m.companyName || companySettings.companyName || '',
      }));
    },
    [companySettings.companyName],
  );

  useEffect(() => {
    if (currentProject?.id) applyProjectPrefill(currentProject.id);
  }, [currentProject?.id, applyProjectPrefill]);

  const patch = (patch: Partial<SafetyMeeting>) => setMeeting((m) => ({ ...m, ...patch }));

  const companyHeader = {
    companyName: companySettings.companyName || meeting.companyName,
    address: companySettings.address || '',
    phone: companySettings.phone || '',
    email: companySettings.email || '',
  };

  const handleSave = async () => {
    if (!user?.id) {
      setToast({ title: 'Sign in required', message: 'Log in to save safety meetings.', type: 'error' });
      return;
    }
    const projectId = currentProject?.id ?? meeting.projectId ?? null;
    if (!projectId) {
      setToast({
        title: 'Select a project',
        message: 'Choose a project so this safety meeting appears in Planner → Documents.',
        type: 'error',
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertSafetyMeeting({ ...meeting, projectId }, user.id);
      setMeeting(saved);
      if (saved.id) {
        const next = new URLSearchParams();
        next.set('id', saved.id);
        next.set('project', projectId);
        setSearchParams(next, { replace: true });
      }
      const projectName = currentProject?.name ?? meeting.projectName;
      setToast({
        title: 'Saved',
        message: `Safety meeting saved to Planner documents for ${projectName}.`,
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
      await exportSafetyMeetingPdf(meeting, companyHeader);
    } catch (e) {
      console.error(e);
      setToast({ title: 'Export failed', message: 'Could not generate PDF.', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleClear = () => {
    if (!window.confirm('Clear all fields on this form?')) return;
    setMeeting(emptySafetyMeeting());
    setSearchParams({}, { replace: true });
    if (currentProject?.id) applyProjectPrefill(currentProject.id);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <FieldToolPageLayout
        title="Safety Meeting Tool"
        subtitle="Daily JHA, toolbox talks, and attendance sheet"
        icon={ShieldCheck}
        onProjectPrefill={applyProjectPrefill}
        actions={
          <FieldToolStickyActions
            onSave={() => void handleSave()}
            onPrint={() => window.print()}
            onExportPdf={() => void handleExportPdf()}
            onClear={handleClear}
            saving={saving}
            exporting={exporting}
            saveLabel="Save Safety Meeting"
          />
        }
      >
        <ToolSectionCard eyebrow="Section 1" title="Project information">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Project name"
              value={meeting.projectName}
              onChange={(e) => patch({ projectName: e.target.value })}
              fullWidth
            />
            <Input
              label="Date"
              type="date"
              value={meeting.meetingDate}
              onChange={(e) => patch({ meetingDate: e.target.value })}
              fullWidth
            />
            <div className="sm:col-span-2">
              <Input
                label="Project address"
                value={meeting.projectAddress}
                onChange={(e) => patch({ projectAddress: e.target.value })}
                fullWidth
              />
            </div>
            <Input
              label="Foreman / supervisor"
              value={meeting.supervisor}
              onChange={(e) => patch({ supervisor: e.target.value })}
              fullWidth
            />
            <Input
              label="Company name"
              value={meeting.companyName}
              onChange={(e) => patch({ companyName: e.target.value })}
              fullWidth
            />
            <Input
              label="Weather conditions"
              value={meeting.weather}
              onChange={(e) => patch({ weather: e.target.value })}
              fullWidth
            />
            <div className="sm:col-span-2">
              <Input
                label="Work activity for the day"
                value={meeting.workActivity}
                onChange={(e) => patch({ workActivity: e.target.value })}
                fullWidth
              />
            </div>
          </div>
        </ToolSectionCard>

        <ToolSectionCard eyebrow="Section 2" title="Job Hazard Analysis">
          <JhaRowsEditor rows={meeting.jhaRows} onChange={(jhaRows) => patch({ jhaRows })} />
        </ToolSectionCard>

        <ToolSectionCard eyebrow="Section 3" title="Toolbox talk">
          <ToolboxTalkSection
            topicKey={meeting.toolboxTopic}
            content={meeting.toolboxContent}
            onTopicChange={(toolboxTopic, toolboxContent) => patch({ toolboxTopic, toolboxContent })}
          />
        </ToolSectionCard>

        <ToolSectionCard eyebrow="Section 4" title="Attendance sheet">
          <AttendanceRowsEditor
            rows={meeting.attendees}
            onChange={(attendees) => patch({ attendees })}
          />
        </ToolSectionCard>
      </FieldToolPageLayout>

      {toast && (
        <Toast
          id="safety-meeting-toast"
          title={toast.title}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </motion.div>
  );
}
