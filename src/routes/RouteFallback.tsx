import React from 'react';

/** Shared Suspense fallback for lazy-loaded routes and overlays. */
export default function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-cyan-500" />
    </div>
  );
}
