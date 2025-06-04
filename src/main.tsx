// src/main.tsx

import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
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
      <App />
    </BrowserRouter>
  </StrictMode>
);
