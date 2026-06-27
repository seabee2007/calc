export type DesignBuilderStatusTone = 'info' | 'success' | 'error';

export type DesignBuilderPageStatus = {
  tone: DesignBuilderStatusTone;
  message: string;
};

export function statusClassName(tone: DesignBuilderStatusTone): string {
  const base = 'rounded-xl border px-4 py-3 text-sm';
  if (tone === 'success') {
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200`;
  }
  if (tone === 'error') {
    return `${base} border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200`;
  }
  return `${base} border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200`;
}
