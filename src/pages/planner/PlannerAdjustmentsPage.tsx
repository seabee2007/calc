import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePlannerProject } from '../../contexts/PlannerProjectContext';
import type { FieldAdjustmentRequest } from '../../types/fieldPlanner';
import { fetchAdjustmentsForProject } from '../../services/fieldAdjustmentService';
import { listProjectFarBuilderDocuments } from '../../services/projectDocumentService';
import type { ProjectDocumentRow } from '../../services/projectDocumentService';
import { buildProfileNameMap } from '../../services/profileService';
import FarsDocumentsPanel from '../../components/planner/documents/panels/FarsDocumentsPanel';
import { PLANNER_PAGE_BG, PLANNER_SECTION_TITLE } from '../../components/planner/plannerTheme';

export default function PlannerAdjustmentsPage() {
  const { user } = useAuth();
  const { projectId, isOwner, reload } = usePlannerProject();
  const [items, setItems] = useState<FieldAdjustmentRequest[]>([]);
  const [builderFarDrafts, setBuilderFarDrafts] = useState<ProjectDocumentRow[]>([]);
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    const [list, farDrafts] = await Promise.all([
      fetchAdjustmentsForProject(projectId),
      listProjectFarBuilderDocuments(projectId),
    ]);
    setItems(list);
    setBuilderFarDrafts(farDrafts);
    const ids = [...new Set(list.map((a) => a.submittedBy))];
    setNameMap(await buildProfileNameMap(ids));
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={`${PLANNER_PAGE_BG} flex-1 overflow-y-auto p-4 sm:p-6`}>
      <h2 className={`mb-4 ${PLANNER_SECTION_TITLE}`}>FARs</h2>
      <FarsDocumentsPanel
        projectId={projectId}
        items={items}
        builderFarDrafts={builderFarDrafts}
        nameMap={nameMap}
        userId={user?.id}
        isOwner={isOwner}
        onReload={() => void load()}
        onProjectReload={() => void reload()}
      />
    </div>
  );
}
