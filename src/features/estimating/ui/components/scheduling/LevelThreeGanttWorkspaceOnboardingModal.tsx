interface Props {
  onContinue: () => void;
  onEnterFullscreen: () => void;
}

export default function LevelThreeGanttWorkspaceOnboardingModal({
  onContinue,
  onEnterFullscreen,
}: Props) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-labelledby="level-three-gantt-workspace-title"
        aria-modal="true"
      >
        <h2
          id="level-three-gantt-workspace-title"
          className="text-lg font-semibold text-slate-900 dark:text-slate-100"
        >
          Level III Gantt Workspace
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          For the best experience, use full screen while reviewing the Level III Gantt.
        </p>

        <ul className="mt-4 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>
            <span className="font-medium text-slate-800 dark:text-slate-200">Press F</span> for full
            screen
          </li>
          <li>
            <span className="font-medium text-slate-800 dark:text-slate-200">Press Esc</span> to
            exit full screen
          </li>
        </ul>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={onContinue}
          >
            Continue
          </button>
          <button
            type="button"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
            onClick={onEnterFullscreen}
          >
            Enter full screen
          </button>
        </div>
      </div>
    </div>
  );
}
