import type { ReactNode } from 'react';

interface OnboardingShellProps {
  children: ReactNode;
}

export default function OnboardingShell({ children }: OnboardingShellProps) {
  return (
    <main className="onboarding-page min-h-screen bg-[#020617] text-white">
      <div
        className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,#020617_0%,#0f172a_48%,#111827_100%)]"
        aria-hidden
      />
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_75%_20%,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_15%_85%,rgba(14,165,233,0.10),transparent_35%)]"
        aria-hidden
      />
      <div className="relative flex min-h-screen flex-col pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {children}
        </div>
      </div>
    </main>
  );
}
