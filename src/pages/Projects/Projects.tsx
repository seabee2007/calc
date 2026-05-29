import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowLeftCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from './useProjects';
import ProjectList from './ProjectList';
import ProjectDetails from './ProjectDetails';
import ProjectForm from '../../components/projects/ProjectForm';
import ToastManager from './ToastManager';
import Button from '../../components/ui/Button';
import { useTrackedProposals } from '../../hooks/useTrackedProposals';
import type { Project } from '../../types';
import type { TrackedProposalRow } from '../../types/proposalTracking';
import {
  buildFolderCounts,
  getProjectFolder,
  PROJECT_FOLDER_LABELS,
  type ProjectFolder,
  type ProjectFolderContext,
} from '../../utils/projectFolders';

function matchProposal(
  project: Project,
  proposals: TrackedProposalRow[],
): TrackedProposalRow | undefined {
  const direct = proposals.find((p) => p.project_id === project.id);
  if (direct) return direct;
  const name = project.name?.trim() ?? '';
  if (!name) return undefined;
  const lower = name.toLowerCase();
  return proposals.find(
    (p) =>
      p.data?.projectTitle === name ||
      p.title?.toLowerCase().includes(lower),
  );
}

function folderContext(
  project: Project,
  proposals: TrackedProposalRow[],
): ProjectFolderContext {
  const matched = matchProposal(project, proposals);
  return {
    hasProposalDraft: Boolean(matched),
    proposalStatus: matched?.status,
  };
}

const TAB_CLASS_ACTIVE =
  'shrink-0 rounded-xl border border-cyan-500/50 bg-cyan-950/50 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-sm';
const TAB_CLASS_IDLE =
  'shrink-0 rounded-xl border border-slate-600/80 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:bg-slate-800';

const PROJECT_FOLDERS: ProjectFolder[] = ['active', 'qc_closeout', 'archived'];

function parseProjectFolder(value: string | null): ProjectFolder {
  if (value && PROJECT_FOLDERS.includes(value as ProjectFolder)) {
    return value as ProjectFolder;
  }
  return 'active';
}

const Projects: React.FC = () => {
  const { projects, currentProject, ui, setUi, handlers } = useProjects();
  const { proposals } = useTrackedProposals();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectFolder, setProjectFolder] = useState<ProjectFolder>(() =>
    parseProjectFolder(searchParams.get('folder')),
  );

  useEffect(() => {
    setProjectFolder(parseProjectFolder(searchParams.get('folder')));
  }, [searchParams]);

  const selectProjectFolder = (folder: ProjectFolder) => {
    setProjectFolder(folder);
    if (folder === 'active') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ folder }, { replace: true });
    }
  };

  const resolveCtx = useMemo(
    () => (project: Project) => folderContext(project, proposals),
    [proposals],
  );

  const folderCounts = useMemo(
    () => buildFolderCounts(projects, resolveCtx),
    [projects, resolveCtx],
  );

  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (p) => getProjectFolder(p, resolveCtx(p)) === projectFolder,
      ),
    [projects, projectFolder, resolveCtx],
  );

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
          <p className="text-white text-lg font-semibold drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] mt-2">
  Track active jobs, next actions, readiness, and financials
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
            onClick={() => handlers.backToProjectList()}
            icon={<ArrowLeftCircle size={20} />}
            size="lg"
            variant="outline"
            className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
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
            hidePourDate
          />
        )}

        {ui.showDetails && !currentProject && (
          <p className="text-white/90 text-sm py-8">Loading project…</p>
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
              description: currentProject.description,
              jobsiteAddress: currentProject.jobsiteAddress,
              clientInfo: currentProject.clientInfo,
              pourDate: currentProject.pourDate?.split('T')[0],
            }}
            isEditing
          />
        )}

        {!ui.showCreate && !ui.showDetails && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
              {PROJECT_FOLDERS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectProjectFolder(key)}
                    className={
                      projectFolder === key ? TAB_CLASS_ACTIVE : TAB_CLASS_IDLE
                    }
                  >
                    {PROJECT_FOLDER_LABELS[key]}{' '}
                    <span className="tabular-nums opacity-90">
                      {folderCounts[key]}
                    </span>
                  </button>
                ))}
            </div>
            <ProjectList
              projects={visibleProjects}
              folder={projectFolder}
              onSelect={handlers.selectProject}
              onDelete={(id) => handlers.confirmDelete('project', id)}
              onCreate={() => setUi((s) => ({ ...s, showCreate: true }))}
            />
          </>
        )}
      </AnimatePresence>

      <ToastManager {...ui.toast} />
    </motion.div>
  );
};

export default Projects;