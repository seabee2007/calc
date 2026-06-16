import { FolderOpen, Plus } from 'lucide-react';
import ProjectCard from '../../components/projects/ProjectCard';
import Button from '../../components/ui/Button';
import type { Project } from '../../types';
import type { ProjectFolder } from '../../utils/projectFolders';
import { PROJECT_FOLDER_EMPTY } from '../../utils/projectFolders';

interface ProjectListProps {
  projects: Project[];
  folder: ProjectFolder;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate?: () => void;
}

export default function ProjectList({
  projects,
  folder,
  onSelect,
  onDelete,
  onCreate,
}: ProjectListProps) {
  if (!projects.length) {
    return (
      <div className="rounded-lg bg-gray-50 py-12 text-center backdrop-blur-sm dark:bg-gray-900/70">
        <FolderOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2 dark:text-white">
          {folder === 'active' ? 'No Projects in This Tab' : 'Nothing Here'}
        </h3>
        <p className="text-gray-500 mb-6 dark:text-gray-300 max-w-md mx-auto">
          {PROJECT_FOLDER_EMPTY[folder]}
        </p>
        {folder === 'active' && onCreate && (
          <Button onClick={onCreate} icon={<Plus size={18} />} className="whitespace-nowrap">
            <span className="hidden sm:inline">Create New Project</span>
            <span className="sm:hidden">New Project</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-full grid-cols-1 gap-4 lg:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          folder={folder}
          onClick={() => onSelect(project.id)}
          onDelete={() => onDelete(project.id)}
        />
      ))}
    </div>
  );
}
