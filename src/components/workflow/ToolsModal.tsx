import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  FileText,
  Calculator,
  Beaker,
  CloudSun,
  BookOpen,
  Grid3x3,
  Users,
  PenLine,
  HardHat,
  type LucideIcon,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useToolsModalStore } from '../../store/toolsModalStore';
import { useProjectStore } from '../../store';
interface ToolCard {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  onNavigate?: () => void;
}

interface ToolSection {
  heading: string;
  cards: ToolCard[];
}

const ToolsModal: React.FC = () => {
  const navigate = useNavigate();
  const { isOpen, close } = useToolsModalStore();
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);

  const projectId = currentProject?.id;

  const pathWithProject = (path: string) => {
    if (!projectId) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}project=${encodeURIComponent(projectId)}`;
  };

  const handleNavigate = (path: string, attachProject = false) => {
    close();
    navigate(attachProject ? pathWithProject(path) : path);
  };

  const handleProjects = () => {
    close();
    const openCreate = projects.length === 0;
    navigate('/projects', {
      replace: false,
      state: {
        mode: 'browse' as const,
        ...(openCreate
          ? { openCreate: true, view: 'create' as const }
          : { view: 'list' as const }),
      },
    });
  };

  const sections: ToolSection[] = [
    {
      heading: 'Project management',
      cards: [
        {
          title: 'Projects',
          description: 'Manage jobs, QC, planner, and closeout',
          path: '/projects',
          icon: FolderKanban,
          onNavigate: handleProjects,
        },
        {
          title: 'Proposals',
          description: 'Estimates and client bids',
          path: '/proposals',
          icon: FileText,
        },
        {
          title: 'Resources',
          description: 'Field guides and references',
          path: '/resources',
          icon: BookOpen,
        },
      ],
    },
    {
      heading: 'Estimating',
      cards: [
        {
          title: 'Concrete calculator',
          description: 'Volume and ready-mix pricing',
          path: '/calculator/concrete',
          icon: Calculator,
        },
        {
          title: 'Reinforcement calculator',
          description: 'Rebar, mesh, and fiber design',
          path: '/calculator/reinforcement',
          icon: Grid3x3,
        },
        {
          title: 'Concrete labor calculator',
          description: 'Crew and production — concrete placement labor',
          path: '/calculator/labor',
          icon: Users,
        },
        {
          title: 'General trade labor',
          description: 'Hours and labor cost for non-concrete trades',
          path: '/calculator/general-trade-labor',
          icon: HardHat,
        },
        {
          title: 'Custom estimate',
          description: 'Manual labor, material, and equipment lines',
          path: '/calculator/custom',
          icon: PenLine,
        },
        {
          title: 'Mix Design Advisor',
          description: 'Admixtures and spec guidance for placements',
          path: '/mix-design-advisor',
          icon: Beaker,
        },
        {
          title: 'Placement Planner',
          description: 'Weather, dispatch, and placement call sheets',
          path: '/pour-planner',
          icon: CloudSun,
        },
      ],
    },
  ];

  const estimatingPathsWithProject = new Set([
    '/calculator/concrete',
    '/calculator/reinforcement',
    '/calculator/labor',
    '/calculator/general-trade-labor',
    '/calculator/custom',
    '/mix-design-advisor',
    '/pour-planner',
  ]);

  return (
    <Modal isOpen={isOpen} onClose={close} title="Tools" size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 -mt-2">
        Jump to any area of your project workspace. The guided workflow is Project → Estimates →
        Proposal.
      </p>
      {projectId && currentProject && (
        <p className="text-sm text-cyan-700 dark:text-cyan-300/90 mb-4 font-medium">
          Active project: {currentProject.name}
          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">
            Estimating tools open with this project selected.
          </span>
        </p>
      )}
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.heading}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-3">
              {section.heading}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.cards.map(({ title, description, path, icon: Icon, onNavigate }) => (
                <button
                  key={path + title}
                  type="button"
                  onClick={() =>
                    onNavigate
                      ? onNavigate()
                      : handleNavigate(path, estimatingPathsWithProject.has(path))
                  }
                  className="flex w-full items-start gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-cyan-500/50 hover:bg-cyan-50/50 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-cyan-500/40 dark:hover:bg-slate-700/80"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-600/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-900 dark:text-white">
                      {title}
                    </span>
                    <span className="block text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {description}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default ToolsModal;
