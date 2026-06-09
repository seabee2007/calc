import React from 'react';

const DEBUG_ENDPOINT = 'http://127.0.0.1:7822/ingest/f8847b5c-ebf8-4ffb-8ef5-2ae8f29ce67d';
const DEBUG_SESSION_ID = 'd0c8c0';

export function emitDebugLog(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>,
  runId = 'pre-fix',
) {
  const payload = {
    sessionId: DEBUG_SESSION_ID,
    runId,
    hypothesisId,
    location: 'debugBootstrap.ts',
    message,
    data,
    timestamp: Date.now(),
  };

  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion

  try {
    sessionStorage.setItem(
      'cc-debug-last-log',
      JSON.stringify({ ...payload, route: window.location.pathname }),
    );
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

function describeChild(child: unknown): Record<string, unknown> {
  if (child === null) return { kind: 'null' };
  if (child === undefined) return { kind: 'undefined' };
  if (child === false) return { kind: 'boolean-false' };
  if (child === true) return { kind: 'boolean-true' };
  if (typeof child === 'string') return { kind: 'string', preview: child.slice(0, 80) };
  if (typeof child === 'number') return { kind: 'number', value: child };
  if (Array.isArray(child)) return { kind: 'array', length: child.length };
  if (React.isValidElement(child)) {
    return {
      kind: 'element',
      type:
        typeof child.type === 'string'
          ? child.type
          : (child.type as { displayName?: string; name?: string })?.displayName ??
            (child.type as { name?: string })?.name ??
            'component',
    };
  }
  return { kind: typeof child };
}

export function installDebugBootstrap() {
  const originalOnly = React.Children.only.bind(React.Children);

  React.Children.only = (children: React.ReactNode) => {
    if (!React.isValidElement(children)) {
      const stack = new Error('Children.only probe').stack ?? '';
      // #region agent log
      emitDebugLog('H1', 'React.Children.only received invalid child', {
        route: window.location.pathname,
        userAgent: navigator.userAgent,
        child: describeChild(children),
        stack: stack.split('\n').slice(0, 12).join('\n'),
      });
      // #endregion
    }
    return originalOnly(children);
  };

  window.addEventListener('error', (event) => {
    const message = event.error instanceof Error ? event.error.message : String(event.message);
    // #region agent log
    emitDebugLog('H2', 'window error', {
      route: window.location.pathname,
      userAgent: navigator.userAgent,
      message,
      stack: event.error instanceof Error ? event.error.stack?.split('\n').slice(0, 12).join('\n') : undefined,
      script: event.filename,
    });
    // #endregion
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    // #region agent log
    emitDebugLog('H3', 'unhandled rejection', {
      route: window.location.pathname,
      userAgent: navigator.userAgent,
      message,
      stack: reason instanceof Error ? reason.stack?.split('\n').slice(0, 12).join('\n') : undefined,
    });
    // #endregion
  });

  let bootSnapshot: unknown = null;
  let lastPreMainError: unknown = null;
  try {
    bootSnapshot = JSON.parse(sessionStorage.getItem('cc-boot') ?? 'null');
    lastPreMainError = JSON.parse(sessionStorage.getItem('cc-last-error') ?? 'null');
  } catch {
    // ignore parse failures
  }

  // #region agent log
  emitDebugLog(
    'H4',
    'bootstrap complete',
    {
      route: window.location.pathname,
      href: window.location.href,
      userAgent: navigator.userAgent,
      reactVersion: React.version,
      viewportWidth: window.innerWidth,
      bootSnapshot,
      lastPreMainError,
    },
    'post-fix',
  );
  // #endregion
}
