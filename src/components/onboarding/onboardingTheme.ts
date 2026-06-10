/** Shared Concrete Calc onboarding dark theme — matches auth/landing brand. */

export const ONBOARDING_INPUT =
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:bg-slate-900/60 disabled:text-slate-400 disabled:border-white/10';

export const ONBOARDING_SELECT =
  `${ONBOARDING_INPUT} appearance-none bg-no-repeat bg-[center_right_1rem] bg-[length:1.5em_1.5em] bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")]`;

export const ONBOARDING_FIELD_GROUP =
  '[&_label]:mb-1 [&_label]:block [&_label]:text-sm [&_label]:font-medium [&_label]:text-slate-200 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-white/10 [&_input]:bg-slate-950/70 [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_input]:text-white [&_input]:placeholder:text-slate-500 [&_input]:outline-none [&_input]:transition [&_input]:focus:border-cyan-400/60 [&_input]:focus:ring-2 [&_input]:focus:ring-cyan-400/20 [&_input]:disabled:cursor-not-allowed [&_input]:disabled:bg-slate-900/60 [&_input]:disabled:text-slate-400 [&_input]:disabled:border-white/10 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-white/10 [&_select]:bg-slate-950/70 [&_select]:px-4 [&_select]:py-3 [&_select]:text-sm [&_select]:text-white [&_select]:outline-none [&_select]:transition [&_select]:focus:border-cyan-400/60 [&_select]:focus:ring-2 [&_select]:focus:ring-cyan-400/20 [&_select]:disabled:cursor-not-allowed [&_select]:disabled:bg-slate-900/60 [&_select]:disabled:text-slate-400';

export const ONBOARDING_CARD =
  'rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8';

export const ONBOARDING_TITLE = 'text-3xl font-bold text-white sm:text-4xl';

export const ONBOARDING_SUBTITLE = 'text-lg leading-relaxed text-slate-300 sm:text-xl';

export const ONBOARDING_PRIMARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:from-cyan-300 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-50';

export const ONBOARDING_SECONDARY_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-3 font-semibold text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10';

export const ONBOARDING_SKIP_BUTTON =
  'px-4 py-3 font-semibold text-slate-300 transition hover:text-cyan-300';

export const ONBOARDING_FOOTER =
  'sticky bottom-0 -mx-4 mt-auto border-t border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+1rem)]';

export const ONBOARDING_ERROR =
  'rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300';

export const ONBOARDING_HELP_TEXT = 'text-sm text-slate-300';

export const ONBOARDING_BRAND_GRADIENT =
  'bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-300 bg-clip-text text-transparent';
