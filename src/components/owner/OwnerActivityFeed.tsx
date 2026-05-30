import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getOwnerFieldActivity } from '../../services/fieldActivityService';
import type { FieldActivityItem } from '../../types/fieldPlanner';
import OpsCard from '../dashboard/OpsCard';
import Button from '../ui/Button';
import { OPS_MUTED } from '../dashboard/opsTheme';

export default function OwnerActivityFeed({ limit = 8 }: { limit?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FieldActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    void getOwnerFieldActivity(user.id, limit)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [user, limit]);

  return (
    <OpsCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Field activity
          </p>
          <p className={`text-sm ${OPS_MUTED}`}>Employee updates across your projects</p>
        </div>
        <Activity className="h-5 w-5 text-cyan-400/80" />
      </div>

      {loading && <p className={`text-sm ${OPS_MUTED}`}>Loading…</p>}

      {!loading && items.length === 0 && (
        <p className={`text-sm ${OPS_MUTED}`}>No recent field updates.</p>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-slate-700/80 bg-slate-800/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">{item.summary}</p>
              <p className={`text-xs ${OPS_MUTED}`}>
                {item.projectName} · {item.employeeName} ·{' '}
                {new Date(item.timestamp).toLocaleString()}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 !border-slate-600 !text-white"
              onClick={() => navigate(item.href)}
            >
              Open
            </Button>
          </li>
        ))}
      </ul>

      <div className="mt-3 text-right">
        <button
          type="button"
          onClick={() => navigate('/owner/review')}
          className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
        >
          View all →
        </button>
      </div>
    </OpsCard>
  );
}
