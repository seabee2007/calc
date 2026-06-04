import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import { listSafetyMeetingsForProject } from '../../services/safetyMeetingService';
import { listConcreteInspectionsForProject } from '../../services/concreteInspectionService';
import { listProjectDocuments } from '../../services/projectDocumentService';
import { filterDocumentsTabBuilderDocuments } from '../../services/projectDocumentDisplay';
import type { SafetyMeeting } from '../../types/fieldTools';
import type { ConcreteInspectionChecklist } from '../../types/fieldTools';
import PlannerDocumentsTabBar from '../../components/planner/documents/PlannerDocumentsTabBar';
import {
  DOCUMENTS_TAB_IDS,
  documentsTabFromHighlightParams,
  documentsTabLabel,
  parseDocumentsTab,
  type DocumentsTabId,
} from '../../components/planner/documents/documentsTabConfig';
import ContractsDocumentsPanel from '../../components/planner/documents/panels/ContractsDocumentsPanel';
import SubmittalsDocumentsPanel from '../../components/planner/documents/panels/SubmittalsDocumentsPanel';
import DailyReportsDocumentsPanel from '../../components/planner/documents/panels/DailyReportsDocumentsPanel';
import QcReportsDocumentsPanel from '../../components/planner/documents/panels/QcReportsDocumentsPanel';
import SafetyMeetingsDocumentsPanel from '../../components/planner/documents/panels/SafetyMeetingsDocumentsPanel';
import PunchListsDocumentsPanel from '../../components/planner/documents/panels/PunchListsDocumentsPanel';
import CloseoutDocumentsPanel from '../../components/planner/documents/panels/CloseoutDocumentsPanel';
import { PLANNER_PAGE_BG } from '../../components/planner/plannerTheme';

export default function PlannerDocumentsPage() {
  const { user } = useAuth();
  const { projectId, project } = usePlannerProject();
  const [searchParams, setSearchParams] = useSearchParams();

  const highlightSafety = searchParams.get('safety');
  const highlightInspection = searchParams.get('inspection');
  const highlightContract = searchParams.get('contract');

  const activeTab = parseDocumentsTab(searchParams.get('tab'));

  const [safetyMeetings, setSafetyMeetings] = useState<SafetyMeeting[]>([]);
  const [inspections, setInspections] = useState<ConcreteInspectionChecklist[]>([]);
  const [builderDocs, setBuilderDocs] = useState<Awaited<ReturnType<typeof listProjectDocuments>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id || !projectId) return;
    setLoading(true);
    try {
      const [meetings, checklists, contractRows] = await Promise.all([
        listSafetyMeetingsForProject(projectId, user.id),
        listConcreteInspectionsForProject(projectId, user.id),
        listProjectDocuments(projectId),
      ]);
      setSafetyMeetings(meetings);
      setInspections(checklists);
      setBuilderDocs(contractRows);
    } finally {
      setLoading(false);
    }
  }, [projectId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('tab')) return;
    const tabFromHighlight = documentsTabFromHighlightParams({
      contract: highlightContract,
      safety: highlightSafety,
      inspection: highlightInspection,
    });
    if (!tabFromHighlight) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabFromHighlight);
    setSearchParams(next, { replace: true });
  }, [highlightContract, highlightSafety, highlightInspection, searchParams, setSearchParams]);

  const grouped = useMemo(
    () => filterDocumentsTabBuilderDocuments(builderDocs),
    [builderDocs],
  );

  const tabCounts: Record<DocumentsTabId, number> = useMemo(
    () => ({
      contracts: grouped.contracts.length,
      submittals: grouped.submittals.length,
      'daily-reports': grouped.dailyReports.length,
      'qc-reports': grouped.qcReports.length + inspections.length,
      'safety-meetings': safetyMeetings.length,
      'punch-lists': grouped.punchLists.length,
      closeout: grouped.closeout.length + grouped.other.length,
    }),
    [grouped, inspections.length, safetyMeetings.length],
  );

  const tabs = useMemo(
    () =>
      DOCUMENTS_TAB_IDS.map((id) => ({
        id,
        label: documentsTabLabel(id, tabCounts[id]),
      })),
    [tabCounts],
  );

  const setActiveTab = useCallback(
    (tabId: DocumentsTabId) => {
      const next = new URLSearchParams(searchParams);
      next.set('tab', tabId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'contracts':
        return (
          <ContractsDocumentsPanel
            projectId={projectId}
            contracts={grouped.contracts}
            highlightContractId={highlightContract}
            onReload={() => void load()}
          />
        );
      case 'submittals':
        return (
          <SubmittalsDocumentsPanel
            projectId={projectId}
            docs={grouped.submittals}
            onReload={() => void load()}
          />
        );
      case 'daily-reports':
        return (
          <DailyReportsDocumentsPanel
            projectId={projectId}
            docs={grouped.dailyReports}
            onReload={() => void load()}
          />
        );
      case 'qc-reports':
        return (
          <QcReportsDocumentsPanel
            projectId={projectId}
            qcReportDocs={grouped.qcReports}
            inspections={inspections}
            highlightInspectionId={highlightInspection}
            onReload={() => void load()}
          />
        );
      case 'safety-meetings':
        return (
          <SafetyMeetingsDocumentsPanel
            projectId={projectId}
            meetings={safetyMeetings}
            highlightSafetyId={highlightSafety}
          />
        );
      case 'punch-lists':
        return (
          <PunchListsDocumentsPanel
            projectId={projectId}
            docs={grouped.punchLists}
            onReload={() => void load()}
          />
        );
      case 'closeout':
        return (
          <CloseoutDocumentsPanel
            projectId={projectId}
            closeoutDocs={grouped.closeout}
            otherDocs={grouped.other}
            onReload={() => void load()}
          />
        );
      default:
        return (
          <ContractsDocumentsPanel
            projectId={projectId}
            contracts={grouped.contracts}
            highlightContractId={highlightContract}
            onReload={() => void load()}
          />
        );
    }
  };

  return (
    <div className={`${PLANNER_PAGE_BG} flex min-h-0 flex-1 flex-col`}>
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Documents — {project?.name ?? 'This project'}
        </h2>
      </div>

      <PlannerDocumentsTabBar tabs={tabs} activeTabId={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          </div>
        ) : (
          renderActivePanel()
        )}
      </div>
    </div>
  );
}
