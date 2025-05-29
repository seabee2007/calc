import React from 'react';
import { FolderOpen, Calculator, Save, Printer, Edit, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useProjects } from './useProjects';
import { format } from 'date-fns';
import CalculationSection from './CalculationSection';
import MixDesignSection from './MixDesignSection';
import QCSection from './QCSection';
import StrengthProgress from '../../components/projects/StrengthProgress';

export default function ProjectDetails() {
  const { currentProject, ui, setUi, handlers } = useProjects();
  
  if (!currentProject) return null;

  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between mb-6">
        <div className="mt-4 sm:mt-0">
          <div className="flex items-center">
            <FolderOpen className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-semibold text-gray-900">{currentProject.name}</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Created: {format(new Date(currentProject.createdAt), 'MM/dd/yyyy')} • 
            Last updated: {format(new Date(currentProject.updatedAt), 'MM/dd/yyyy')}
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlers.saveWasteFactor}
            disabled={ui.isSaving}
            icon={<Save size={16} />}
          >
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlers.printPDF}
            icon={<Printer size={16} />}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUi(s => ({ ...s, editing: true }))}
            icon={<Edit size={16} />}
          />
          <Button
            variant="danger"
            size="sm"
            onClick={() => handlers.confirmDelete('project', currentProject.id)}
            icon={<Trash2 size={16} />}
          />
        </div>
      </div>
      
      <p className="text-gray-600 mb-6">
        {currentProject.description || 'No description provided'}
      </p>

      {currentProject.calculations.length > 0 && (
        <StrengthProgress
          project={currentProject}
          mixProfile={ui.mixProfile}
          onMixProfileChange={handlers.mixProfileChange}
          onPourDateChange={handlers.dateChange}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MixDesignSection />
        <CalculationSection />
      </div>

      <QCSection />
    </Card>
  );
}