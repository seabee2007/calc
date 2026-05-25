import React from 'react';
import Card from '../ui/Card';

export interface OpsStatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: 'blue' | 'cyan' | 'amber' | 'green' | 'red' | 'slate';
}

const accentClasses: Record<NonNullable<OpsStatCardProps['accent']>, string> = {
  blue: 'border-blue-500/40 bg-slate-900/90',
  cyan: 'border-cyan-500/40 bg-slate-900/90',
  amber: 'border-amber-500/40 bg-slate-900/90',
  green: 'border-emerald-500/40 bg-slate-900/90',
  red: 'border-red-500/40 bg-slate-900/90',
  slate: 'border-slate-600/50 bg-slate-900/90',
};

const OpsStatCard: React.FC<OpsStatCardProps> = ({
  label,
  value,
  sub,
  icon,
  accent = 'slate',
}) => (
  <Card
    className={`p-4 border ${accentClasses[accent]} text-white shadow-lg`}
    shadow="md"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-bold mt-1 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className="shrink-0 opacity-90">{icon}</div>
    </div>
  </Card>
);

export default OpsStatCard;
