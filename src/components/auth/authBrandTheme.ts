/** Shared Concrete Calc logged-out brand accent (cyan family). */
export const AUTH_ACCENT = {
  brandLabel: 'text-cyan-300/90',
  brandLabelMobile: 'text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90',
  brandLabelDesktop: 'text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300/90',
  link: 'font-medium text-cyan-300 transition-colors hover:text-cyan-200',
  backButton: '!text-slate-300 hover:!bg-white/5 hover:!text-cyan-300',
  checkIconWrapper:
    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/60 text-cyan-300',
  input:
    '!rounded-xl !border-white/10 !bg-slate-950/80 !text-slate-100 placeholder:!text-slate-500 focus:!border-cyan-400 focus:!ring-cyan-400/30 !shadow-none',
  primaryButton:
    '!rounded-2xl !border-0 !bg-gradient-to-r !from-cyan-400 !to-sky-500 !px-5 !py-3 !font-semibold !text-slate-950 !shadow-lg !shadow-cyan-500/20 hover:!from-cyan-300 hover:!to-sky-400 focus-visible:!ring-cyan-400',
  socialButtonDark:
    '!rounded-xl !border !border-white/10 !bg-slate-950/80 !text-white hover:!border-cyan-400/40 hover:!bg-slate-900/90 dark:!bg-slate-950/80 dark:!text-white dark:hover:!bg-slate-900/90',
  glowOverlay:
    'bg-[radial-gradient(circle_at_70%_45%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.14),transparent_35%)]',
  authCard:
    'relative rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-10',
  authCardGlow:
    'pointer-events-none absolute -inset-10 -z-10 rounded-[2rem] bg-cyan-500/10 blur-3xl',
  warningAlert: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
  verificationBox: 'rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4',
  verificationTitle: 'text-sm font-medium text-cyan-100',
  verificationIcon: 'mr-2 h-5 w-5 text-cyan-300',
  checkbox:
    'h-4 w-4 rounded border-white/20 bg-slate-950/80 text-cyan-500 focus:ring-cyan-400',
  featureIconBox:
    'mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300',
  featureCardHover:
    'group flex h-full w-full flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-5 text-left shadow-lg backdrop-blur-md transition-all hover:border-cyan-400/30 hover:bg-slate-900/80 hover:shadow-cyan-500/10 sm:p-6',
  featureLink:
    'mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-300 transition-colors group-hover:text-cyan-200',
  heroGradient: 'bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-600/10',
} as const;

export const authInputClassName = AUTH_ACCENT.input;
export const authPrimaryButtonClassName = AUTH_ACCENT.primaryButton;
export const authLinkClassName = AUTH_ACCENT.link;
