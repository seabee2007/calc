import React from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';

/** /projects/:projectId/planner?task= → board with query preserved */
export function PlannerLegacyQueryRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const task = searchParams.get('task');
  const to = task
    ? `/projects/${projectId}/planner/board?task=${task}`
    : `/projects/${projectId}/planner/board`;
  return <Navigate to={to} replace />;
}

export function LegacyTaskDetailRedirect() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  return (
    <Navigate to={`/projects/${projectId}/planner/board?task=${taskId}`} replace />
  );
}
