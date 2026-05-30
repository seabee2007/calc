import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/** Preserves ?task= when redirecting /planner → /planner/board */
export default function PlannerIndexRedirect() {
  const [searchParams] = useSearchParams();
  const task = searchParams.get('task');
  const query = task ? `?task=${encodeURIComponent(task)}` : '';
  return <Navigate to={`board${query}`} replace />;
}
