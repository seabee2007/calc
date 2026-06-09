import type { LucideIcon } from 'lucide-react';
import {
  Calculator,
  ClipboardList,
  FileStack,
  HardHat,
  LayoutDashboard,
  Network,
} from 'lucide-react';

export const MARKETING_HERO_TITLE = 'Concrete Calc Project Management Suite';

export const MARKETING_HERO_SUBTITLE =
  'Estimate work, build schedules, manage RFIs, track field activity, and control project execution from one professional workspace.';

export const MARKETING_WORKFLOW = 'Estimate → Plan → Schedule → Track → Control';

export const MARKETING_SUITE_SECTION_TITLE = 'Everything you need to run the job';

export interface MarketingFeatureCard {
  title: string;
  description: string;
  icon: LucideIcon;
  path: string;
}

export const MARKETING_FEATURE_CARDS: MarketingFeatureCard[] = [
  {
    title: 'Project Dashboard',
    description:
      'Central command center for active projects, cost status, schedule health, RFIs, FARs, field activity, and action items.',
    icon: LayoutDashboard,
    path: '/signup',
  },
  {
    title: 'Estimating & Cost Control',
    description:
      'Build structured estimates with labor, material, equipment, indirect costs, overhead, profit, tax, and project crew assumptions.',
    icon: ClipboardList,
    path: '/signup',
  },
  {
    title: 'Planning & Scheduling',
    description:
      'Create Level III schedules, manually wire logic networks, run CPM, review float, and manage project timelines.',
    icon: Network,
    path: '/signup',
  },
  {
    title: 'Documents, RFIs & FARs',
    description:
      'Track project documents, requests for information, field action reports, approvals, and project communication.',
    icon: FileStack,
    path: '/signup',
  },
  {
    title: 'Field Activity Tracking',
    description:
      'Log daily work, manpower, production, issues, QC notes, and jobsite progress.',
    icon: HardHat,
    path: '/signup',
  },
  {
    title: 'Concrete Calculators',
    description:
      'Use field-ready calculators for slabs, footings, columns, sidewalks, reinforcement, and material planning.',
    icon: Calculator,
    path: '/calculator',
  },
];
