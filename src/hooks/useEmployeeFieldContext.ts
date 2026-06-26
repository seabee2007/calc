import { useCallback, useEffect, useState } from 'react';
import {
  getEmployeeFieldContext,
  type EmployeeFieldContext,
} from '../services/employeeFieldContextService';

export function useEmployeeFieldContext(enabled = true) {
  const [context, setContext] = useState<EmployeeFieldContext | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setContext(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getEmployeeFieldContext();
      setContext(next);
      return next;
    } catch {
      setError('Could not load field profile context.');
      setContext(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { context, loading, error, refresh };
}
