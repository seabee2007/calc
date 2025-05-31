import React from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import ProjectCard from '../../components/projects/ProjectCard';
import Button from '../../components/ui/Button';
import { Project } from '../../types';

interface ProjectListProps {
  projects: Project[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ProjectList({ projects, onSelect, onDelete }: ProjectListProps) {
  if (!projects.length) {
    return (
      <div className="col-span-3 text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <FolderOpen className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Projects Yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first project to get started</p>
        <Button 
          onClick={() => onSelect('')}
          icon={<Plus size={18} />}
          className="whitespace-nowrap"
        >
          <span className="hidden sm:inline">Create New Project</span>
          <span className="sm:hidden">New Project</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map(project => (
        <ProjectCard 
          key={project.id} 
          project={project} 
          onClick={() => onSelect(project.id)} 
          onDelete={() => onDelete(project.id)} 
        />
      ))}
    </div>
  );
}