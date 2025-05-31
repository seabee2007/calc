import React from 'react';
import { useProjects } from './useProjects';
import QCRecords from '../../components/projects/QCRecords';

export default function QCSection() {
  const { currentProject, handlers } = useProjects();
  
  if (!currentProject) return null;

  return (
    <div className="mt-8">
      <QCRecords
        projectId={currentProject.id}
        records={currentProject.qcRecords || []}
        onSave={handlers.saveQCRecord}
        onDelete={handlers.deleteQCRecord}
      />
    </div>
  );
}