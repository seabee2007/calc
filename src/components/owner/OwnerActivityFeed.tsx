import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getOwnerFieldActivity } from '../../services/fieldActivityService';
import { useFieldActivityDismissStore } from '../../store/fieldActivityDismissStore';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import type { FieldActivityItem } from '../../types/fieldPlanner';
import OpsCard from '../dashboard/OpsCard';
import Button from '../ui/Button';
import {
  OPS_LIST_ROW,
  OPS_MUTED,
  OPS_OUTLINE_BTN,
  OPS_TITLE,
} from '../dashboard/opsTheme';

const linkClass = 'text-sm font-medium text-cyan-400 hover:text-cyan-300';

const itemExit = (staggerIndex: number) => ({
  opacity: 0,
  height: 0,
  marginTop: 0,
  marginBottom: 0,
  paddingTop: 0,
  paddingBottom: 0,
  borderWidth: 0,
  transition: {
    duration: 0.22,
    delay: staggerIndex * 0.04,
    ease: 'easeInOut' as const,
  },
});

export default function OwnerActivityFeed({ limit = 8 }: { limit?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FieldActivityItem[]>([]);
  const [displayItems, setDisplayItems] = useState<FieldActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismiss = useFieldActivityDismissStore((s) => s.dismiss);
  const dismissAll = useFieldActivityDismissStore((s) => s.dismissAll);
  const dismissedByOwner = useFieldActivityDismissStore((s) => s.dismissedByOwner);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const loaded = await getOwnerFieldActivity(user.id, limit);
      console.log('[Field Activity] loaded', loaded.length, 'items', loaded);
      setItems(loaded);
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => subscribePlannerRecordsChanged(() => void load()), [load]);

  const visibleItems = useMemo(() => {
    if (!user) return [];
    const dismissed = new Set(dismissedByOwner[user.id] ?? []);
    return items.filter((item) => !dismissed.has(item.id));
  }, [items, user, dismissedByOwner]);

  useEffect(() => {
    if (!isClearingAll) {
      setDisplayItems(visibleItems);
    }
  }, [visibleItems, isClearingAll]);

  useEffect(
    () => () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    },
    [],
  );

  const handleOpen = (item: FieldActivityItem) => {
    if (!user) return;
    dismiss(user.id, item.id);
    navigate(item.href);
  };

  const handleClearAll = () => {
    if (!user || visibleItems.length === 0 || isClearingAll) return;

    const ids = visibleItems.map((item) => item.id);
    const staggerMs = Math.max(ids.length - 1, 0) * 40;
    const exitMs = 220 + staggerMs + 80;

    setIsClearingAll(true);
    setDisplayItems([]);

    if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    clearTimeoutRef.current = setTimeout(() => {
      dismissAll(user.id, ids);
      setIsClearingAll(false);
      clearTimeoutRef.current = null;
    }, exitMs);
  };

  const showList = !loading && displayItems.length > 0;
  const showEmpty = !loading && displayItems.length === 0 && !isClearingAll;

  return (
    <OpsCard className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Field activity
          </p>
          <p className={`text-sm ${OPS_MUTED}`}>Employee updates across your projects</p>
        </div>
        <Button
          variant="accent"
          size="sm"
          className="shrink-0"
          icon={<LayoutGrid className="h-4 w-4" />}
          onClick={() => navigate('/planner/hub')}
        >
          Open Planner Hub
        </Button>
      </div>

      {loading && <p className={`text-sm ${OPS_MUTED}`}>Loading…</p>}

      {showEmpty && (
        <p className={`text-sm ${OPS_MUTED}`}>No recent field updates.</p>
      )}

      {(showList || isClearingAll) && (
        <motion.ul layout className="space-y-2 overflow-hidden">
          <AnimatePresence initial={false}>
            {displayItems.map((item, index) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={itemExit(isClearingAll ? index : 0)}
                className={`flex flex-col gap-2 overflow-hidden rounded-lg px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${OPS_LIST_ROW}`}
              >
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${OPS_TITLE}`}>{item.summary}</p>
                  <p className={`text-xs ${OPS_MUTED}`}>
                    {item.projectName} · {item.employeeName} ·{' '}
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className={`shrink-0 ${OPS_OUTLINE_BTN}`}
                  onClick={() => handleOpen(item)}
                  disabled={isClearingAll}
                >
                  Open
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <div className="mt-3 flex items-center justify-end gap-4">
        {!loading && visibleItems.length > 0 && !isClearingAll && (
          <button type="button" onClick={handleClearAll} className={linkClass}>
            Clear all
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate('/owner/review')}
          className={linkClass}
        >
          View all →
        </button>
      </div>
    </OpsCard>
  );
}
