/** Shared top bar styles (main site + Field Planner workspace). */
export const APP_NAV_HEADER =
  'flex h-12 shrink-0 items-center justify-between gap-2 bg-black px-2 text-white sm:gap-3 sm:px-4';

export function appNavIconButtonClass(active = false): string {
  return [
    'h-9 w-9 rounded-md p-1.5 transition-colors',
    active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
  ].join(' ');
}

export const APP_NAV_MOBILE_MENU =
  'md:hidden fixed left-0 right-0 z-[100] border-t border-slate-800 bg-slate-900 shadow-xl';
