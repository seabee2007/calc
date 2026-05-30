import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  MessageSquare,
  FileQuestion,
  Wrench,
  Upload,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getOwnerFieldSummary } from '../../services/fieldActivityService';
import OpsStatCard from '../dashboard/OpsStatCard';

export default function OwnerFieldSummaryCards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState({
    openTasks: 0,
    tasksNeedingReview: 0,
    openRfis: 0,
    pendingAdjustments: 0,
    newMessages: 0,
    recentUploads: 0,
  });

  useEffect(() => {
    if (!user) return;
    void getOwnerFieldSummary(user.id).then(setSummary);
  }, [user]);

  const cards = [
    {
      label: 'Open Tasks',
      value: summary.openTasks,
      icon: ClipboardList,
      onClick: () => navigate('/planner/hub'),
    },
    {
      label: 'Needs Review',
      value: summary.tasksNeedingReview,
      icon: CheckSquare,
      onClick: () => navigate('/owner/review'),
    },
    {
      label: 'Open RFIs',
      value: summary.openRfis,
      icon: FileQuestion,
      onClick: () => navigate('/owner/review'),
    },
    {
      label: 'Field Adjustments',
      value: summary.pendingAdjustments,
      icon: Wrench,
      onClick: () => navigate('/owner/review'),
    },
    {
      label: 'New Messages',
      value: summary.newMessages,
      icon: MessageSquare,
      onClick: () => navigate('/employee/messages'),
    },
    {
      label: 'Recent Uploads',
      value: summary.recentUploads,
      icon: Upload,
      onClick: () => navigate('/owner/review'),
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <button key={c.label} type="button" onClick={c.onClick} className="text-left">
            <OpsStatCard
              label={c.label}
              value={String(c.value)}
              icon={<Icon className="h-5 w-5 text-cyan-400" />}
              accent="cyan"
            />
          </button>
        );
      })}
    </section>
  );
}
