import React from 'react';

interface AppLoadingScreenProps {
  message?: string;
}

/**
 * Branded dark loading screen used during auth session restore, app bootstrap,
 * and any full-page loading gate. Never shows a white background.
 */
export default function AppLoadingScreen({
  message = 'Loading your workspace\u2026',
}: AppLoadingScreenProps) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_40px_rgba(34,211,238,0.18)]">
          <span className="text-lg font-black tracking-widest text-cyan-200">A</span>
        </div>

        <div>
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-cyan-300">
            Arden Project OS
          </p>
          <p className="mt-2 text-sm text-slate-400">{message}</p>
        </div>

        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
      </div>
    </div>
  );
}
