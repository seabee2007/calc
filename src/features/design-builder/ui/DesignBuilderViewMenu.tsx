import {
  CommandMenuAction,
  DesignBuilderCommandMenu,
} from './DesignBuilderCommandMenu';

export type DesignBuilderViewerHeightPreset = 'fit' | '60' | '80' | 'full';

const VIEWER_HEIGHT_PRESETS: DesignBuilderViewerHeightPreset[] = [
  'fit',
  '60',
  '80',
  'full',
];

type DesignBuilderViewMenuProps = {
  onFitView: () => void;
  onResetView: () => void;
  onApplyViewerHeightPreset: (preset: DesignBuilderViewerHeightPreset) => void;
  onCloseFootprint: () => void;
  closeFootprintEnabled: boolean;
  onHelp: () => void;
};

export function DesignBuilderViewMenu({
  onFitView,
  onResetView,
  onApplyViewerHeightPreset,
  onCloseFootprint,
  closeFootprintEnabled,
  onHelp,
}: DesignBuilderViewMenuProps) {
  return (
    <DesignBuilderCommandMenu
      menuKind="view"
      label={<>View</>}
      panelClassName="w-56 p-2"
      summaryClassName="flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <CommandMenuAction
        onClick={onFitView}
        className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Fit
      </CommandMenuAction>
      <CommandMenuAction
        onClick={onResetView}
        className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Reset view
      </CommandMenuAction>
      {VIEWER_HEIGHT_PRESETS.map((preset) => (
        <CommandMenuAction
          key={preset}
          onClick={() => onApplyViewerHeightPreset(preset)}
          className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {preset === 'fit'
            ? 'Fit height'
            : preset === 'full'
              ? 'Full height'
              : `${preset}%`}
        </CommandMenuAction>
      ))}
      <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
      <CommandMenuAction
        onClick={onCloseFootprint}
        disabled={!closeFootprintEnabled}
        className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Close Footprint
      </CommandMenuAction>
      <CommandMenuAction
        onClick={onHelp}
        className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Help
      </CommandMenuAction>
    </DesignBuilderCommandMenu>
  );
}
