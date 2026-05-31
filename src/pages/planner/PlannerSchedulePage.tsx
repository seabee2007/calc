import React from 'react';
import { useParams } from 'react-router-dom';
import ScheduleWorkspacePage from './ScheduleWorkspacePage';

/** Project-scoped schedule tab — same workspace with project filter locked. */
export default function PlannerSchedulePage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <ScheduleWorkspacePage lockedProjectId={projectId} />;
}
