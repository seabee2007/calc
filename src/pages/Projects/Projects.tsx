import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowLeftCircle } from 'lucide-react';
import { useProjects } from './useProjects';
import ProjectList from './ProjectList';
import ProjectDetails from './ProjectDetails';
import ProjectForm from '../../components/projects/ProjectForm';
import DeleteConfirm from './DeleteConfirm';
import ToastManager from './ToastManager';
import Button from '../../components/ui/Button';

const Projects: React.FC = () => {
  const { projects, currentProject, ui, setUi, handlers } = useProjects();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Projects
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Manage and organize your concrete calculation projects
          </p>
        </div>

        {!ui.showCreate && !ui.showDetails && (
          <Button 
            onClick={() => setUi(s => ({ ...s, showCreate: true }))}
            icon={<Plus size={18} />}
            className="shadow-lg hover:shadow-xl transition-shadow"
          >
            <span className="hidden sm:inline">New Project</span>
          </Button>
        )}

        {ui.showDetails && (
          <Button
            onClick={() => {
              setUi(s => ({ ...s, showDetails: false }));
              setCurrentProject(null);
            }}
            icon={<ArrowLeftCircle size={20} />}
            className="text-blue-600 hover:text-blue-700"
          >
            <span className="hidden sm:inline">Back to Projects</span>
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {ui.showCreate && (
          <ProjectForm 
            onSubmit={handlers.create} 
            onCancel={() => setUi(s => ({ ...s, showCreate: false }))} 
          />
        )}

        {ui.showDetails && currentProject && !ui.editing && (
          <ProjectDetails />
        )}

        {ui.editing && currentProject && (
          <ProjectForm 
            onSubmit={handlers.update}
            onCancel={() => setUi(s => ({ ...s, editing: false }))}
            initialData={{
              name: currentProject.name,
              description: currentProject.description
            }}
            isEditing
          />
        )}

        {!ui.showCreate && !ui.showDetails && (
          <ProjectList 
            projects={projects}
            onSelect={handlers.selectProject}
            onDelete={(id) => handlers.confirmDelete('project', id)}
          />
        )}
      </AnimatePresence>

      <DeleteConfirm 
        show={ui.deleteConfirm.show}
        type={ui.deleteConfirm.type}
        onCancel={handlers.cancelDelete}
        onConfirm={handlers.handleDeleteConfirm}
      />

      <ToastManager {...ui.toast} />
    </motion.div>
  );
};

export default Projects;