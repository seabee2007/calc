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

const ToolsModal: React.FC = () => {
  const navigate = useNavigate();
  const { isOpen, close } = useToolsModalStore();
  const projects = useProjectStore((s) => s.projects);

  const handleNavigate = (path: string) => {
    close();
    navigate(path);
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

  const toolCards: ToolCard[] = [
    {
      title: 'Projects',
      description: 'Manage jobs, QC, and truck tickets',
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
      title: 'Labor calculator',
      description: 'Crew and production labor cost',
      path: '/calculator/labor',
      icon: Users,
    },
    {
      title: 'Mix Design Advisor',
      description: 'Admixtures and spec guidance',
      path: '/mix-design-advisor',
      icon: Beaker,
    },
    {
      title: 'Placement Planner',
      description: 'Weather, dispatch, and call sheets',
      path: '/pour-planner',
      icon: CloudSun,
    },
    {
      title: 'Resources',
      description: 'Field guides and references',
      path: '/resources',
      icon: BookOpen,
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={close} title="Tools" size="lg">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 -mt-2">
        Jump to any area of ConcreteCalc. Your guided workflow starts from the dashboard.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {toolCards.map(({ title, description, path, icon: Icon, onNavigate }) => (
          <button
            key={path + title}
            type="button"
            onClick={() => (onNavigate ? onNavigate() : handleNavigate(path))}
            className="flex w-full items-start gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left transition-colors hover:border-cyan-500/50 hover:bg-cyan-50/50 dark:border-slate-600 dark:bg-slate-800/80 dark:hover:border-cyan-500/40 dark:hover:bg-slate-700/80"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-cyan-600/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900 dark:text-white">{title}</span>
              <span className="block text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
};

export default ToolsModal;
