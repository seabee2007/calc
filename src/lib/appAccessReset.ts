/** Synchronous in-memory access reset — registered by AppAccessProvider at mount. */
let clearAccessCallback: (() => void) | null = null;

export function registerAppAccessClear(fn: () => void): void {
  clearAccessCallback = fn;
}

export function unregisterAppAccessClear(fn: () => void): void {
  if (clearAccessCallback === fn) {
    clearAccessCallback = null;
  }
}

export function clearResolvedAppAccess(): void {
  clearAccessCallback?.();
}
