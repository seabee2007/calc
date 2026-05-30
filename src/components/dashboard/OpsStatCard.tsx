import React from 'react';
import OpsCard from './OpsCard';
import { OPS_MUTED, OPS_TITLE } from './opsTheme';

export interface OpsStatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: 'blue' | 'cyan' | 'amber' | 'green' | 'red' | 'slate';
}

const accentBorder: Record<NonNullable<OpsStatCardProps['accent']>, string> = {
  blue: 'border-blue-500/40',
  cyan: 'border-cyan-500/40',
  amber: 'border-amber-500/40',
  green: 'border-emerald-500/40',
  red: 'border-red-500/40',
  slate: 'border-slate-200 dark:border-slate-600/50',
};

const OpsStatCard: React.FC<OpsStatCardProps> = ({
  label,
  value,
  sub,
  icon,
  accent = 'slate',
}) => (
  <OpsCard className={`p-4 ${accentBorder[accent]}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={`text-xs uppercase tracking-wider ${OPS_MUTED}`}>{label}</p>
        <p className={`text-2xl font-bold mt-1 truncate ${OPS_TITLE}`}>{value}</p>
        {sub && <p className={`text-xs mt-1 ${OPS_MUTED}`}>{sub}</p>}
      </div>
      <div className="shrink-0 opacity-90">{icon}</div>
    </div>
  </OpsCard>
);

export default OpsStatCard;
