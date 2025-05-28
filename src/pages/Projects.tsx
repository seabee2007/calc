import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, FolderOpen, Calculator, Trash2, Edit, ArrowLeftCircle, Printer, Save, Loader } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectForm from '../components/projects/ProjectForm';
import Select from '../components/ui/Select';
import Toast from '../components/ui/Toast';
import StrengthProgress from '../components/projects/StrengthProgress';
import QCRecords from '../components/projects/QCRecords';
import Input from '../components/ui/Input';
import { useProjectStore } from '../store';
import { Project, Calculation, CONCRETE_MIX_DESIGNS, QCRecord } from '../types';
import { calculateMixMaterials } from '../utils/calculations';
import { generateProjectPDF } from '../utils/pdf';
import { format, parseISO } from 'date-fns';
import { supabase } from '../lib/supabase';
import { MixProfileType } from '../types/curing';

const Projects: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    projects,
    addProject,
    setCurrentProject,
    currentProject,
    deleteProject,
    updateProject,
    deleteCalculation,
    loading,
    loadProjects
  } = useProjectStore();

  // Local UI state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [selectedPsi, setSelectedPsi] = useState<string>('3000');
  const [wasteFactor, setWasteFactor] = useState<string>(currentProject?.wasteFactor?.toString() || '10');
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'project' | 'calculation'; id: string } | null>(null);
  const [mixProfile, setMixProfile] = useState<MixProfileType>(currentProject?.mixProfile ?? 'standard');

  useEffect(() => {
    // Check for navigation state
    const state = location.state as { showProjectDetails?: boolean; projectId?: string };
    if (state?.showProjectDetails && state?.projectId) {
      setCurrentProject(state.projectId);
      setShowProjectDetails(true);
    }
  }, [location.state, setCurrentProject]);

  useEffect(() => {
    if (currentProject) {
      setMixProfile(currentProject.mixProfile ?? 'standard');
      setWasteFactor(currentProject.wasteFactor?.toString() || '10');
    }
  }, [currentProject]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSaveQCRecord = async (record: Omit<QCRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentProject) return;
    
    try {
      const { data, error } = await supabase
        .from('qc_records')
        .insert([{
          project_id: currentProject.id,
          date: record.date,
          temperature: record.temperature,
          humidity: record.humidity,
          slump: record.slump,
          air_content: record.airContent,
          cylinders_made: record.cylindersMade,
          notes: record.notes
        }])
        .select(`*, qc_checklists(*)`)
        .single();

      if (error) throw error;
      
      // Map the response to camelCase
      const newRecord: QCRecord = {
        id: data.id,
        projectId: data.project_id,
        date: data.date,
        temperature: data.temperature,
        humidity: data.humidity,
        slump: data.slump,
        airContent: data.air_content,
        cylindersMade: data.cylinders_made,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        checklist: data.qc_checklists?.[0] ? {
          // ... map checklist fields if needed
        } : undefined
      };

      // Update the project in the store
      const updatedProject = {
        ...currentProject,
        qcRecords: [...(currentProject.qcRecords || []), newRecord]
      };
      
      await updateProject(currentProject.id, updatedProject);
      
      // Refresh the current project
      setCurrentProject(currentProject.id);
      
      showToastMessage('QC record added successfully', 'success');
    } catch (err) {
      console.error('Error saving QC record:', err);
      showToastMessage('Error saving QC record', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="container mx-auto px-4 py-8"
    >
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          {!showProjectDetails && (
            <Button
              onClick={() => setShowCreateForm(true)}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Plus size={20} />
              New Project
            </Button>
          )}
        </div>

        {/* Project List View */}
        {!showProjectDetails && !showCreateForm && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onView={() => {
                  setCurrentProject(project.id);
                  setShowProjectDetails(true);
                }}
                onEdit={() => {
                  setCurrentProject(project.id);
                  setEditingProject(true);
                }}
                onDelete={() => {
                  setItemToDelete({ type: 'project', id: project.id });
                  setShowDeleteConfirm(true);
                }}
              />
            ))}
          </div>
        )}

        {/* Project Creation Form */}
        {showCreateForm && (
          <ProjectForm
            onSubmit={async (projectData) => {
              await addProject(projectData);
              setShowCreateForm(false);
            }}
            onCancel={() => setShowCreateForm(false)}
          />
        )}

        {/* Project Details View */}
        {showProjectDetails && currentProject && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Button
                onClick={() => {
                  setShowProjectDetails(false);
                  setCurrentProject(null);
                }}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <ArrowLeftCircle size={20} />
                Back to Projects
              </Button>
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => generateProjectPDF(currentProject)}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Printer size={20} />
                  Export PDF
                </Button>
                <Button
                  onClick={() => setEditingProject(true)}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Edit size={20} />
                  Edit Project
                </Button>
              </div>
            </div>

            {/* Project Information */}
            <Card className="p-6">
              <h2 className="text-2xl font-semibold mb-4">{currentProject.name}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">Location</p>
                  <p className="font-medium">{currentProject.location}</p>
                </div>
                <div>
                  <p className="text-gray-600">Start Date</p>
                  <p className="font-medium">
                    {format(parseISO(currentProject.startDate), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Client</p>
                  <p className="font-medium">{currentProject.client}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-medium capitalize">{currentProject.status}</p>
                </div>
              </div>
            </Card>

            {/* Strength Progress */}
            <StrengthProgress project={currentProject} />

            {/* QC Records */}
            <QCRecords
              records={currentProject.qcRecords || []}
              onSave={handleSaveQCRecord}
            />
          </div>
        )}

        {/* Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <Toast
              message={toastMessage}
              type={toastType}
              onClose={() => setShowToast(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default Projects;