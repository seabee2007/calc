import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowLeftCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useProjects, ProjectsProvider } from './useProjects';
import ProjectList from './ProjectList';
import ProjectDetails from './ProjectDetails';
import ProjectForm from '../../components/projects/ProjectForm';
import ToastManager from './ToastManager';
import ClientPortalCreatedModal from '../../components/projects/ClientPortalCreatedModal';
import EstimateWorkspaceToast from '../../features/estimating/ui/components/EstimateWorkspaceToast';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';
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
import { OPS_OUTLINE_BTN } from '../../components/dashboard/opsTheme';

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

const CHIP_BASE =
  'shrink-0 rounded-xl border px-4 py-2 text-sm transition-colors';

const TAB_CLASS_ACTIVE =
  `${CHIP_BASE} border-cyan-500/50 bg-cyan-500/10 font-semibold text-cyan-600 dark:border-cyan-500/45 dark:bg-cyan-500/15 dark:text-cyan-300`;

const TAB_CLASS_IDLE =
  `${CHIP_BASE} border-slate-300 bg-white/80 font-medium text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-slate-600`;

const PROJECT_FOLDERS: ProjectFolder[] = ['active', 'qc_closeout', 'archived'];

const VIEW_TRANSITION = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };
const viewMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: VIEW_TRANSITION,
};

function parseProjectFolder(value: string | null): ProjectFolder {
  if (value && PROJECT_FOLDERS.includes(value as ProjectFolder)) {
    return value as ProjectFolder;
  }
  return 'active';
}

const Projects: React.FC = () => {
  return (
    <ProjectsProvider>
      <ProjectsContent />
    </ProjectsProvider>
  );
};

const ProjectsContent: React.FC = () => {
  const { projects, currentProject, ui, setUi, handlers } = useProjects();
  const { proposals } = useTrackedProposals();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectFolder, setProjectFolder] = useState<ProjectFolder>(() =>
    parseProjectFolder(searchParams.get('folder')),
  );
  const [portalSentToast, setPortalSentToast] = useState<string | null>(null);

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

  const headerActions =
    !ui.showCreate && !ui.showDetails ? (
      <Button
        onClick={() => setUi((s) => ({ ...s, showCreate: true }))}
        icon={<Plus size={18} />}
        className="shadow-lg transition-shadow hover:shadow-xl"
        data-testid="projects-new-button"
      >
        <span className="hidden sm:inline">New Project</span>
        <span className="sm:hidden">New</span>
      </Button>
    ) : ui.showDetails ? (
      <Button
        onClick={() => handlers.backToProjectList()}
        icon={<ArrowLeftCircle size={20} />}
        size="lg"
        variant="outline"
        className={OPS_OUTLINE_BTN}
        data-testid="projects-back-button"
      >
        <span className="hidden sm:inline">Back to Projects</span>
        <span className="sm:hidden">Back</span>
      </Button>
    ) : undefined;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <AppPage
          className="w-full max-w-full overflow-x-hidden !max-w-none pb-28 pt-6 md:pb-8"
          data-testid="projects-page"
          header={
            <PageHeader
              title="Projects"
              subtitle="Track active jobs, next actions, readiness, and financials."
              className="[&_h1]:text-slate-900 dark:[&_h1]:text-slate-50 [&_p]:text-slate-600 dark:[&_p]:text-slate-300"
              actions={headerActions}
            />
          }
        >
          <AnimatePresence mode="wait" initial={false}>
        {ui.showCreate && (
          <motion.div key="create" {...viewMotion}>
            <ProjectForm 
              onSubmit={handlers.create} 
              onCancel={() => setUi(s => ({ ...s, showCreate: false }))} 
              hidePourDate
            />
          </motion.div>
        )}

        {ui.showDetails && !ui.editing && (
          <motion.div key="details" {...viewMotion}>
            {!currentProject ? (
              <p className="py-8 text-sm text-slate-600 dark:text-slate-400">Loading project…</p>
            ) : (
              <ProjectDetails />
            )}
          </motion.div>
        )}

        {ui.editing && currentProject && (
          <motion.div key="edit" {...viewMotion}>
            <ProjectForm 
              onSubmit={handlers.update}
              onCancel={() => setUi(s => ({ ...s, editing: false }))}
              initialData={{
                name: currentProject.name,
                description: currentProject.description,
                jobsiteAddress: currentProject.jobsiteAddress,
                clientInfo: currentProject.clientInfo,
                pourDate: currentProject.pourDate?.split('T')[0],
                projectCrewSize: currentProject.projectCrewSize ?? 7,
              }}
              projectId={currentProject.id}
              isEditing
            />
          </motion.div>
        )}

        {!ui.showCreate && !ui.showDetails && (
          <motion.div key="list" {...viewMotion} className="w-full max-w-full min-w-0 overflow-x-hidden">
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
          </motion.div>
        )}
          </AnimatePresence>
        </AppPage>
      </motion.div>

      <ToastManager {...ui.toast} />

      <EstimateWorkspaceToast
        message={portalSentToast}
        onDismiss={() => setPortalSentToast(null)}
        zIndexClass="z-[10060]"
      />

      {ui.createdPortal && (
        <ClientPortalCreatedModal
          clientName={ui.createdPortal.clientName}
          clientEmail={ui.createdPortal.clientEmail}
          token={ui.createdPortal.token}
          projectId={ui.createdPortal.projectId}
          onClose={() => handlers.dismissCreatedPortal()}
          onSent={() => setPortalSentToast('Sent')}
        />
      )}
    </>
  );
};

export default Projects;