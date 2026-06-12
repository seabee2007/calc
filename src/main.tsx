// src/main.tsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { ConfirmProvider } from './contexts/ConfirmContext';
import RootErrorBoundary from './components/layout/RootErrorBoundary';
import './index.css';

// Initialize any required polyfills or global handlers
const initializeApp = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
  });

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
  <RootErrorBoundary>
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  </RootErrorBoundary>
);
