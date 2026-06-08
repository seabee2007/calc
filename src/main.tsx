// src/main.tsx

import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { ConfirmProvider } from './contexts/ConfirmContext';
import './index.css';

const debugLog = (
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>,
) => {
  // #region agent log
  fetch('http://127.0.0.1:7822/ingest/f8847b5c-ebf8-4ffb-8ef5-2ae8f29ce67d', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd0c8c0' }, body: JSON.stringify({ sessionId: 'd0c8c0', runId: 'pre-fix', hypothesisId, location: 'src/main.tsx', message, data, timestamp: Date.now() }) }).catch(() => {});
  // #endregion
};

// Initialize any required polyfills or global handlers
const initializeApp = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    debugLog('H4', 'Unhandled promise rejection', {
      path: window.location.pathname,
      reason: String(event.reason),
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
    });
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    debugLog('H1,H3,H4,H5', 'Global runtime error', {
      path: window.location.pathname,
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      scriptSrcs: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    });
  });

  debugLog('H1,H2,H5', 'Runtime bootstrap diagnostics', {
    path: window.location.pathname,
    reactVersion: React.version,
    hasReactChildren: Boolean(React.Children),
    hasReactCloneElement: typeof React.cloneElement === 'function',
    scriptSrcs: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
  });

  // Check if we're in Capacitor environment
  const isCapacitor = 'Capacitor' in window;
  if (isCapacitor) {
    console.log('Running in Capacitor environment');
    // Add any Capacitor-specific initialization here
  }
};

// Initialize the app
initializeApp();

// Get the root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

// Create and render root
const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
