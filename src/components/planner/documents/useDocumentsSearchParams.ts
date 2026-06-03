import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DocumentsTabId } from './documentsTabConfig';

/** Merge URL params; preserve `tab` when embedded in Documents page. */
export function useDocumentsSearchParams(embedTab?: DocumentsTabId) {
  const [searchParams, setSearchParams] = useSearchParams();

  const mergeParams = useCallback(
    (patch: Record<string, string | null | undefined>, replace = true) => {
      const next = new URLSearchParams(searchParams);
      if (embedTab) next.set('tab', embedTab);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined) next.delete(key);
        else next.set(key, value);
      }
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams, embedTab],
  );

  return { searchParams, mergeParams };
}
