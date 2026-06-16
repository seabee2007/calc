import { useSyncExternalStore } from 'react';

/** Single-column threshold (below Tailwind's `md`). */
const QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** True when the viewport should render the dashboard as a single column. */
export function useIsNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
