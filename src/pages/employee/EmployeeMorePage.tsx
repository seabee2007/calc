import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Calculator,
  ShieldCheck,
  FilePlus,
  CalendarDays,
  FileQuestion,
  AlertTriangle,
  ClipboardCheck,
  FolderOpen,
  FolderKanban,
  MessageSquare,
} from 'lucide-react';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';

const sections = [
  {
    title: 'Field tools',
    items: [
      { path: '/employee/schedule', label: 'Schedule', icon: CalendarDays },
      { path: '/employee/rfi', label: 'RFI', icon: FileQuestion },
      { path: '/employee/far', label: 'FAR', icon: AlertTriangle },
      { path: '/employee/qc', label: 'QC', icon: ClipboardCheck },
      { path: '/employee/documents', label: 'Documents', icon: FolderOpen },
      { path: '/employee/projects', label: 'Projects', icon: FolderKanban },
      { path: '/employee/messages', label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    title: 'Account',
    items: [{ path: '/employee/profile', label: 'Profile', icon: User }],
  },
  {
    title: 'Tools',
    items: [
      { path: '/employee/calculator', label: 'Calculator', icon: Calculator },
      { path: '/employee/safety-meeting', label: 'Safety Meeting', icon: ShieldCheck },
      { path: '/employee/draft-change-order', label: 'Draft Change Order', icon: FilePlus },
    ],
  },
];

export default function EmployeeMorePage() {
  useEmployeePageTitle('More');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-400">
            {section.title}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {section.items.map(({ path, label, icon: Icon }) => (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className="flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm font-medium text-slate-100 touch-manipulation hover:border-cyan-500/40"
              >
                <Icon className="h-6 w-6 text-cyan-400" />
                {label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
