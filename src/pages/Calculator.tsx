import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, Calculator, ArrowRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import CalculationForm from '../components/calculations/CalculationForm';
import ProjectForm from '../components/projects/ProjectForm';
import { useProjectStore } from '../store';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Toast from '../components/ui/Toast';
import slabDiagram from '../assets/images/slab.webp';
import thickSlabDiagram from '../assets/images/THICK SLAB.webp';

const CalculatorPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, currentProject, setCurrentProject, addCalculation, addProject } = useProjectStore();
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [calculationType, setCalculationType] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning'>('success');
  const [showWeatherPrompt, setShowWeatherPrompt] = useState(false);
  
  useEffect(() => {
    // Set current project from URL state if available
    const state = location.state as { projectId?: string; openWeatherModal?: boolean };
    if (state?.projectId) {
      setCurrentProject(state.projectId);
    }
    if (state?.openWeatherModal) {
      setShowWeatherPrompt(true);
    }
  }, [location.state, setCurrentProject]);
  
  const handleProjectChange = (projectId: string) => {
    setCurrentProject(projectId);
  };
  
  const handleCreateProject = (data: { name: string; description: string }) => {
    addProject(data);
    setShowCreateProjectModal(false);
  };
  
  const handleSaveCalculation = (calculation: any) => {
    if (currentProject) {
      addCalculation(currentProject.id, calculation);
      setToastMessage(`Calculation saved to project: ${currentProject.name}`);
      setToastType('success');
    } else {
      setToastMessage('Please select or create a project to save calculations');
      setToastType('warning');
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1500);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Concrete Calculator
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Estimate the amount of concrete needed for your construction project
          </p>
        </div>
        
        <div className="mb-6 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1">
              <Select
                label="Select Project"
                options={[
                  { value: '', label: 'Select a project...' },
                  ...projects.map(p => ({ value: p.id, label: p.name }))
                ]}
                value={currentProject?.id || ''}
                onChange={handleProjectChange}
                fullWidth
              />
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowCreateProjectModal(true)}
              icon={<Plus size={18} />}
              className="whitespace-nowrap"
            >
              New Project
            </Button>
          </div>
          
          {!currentProject && (
            <p className="mt-4 text-sm text-amber-600 flex items-center">
              <FolderOpen className="h-4 w-4 mr-2" />
              Select or create a project to save your calculations
            </p>
          )}
        </div>
        
        {currentProject && (
          <div className="mb-6 p-4 bg-blue-50/90 backdrop-blur-sm rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-blue-800">
                Currently working on: <span className="font-semibold">{currentProject.name}</span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentProject(currentProject.id);
                  navigate('/projects');
                }}
                icon={<ArrowRight size={18} />}
                className="text-blue-600 hover:text-blue-800"
              >
                Go to Project
              </Button>
            </div>
            <p className="text-sm text-blue-600 mt-1">
              All calculations will be saved to this project
            </p>
          </div>
        )}

        {/* Concrete Diagrams */}
        <div className={`mb-6 transition-all duration-300 ${calculationType === 'slab' || calculationType === 'thickened_edge_slab' ? 'block' : 'hidden'}`}>
          <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg">
            <img 
              src={calculationType === 'thickened_edge_slab' ? thickSlabDiagram : slabDiagram}
              alt={calculationType === 'thickened_edge_slab' ? "Thickened Edge Slab Diagram" : "Concrete Slab Diagram"}
              className="w-full max-w-2xl mx-auto h-auto object-contain"
            />
          </div>
        </div>
        
        <CalculationForm 
          onSave={handleSaveCalculation}
          onTypeChange={setCalculationType}
          initialShowWeather={showWeatherPrompt}
        />

        {showCreateProjectModal && (
          <ProjectForm
            onSubmit={handleCreateProject}
            onCancel={() => setShowCreateProjectModal(false)}
            isModal={true}
          />
        )}

        {showToast && (
          <Toast
            id="calculation-status"
            title={toastType === 'success' ? 'Success' : 'Warning'}
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
    </motion.div>
  );
};

export default CalculatorPage;