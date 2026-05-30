import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import {
  fetchAccessibleProjects,
  projectNameMap,
  type AccessibleProject,
} from '../utils/plannerAccess';

export function usePlannerAccessibleProjects() {
  const { user, isOwner, isEmployee } = useAuth();
  const [projects, setProjects] = useState<AccessibleProject[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchAccessibleProjects(user.id, { isOwner, isEmployee });
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, [user, isOwner, isEmployee]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);
  const names = useMemo(() => projectNameMap(projects), [projects]);

  return { projects, projectIds, projectNames: names, loading, reload };
}
