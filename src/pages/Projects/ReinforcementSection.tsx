import React from 'react';
import { useProjects } from './useProjects';
import ReinforcementDetails from '../../components/projects/ReinforcementDetails';

export default function ReinforcementSection() {
  const { currentProject, handlers } = useProjects();
  
  if (!currentProject) return null;

  return (
    <div className="mt-8">
      <ReinforcementDetails
        reinforcements={currentProject.reinforcements || []}
        onDelete={handlers.deleteReinforcement}
      />
    </div>
  );
} 