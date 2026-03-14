import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initSentry, ErrorBoundary } from './utils/sentry.js';
import { initializeMonitoring } from './utils/monitoring.js';
import { setupGlobalErrorHandlers } from './utils/errorHandler.js';

// Initialize error tracking and monitoring
initSentry();
initializeMonitoring();

// Setup global error handlers for unhandled errors
setupGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
