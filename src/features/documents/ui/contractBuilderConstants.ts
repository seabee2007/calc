import type { DocumentRiskLevel, IntakeGroup, QuestionnaireMode } from '../types';

export const MODES: { value: QuestionnaireMode; label: string; hint: string }[] = [
  { value: 'quick', label: 'Quick', hint: 'Core fields for a fast draft' },
  { value: 'standard', label: 'Standard', hint: 'Recommended for most jobs' },
  { value: 'advanced', label: 'Advanced', hint: 'Larger or riskier jobs' },
];

export const GROUP_ORDER: IntakeGroup[] = [
  'project',
  'parties',
  'property',
  'scope',
  'pricing',
  'payments',
  'schedule',
  'change_management',
  'permits',
  'insurance',
  'risk',
  'hoa',
  'warranty',
  'compliance',
  'execution',
];

export const GROUP_LABELS: Record<IntakeGroup, string> = {
  project: 'Project',
  parties: 'Parties',
  property: 'Property',
  scope: 'Scope',
  pricing: 'Pricing',
  payments: 'Payments',
  schedule: 'Schedule',
  change_management: 'Change management',
  permits: 'Permits',
  insurance: 'Insurance',
  risk: 'Risk',
  hoa: 'HOA / Condo',
  warranty: 'Warranty',
  compliance: 'Compliance',
  execution: 'Execution',
};

export const RISK_STYLES: Record<DocumentRiskLevel, string> = {
  low: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  extreme: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
};

export const SIGNING_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  sent: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  viewed: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  signed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  declined: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  void: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
};

export const SEVERITY_TEXT: Record<string, string> = {
  info: 'text-blue-600 dark:text-blue-400',
  warning: 'text-amber-600 dark:text-amber-400',
  blocker: 'text-red-600 dark:text-red-400',
  recommended: 'text-cyan-700 dark:text-cyan-300',
  critical: 'text-red-600 dark:text-red-400',
};
