import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFieldActivityForProject } from '../../services/fieldActivityService';
import { subscribePlannerRecordsChanged } from '../../utils/plannerRecordsRefresh';
import type { FieldActivityItem } from '../../types/fieldPlanner';
import {
  PLANNER_ACTIVITY_STRIP,
  PLANNER_ACTIVITY_SUMMARY,
  PLANNER_ACTIVITY_TIME,
  PLANNER_ACTIVITY_TITLE,
  PLANNER_LINK,
} from '../planner/plannerTheme';

export default function ProjectFieldActivityStrip({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<FieldActivityItem[]>([]);

  const load = useCallback(async () => {
    const loaded = await getFieldActivityForProject(projectId, 3);
    setItems(loaded);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () =>
      subscribePlannerRecordsChanged((detail) => {
        if (detail.projectId === projectId) void load();
      }),
    [load, projectId],
  );

  if (items.length === 0) return null;

  return (
    <div className={PLANNER_ACTIVITY_STRIP}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={PLANNER_ACTIVITY_TITLE}>Recent field updates</h3>
        <Link to={`/projects/${projectId}/planner/board`} className={PLANNER_LINK}>
          Open planner →
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <span className={PLANNER_ACTIVITY_SUMMARY}>{item.summary}</span>
            <span className={`block mt-0.5 ${PLANNER_ACTIVITY_TIME}`}>
              {new Date(item.timestamp).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
