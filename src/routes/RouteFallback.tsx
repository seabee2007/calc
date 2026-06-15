import React from 'react';

/** Shared Suspense fallback for lazy-loaded routes and overlays. */
export default function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-transparent">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
    </div>
  );
}
