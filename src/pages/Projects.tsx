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
<<<<<<< HEAD
import ReinforcementDetails from '../components/projects/ReinforcementDetails';
=======
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
import Input from '../components/ui/Input';
import { useProjectStore } from '../store';
import { Project, Calculation, CONCRETE_MIX_DESIGNS } from '../types';
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

  const handleMixProfileChange = async (newProfile: MixProfileType) => {
    if (!currentProject) return;
    setMixProfile(newProfile);
    setIsSaving(true);
    try {
      await updateProject(currentProject.id, { mixProfile: newProfile });
      showToastMessage('Mix profile updated', 'success');
    } catch (err) {
      console.error('Failed to save mix profile', err);
      showToastMessage('Error updating mix profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = async (date: string) => {
    if (currentProject) {
      setIsSaving(true);
      try {
        const localDate = new Date(date);
        const utcDate = new Date(Date.UTC(
          localDate.getFullYear(),
          localDate.getMonth(),
          localDate.getDate(),
          localDate.getHours(),
          localDate.getMinutes(),
          localDate.getSeconds(),
          localDate.getMilliseconds()
        ));

        const { error } = await supabase
          .from('projects')
          .update({ pour_date: utcDate.toISOString() })
          .eq('id', currentProject.id);

        if (error) throw error;

        await updateProject(currentProject.id, { pourDate: utcDate.toISOString() });
        showToastMessage('Pour date updated successfully', 'success');
      } catch (error) {
        console.error('Error updating pour date:', error);
        showToastMessage('Error updating pour date', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '—';
    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', dateString);
        return '—';
      }
      return format(date, 'MM/dd/yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '—';
    }
  };

  const handleCreateProject = (data: { name: string; description: string }) => {
    addProject(data);
    setShowCreateForm(false);
    showToastMessage('Project created successfully', 'success');
  };

  const handleProjectClick = (project: Project) => {
    setCurrentProject(project.id);
    setWasteFactor(project.wasteFactor?.toString() || '10');
    setShowProjectDetails(true);
  };

  const handleUpdateProject = (data: { name: string; description: string }) => {
    if (currentProject) {
      updateProject(currentProject.id, data);
      setEditingProject(false);
      showToastMessage('Project updated successfully', 'success');
    }
  };

  const showToastMessage = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1500);
  };

  const handleDeleteConfirm = () => {
    if (!itemToDelete) return;
    if (itemToDelete.type === 'project') {
      deleteProject(itemToDelete.id);
      setShowProjectDetails(false);
      showToastMessage('Project deleted successfully', 'success');
    } else {
      if (currentProject) {
        deleteCalculation(currentProject.id, itemToDelete.id);
        showToastMessage('Calculation deleted successfully', 'success');
      }
    }
    setItemToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleDeleteProject = () => {
    if (currentProject) {
      setItemToDelete({ type: 'project', id: currentProject.id });
      setShowDeleteConfirm(true);
    }
  };

  const handleDeleteProjectCard = (projectId: string) => {
    setItemToDelete({ type: 'project', id: projectId });
    setShowDeleteConfirm(true);
  };

  const handleDeleteCalculation = (calculationId: string) => {
    setItemToDelete({ type: 'calculation', id: calculationId });
    setShowDeleteConfirm(true);
  };

  const handleSaveWasteFactor = async () => {
    if (currentProject) {
      setIsSaving(true);
      try {
        await updateProject(currentProject.id, { wasteFactor: parseInt(wasteFactor) });
        showToastMessage('Waste factor updated successfully', 'success');
      } catch (error) {
        showToastMessage('Error saving waste factor', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handlePrintPDF = () => {
    if (currentProject) {
      generateProjectPDF(currentProject, selectedPsi as keyof typeof CONCRETE_MIX_DESIGNS);
      showToastMessage('PDF generated successfully', 'success');
    }
  };

  const formatDimensions = (dimensions: Record<string, number>) =>
    Object.entries(dimensions)
      .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value.toFixed(2)}`)
      .join(' | ');

  const calculateTotalVolume = (calculations: Calculation[]) =>
    calculations.reduce((sum, c) => sum + c.result.volume, 0) * (1 + parseInt(wasteFactor) / 100);

  const getMixDesign = (volume: number) => calculateMixMaterials(volume, selectedPsi as keyof typeof CONCRETE_MIX_DESIGNS);

  const wasteFactorOptions = ['0', '5', '10', '15', '20'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-8 w-8 animate-spin text-white mx-auto mb-4" />
        <p className="text-white">Loading your projects...</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">Projects</h1>
            <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
              Manage and organize your concrete calculation projects
            </p>
          </div>
          
          {!showCreateForm && !showProjectDetails && (
            <Button 
              onClick={() => setShowCreateForm(true)}
              icon={<Plus size={18} />}
              className="shadow-lg hover:shadow-xl transition-shadow"
            >
              <span className="hidden sm:inline">New Project</span>
            </Button>
          )}

          {showProjectDetails && (
            <Button
              variant="outline"
              onClick={() => {
                setShowProjectDetails(false);
                setCurrentProject(null);
              }}
              icon={<ArrowLeftCircle size={20} />}
<<<<<<< HEAD
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-lg hover:shadow-xl"
=======
              className="bg-white/90 backdrop-blur-sm hover:bg-blue-50"
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
            >
              <span className="hidden sm:inline">Back to Projects</span>
            </Button>
          )}
        </div>
        
        <AnimatePresence mode="wait">
          {showCreateForm && (
            <motion.div
              key="create-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ProjectForm 
                onSubmit={handleCreateProject} 
                onCancel={() => setShowCreateForm(false)} 
              />
            </motion.div>
          )}
          
          {showProjectDetails && currentProject && !editingProject && (
            <motion.div
              key="project-details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 mb-6">
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between mb-6">
                  <div className="mt-4 sm:mt-0">
                    <div className="flex items-center">
<<<<<<< HEAD
                      <FolderOpen className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-2" />
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{currentProject.name}</h2>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
=======
                      <FolderOpen className="h-6 w-6 text-blue-600 mr-2" />
                      <h2 className="text-2xl font-semibold text-gray-900">{currentProject.name}</h2>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                      Created: {formatDate(currentProject.createdAt)} • 
                      Last updated: {formatDate(currentProject.updatedAt)}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveWasteFactor}
                      disabled={isSaving}
                      icon={<Save size={16} />}
                    >
                      <span className="hidden sm:inline">Save</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrintPDF}
                      icon={<Printer size={16} />}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingProject(true)}
                      icon={<Edit size={16} />}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleDeleteProject}
                      icon={<Trash2 size={16} />}
                    />
                  </div>
                </div>
                
<<<<<<< HEAD
                <p className="text-gray-600 dark:text-gray-300 mb-6">
=======
                <p className="text-gray-600 mb-6">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  {currentProject.description || 'No description provided'}
                </p>

                {currentProject.calculations.length > 0 && (
                  <StrengthProgress
                    project={currentProject}
                    mixProfile={mixProfile}
                    onMixProfileChange={handleMixProfileChange}
                    onPourDateChange={handleDateChange}
                  />
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
<<<<<<< HEAD
                  <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                    <div className="flex flex-col space-y-4">
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Total Concrete Required</h3>
                      <div>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">Add Waste Factor</p>
=======
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex flex-col space-y-4">
                      <h3 className="text-lg font-semibold text-blue-900">Total Concrete Required</h3>
                      <div>
                        <p className="text-sm text-blue-700 mb-2">Add Waste Factor</p>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                        <div className="flex flex-wrap gap-2">
                          {wasteFactorOptions.map((factor) => (
                            <Button
                              key={factor}
                              variant={wasteFactor === factor ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => setWasteFactor(factor)}
                              className="flex-1"
                            >
                              {factor}%
                            </Button>
                          ))}
                        </div>
                      </div>
<<<<<<< HEAD
                      <p className="text-3xl font-bold text-blue-700 dark:text-blue-200">
                        {calculateTotalVolume(currentProject.calculations).toFixed(2)} yd³
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
=======
                      <p className="text-3xl font-bold text-blue-700">
                        {calculateTotalVolume(currentProject.calculations).toFixed(2)} yd³
                      </p>
                      <p className="text-sm text-blue-600">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                        Base volume: {currentProject.calculations.reduce((total, calc) => total + calc.result.volume, 0).toFixed(2)} yd³
                      </p>
                    </div>
                  </div>

<<<<<<< HEAD
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Concrete Mix Design</h3>
=======
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Concrete Mix Design</h3>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                      <Select
                        options={Object.entries(CONCRETE_MIX_DESIGNS).map(([psi]) => ({
                          value: psi,
                          label: `${psi} PSI`
                        }))}
                        value={selectedPsi}
                        onChange={(value) => setSelectedPsi(value)}
                      />
                    </div>

                    {currentProject.calculations.length > 0 && (
                      <div className="space-y-4">
                        {(() => {
                          const totalVolume = calculateTotalVolume(currentProject.calculations);
                          const mixDesign = getMixDesign(totalVolume);
                          
                          return (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
<<<<<<< HEAD
                                <p className="text-sm text-gray-600 dark:text-gray-300">Portland Cement</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
=======
                                <p className="text-sm text-gray-600">Portland Cement</p>
                                <p className="text-lg font-semibold text-gray-900">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {mixDesign.materials.cement} yd³
                                </p>
                              </div>
                              <div>
<<<<<<< HEAD
                                <p className="text-sm text-gray-600 dark:text-gray-300">Fine Aggregate (Sand)</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
=======
                                <p className="text-sm text-gray-600">Fine Aggregate (Sand)</p>
                                <p className="text-lg font-semibold text-gray-900">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {mixDesign.materials.sand} yd³
                                </p>
                              </div>
                              <div>
<<<<<<< HEAD
                                <p className="text-sm text-gray-600 dark:text-gray-300">Coarse Aggregate</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
=======
                                <p className="text-sm text-gray-600">Coarse Aggregate</p>
                                <p className="text-lg font-semibold text-gray-900">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {mixDesign.materials.aggregate} yd³
                                </p>
                              </div>
                              <div>
<<<<<<< HEAD
                                <p className="text-sm text-gray-600 dark:text-gray-300">Water</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
=======
                                <p className="text-sm text-gray-600">Water</p>
                                <p className="text-lg font-semibold text-gray-900">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {mixDesign.materials.water} gal
                                </p>
                              </div>
                              <div className="col-span-2 pt-2">
<<<<<<< HEAD
                                <p className="text-sm text-gray-600 dark:text-gray-300">Slump Range</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
=======
                                <p className="text-sm text-gray-600">Slump Range</p>
                                <p className="text-lg font-semibold text-gray-900">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {mixDesign.slump.min}" - {mixDesign.slump.max}"
                                </p>
                              </div>
                              <div className="col-span-2">
<<<<<<< HEAD
                                <p className="text-sm text-gray-600 dark:text-gray-300">Water/Cement Ratio</p>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">
=======
                                <p className="text-sm text-gray-600">Water/Cement Ratio</p>
                                <p className="text-lg font-semibold text-gray-900">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {mixDesign.waterCementRatio}
                                </p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-6 mt-8">
<<<<<<< HEAD
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Calculations</h3>
=======
                    <h3 className="text-lg font-semibold text-gray-900">Calculations</h3>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                    <Button
                      onClick={() => navigate('/calculator', { state: { projectId: currentProject.id } })}
                      icon={<Calculator size={18} />}
                    >
                      <span className="hidden sm:inline">New Calculation</span>
                    </Button>
                  </div>
                  
                  {currentProject.calculations.length > 0 ? (
                    <div className="space-y-4">
                      {currentProject.calculations.map((calc: Calculation) => (
<<<<<<< HEAD
                        <Card key={calc.id} className="p-4 border border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900 dark:text-white capitalize">
=======
                        <Card key={calc.id} className="p-4 border border-gray-200">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-gray-900 capitalize">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {calc.type.replace(/_/g, ' ')} Calculation
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteCalculation(calc.id)}
                                  icon={<Trash2 size={16} />}
<<<<<<< HEAD
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                />
                              </div>
                              
                              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md mb-3">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
=======
                                  className="text-red-600 hover:text-red-700"
                                />
                              </div>
                              
                              <div className="bg-gray-50 p-3 rounded-md mb-3">
                                <p className="text-sm text-gray-600">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                  {formatDimensions(calc.dimensions)}
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
<<<<<<< HEAD
                                <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-md">
                                  <p className="text-sm text-blue-700 dark:text-blue-300">Volume</p>
                                  <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                                    {calc.result.volume} yd³
                                  </p>
                                </div>
                                <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-md">
                                  <p className="text-sm text-green-700 dark:text-green-300">Bags Required</p>
                                  <p className="text-lg font-semibold text-green-900 dark:text-green-100">
=======
                                <div className="bg-blue-50 p-2 rounded-md">
                                  <p className="text-sm text-blue-700">Volume</p>
                                  <p className="text-lg font-semibold text-blue-900">
                                    {calc.result.volume} yd³
                                  </p>
                                </div>
                                <div className="bg-green-50 p-2 rounded-md">
                                  <p className="text-sm text-green-700">Bags Required</p>
                                  <p className="text-lg font-semibold text-green-900">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                                    {calc.result.bags} bags
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
<<<<<<< HEAD
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Calculator className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">No calculations in this project yet</p>
=======
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Calculator className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No calculations in this project yet</p>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                      <Button 
                        onClick={() => navigate('/calculator', { state: { projectId: currentProject.id } })}
                        icon={<Plus size={18} />}
                      >
                        Add Calculation
                      </Button>
                    </div>
                  )}
                </div>

                {/* QC Records Section */}
                <div className="mt-8">
                  <QCRecords
                    projectId={currentProject.id}
                    records={currentProject.qcRecords || []}
                    onSave={async (record) => {
                      try {
                        const { data, error } = await supabase
                          .from('qc_records')
                          .insert([{
                            project_id: currentProject.id,
                            date: record.date,
                            temperature: parseFloat(record.temperature.toString()) || 0,
                            humidity: parseFloat(record.humidity.toString()) || 0,
                            slump: parseFloat(record.slump.toString()) || 0,
                            air_content: parseFloat(record.airContent.toString()) || 0,
                            cylinders_made: parseInt(record.cylindersMade.toString()) || 0,
                            notes: record.notes || ''
                          }])
                          .select()
                          .single();

                        if (error) throw error;
                        
                        // Update local state immediately
                        if (data) {
                          const updatedProject = {
                            ...currentProject,
                            qcRecords: [...(currentProject.qcRecords || []), data]
                          };
                          
                          // Update the project in the store
                          await updateProject(currentProject.id, updatedProject);
                          
                          // Refresh the current project
                          setCurrentProject(currentProject.id);
                        }
                        
                        showToastMessage('QC record added successfully', 'success');
                      } catch (err) {
                        console.error('Error saving QC record:', err);
                        showToastMessage('Error saving QC record', 'error');
                      }
                    }}
                    onDelete={async (recordId) => {
                      try {
                        const { error } = await supabase
                          .from('qc_records')
                          .delete()
                          .eq('id', recordId);

                        if (error) throw error;
                        
                        // Update local state immediately
                        const updatedProject = {
                          ...currentProject,
                          qcRecords: currentProject.qcRecords?.filter(record => record.id !== recordId) || []
                        };
                        
                        // Update the project in the store
                        await updateProject(currentProject.id, updatedProject);
                        
                        // Refresh the current project
                        setCurrentProject(currentProject.id);
                        
                        showToastMessage('QC record deleted successfully', 'success');
                      } catch (err) {
                        console.error('Error deleting QC record:', err);
                        showToastMessage('Error deleting QC record', 'error');
                      }
                    }}
                  />
                </div>
<<<<<<< HEAD

                {/* Reinforcement Details Section */}
                <div className="mt-8">
                  <ReinforcementDetails
                    reinforcements={currentProject.reinforcements || []}
                    onDelete={async (setId) => {
                      try {
                        const { error } = await supabase
                          .from('reinforcement_sets')
                          .delete()
                          .eq('id', setId);

                        if (error) throw error;
                        
                        // Refresh projects to update the UI
                        await loadProjects();
                        
                        showToastMessage('Reinforcement design deleted successfully', 'success');
                      } catch (err) {
                        console.error('Error deleting reinforcement set:', err);
                        showToastMessage('Error deleting reinforcement design', 'error');
                      }
                    }}
                  />
                </div>
=======
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
              </Card>
            </motion.div>
          )}
          
          {editingProject && currentProject && (
            <motion.div
              key="edit-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ProjectForm 
                onSubmit={handleUpdateProject} 
                onCancel={() => setEditingProject(false)}
                initialData={{
                  name: currentProject.name,
                  description: currentProject.description
                }}
                isEditing
              />
            </motion.div>
          )}
          
          {!showCreateForm && !showProjectDetails && (
            <motion.div
              key="project-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {projects.length > 0 ? (
                projects.map((project) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onClick={() => handleProjectClick(project)}
                    onDelete={() => handleDeleteProjectCard(project.id)}
                  />
                ))
              ) : (
<<<<<<< HEAD
                <div className="col-span-3 text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <FolderOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Projects Yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first project to get started</p>
=======
                <div className="col-span-3 text-center py-12 bg-gray-50 rounded-lg">
                  <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Yet</h3>
                  <p className="text-gray-500 mb-6">Create your first project to get started</p>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <Button 
                    onClick={() => setShowCreateForm(true)}
                    icon={<Plus size={18} />}
                    className="whitespace-nowrap"
                  >
                    <span className="hidden sm:inline">Create New Project</span>
                    <span className="sm:hidden">New Project</span>
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showToast && (
          <Toast
            id="project-action"
            title={toastType === 'success' ? 'Success' : toastType === 'error' ? 'Error' : 'Warning'}
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
        
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this {itemToDelete?.type}? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setItemToDelete(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteConfirm}
                >
                  Delete
                </Button>
              </div>
            </Card>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Projects;