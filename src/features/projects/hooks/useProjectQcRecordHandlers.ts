import { useCallback, useEffect, useMemo } from 'react';
import { useProjectStore } from '../../../store';
import type { QCRecord } from '../../../types';

export function useProjectQcRecordHandlers(projectId: string) {
  const projects = useProjectStore((state) => state.projects);
  const loadProjects = useProjectStore((state) => state.loadProjects);
  const addQCRecord = useProjectStore((state) => state.addQCRecord);
  const updateQCRecord = useProjectStore((state) => state.updateQCRecord);
  const deleteQCRecord = useProjectStore((state) => state.deleteQCRecord);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const records = useMemo(() => {
    const project = projects.find((entry) => entry.id === projectId);
    return project?.qcRecords ?? [];
  }, [projectId, projects]);

  const saveQCRecord = useCallback(
    async (
      record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>,
      recordId?: string,
    ) => {
      if (recordId) {
        await updateQCRecord(projectId, recordId, record);
        return;
      }
      await addQCRecord(projectId, record);
    },
    [addQCRecord, projectId, updateQCRecord],
  );

  const removeQCRecord = useCallback(
    async (recordId: string) => {
      await deleteQCRecord(projectId, recordId);
    },
    [deleteQCRecord, projectId],
  );

  return {
    records,
    saveQCRecord,
    deleteQCRecord: removeQCRecord,
  };
}
