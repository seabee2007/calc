import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import type { RfiRequest } from '../../types/fieldPlanner';
import { fetchRfisForProject } from '../../services/rfiService';
import { listProjectRfiBuilderDocuments } from '../../services/projectDocumentService';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import { buildProfileNameMap } from '../../services/profileService';
import RfisDocumentsPanel from '../../components/planner/documents/panels/RfisDocumentsPanel';
import { PLANNER_PAGE_BG, PLANNER_SECTION_TITLE } from '../../components/planner/plannerTheme';

export default function PlannerRFIsPage() {
  const { user } = useAuth();
  const { projectId, isOwner, reload } = usePlannerProject();
  const [rfis, setRfis] = useState<RfiRequest[]>([]);
  const [builderRfiDrafts, setBuilderRfiDrafts] = useState<ProjectDocumentRow[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const [list, drafts] = await Promise.all([
      fetchRfisForProject(projectId),
      listProjectRfiBuilderDocuments(projectId),
    ]);
    setRfis(list);
    setBuilderRfiDrafts(drafts);
    const ids = [...new Set(list.map((r) => r.submittedBy))];
    setNameMap(await buildProfileNameMap(ids));
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <h2 className={`mb-4 ${PLANNER_SECTION_TITLE}`}>RFIs</h2>
      <RfisDocumentsPanel
        projectId={projectId}
        rfis={rfis}
        builderRfiDrafts={builderRfiDrafts}
        nameMap={nameMap}
        userId={user?.id}
        isOwner={isOwner}
        onReload={() => void load()}
        onProjectReload={() => void reload()}
      />
    </div>
  );
}
