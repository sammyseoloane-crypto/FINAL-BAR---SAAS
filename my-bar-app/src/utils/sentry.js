/**
 * Sentry Configuration for Error Monitoring
 * Tracks errors, performance, and user sessions
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';
import React from 'react';
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development';
const RELEASE = import.meta.env.VITE_APP_VERSION || '1.0.0';

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured. Error monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: `bar-saas@${RELEASE}`,

    // Performance Monitoring
    integrations: [
      new BrowserTracing({
        // Track navigation performance
        tracingOrigins: [
          'localhost',
          /^\//,
          /^https:\/\/.*\.supabase\.co/,
          /^https:\/\/.*\.stripe\.com/,
        ],
        // Track React Router
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        ),
      }),
      new Sentry.Replay({
        // Session replay for debugging
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Sample rates
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions

    // Error filtering
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      // Network errors
      'Network request failed',
      'Failed to fetch',
      // Aborted requests
      'AbortError',
      'The user aborted a request',
      // Common third-party errors
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],

    // Before send hook for filtering
    beforeSend(event, hint) {
      // Don't send errors in development
      if (ENVIRONMENT === 'development') {
        console.error('Sentry Event:', event, hint);
        return null;
      }

      // Filter out known issues
      if (event.exception) {
        const exceptionValue = event.exception.values?.[0]?.value || '';

        // Ignore specific error messages
        if (exceptionValue.includes('ResizeObserver')) {
          return null;
        }
      }

      // Add user context
      const user = getCurrentUser();
      if (user) {
        event.user = {
          id: user.id,
          email: user.email,
          tenant_id: user.tenant_id,
          role: user.role,
        };
      }

      return event;
    },

    // Before breadcrumb hook
    beforeBreadcrumb(breadcrumb, _hint) {
      // Don't log PII in breadcrumbs
      if (breadcrumb.category === 'console') {
        return null;
      }
      return breadcrumb;
    },
  });

  // Set global context
  Sentry.setContext('app', {
    name: 'Multi-Tenant Bar SaaS',
    version: RELEASE,
    environment: ENVIRONMENT,
  });
}

// Helper to get current user (implement based on your auth system)
function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

// Export utility functions
export const captureException = Sentry.captureException;
export const captureMessage = Sentry.captureMessage;
export const setUser = Sentry.setUser;
export const setContext = Sentry.setContext;
export const addBreadcrumb = Sentry.addBreadcrumb;

// Error boundary component
export const ErrorBoundary = Sentry.ErrorBoundary;

// Performance monitoring
export function startTransaction(name, op = 'custom') {
  return Sentry.startTransaction({ name, op });
}

export function measurePerformance(name, fn) {
  const transaction = startTransaction(name);
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.finally(() => transaction.finish());
    }
    transaction.finish();
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    transaction.finish();
    throw error;
  }
}

// Custom error handlers
export function handlePaymentError(error, context = {}) {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'payment');
    scope.setContext('payment', context);
    Sentry.captureException(error);
  });
}

export function handleDatabaseError(error, query = '') {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'database');
    scope.setContext('database', { query });
    Sentry.captureException(error);
  });
}

export function handleAuthError(error, context = {}) {
  Sentry.withScope((scope) => {
    scope.setTag('error_type', 'authentication');
    scope.setContext('auth', context);
    Sentry.captureException(error);
  });
}

// Track custom events
export function trackEvent(eventName, data = {}) {
  Sentry.addBreadcrumb({
    category: 'custom',
    message: eventName,
    data,
    level: 'info',
  });
}

// Track API calls
export function trackAPICall(url, method, status, duration) {
  Sentry.addBreadcrumb({
    category: 'http',
    type: 'http',
    data: {
      url,
      method,
      status_code: status,
      duration_ms: duration,
    },
    level: status >= 400 ? 'error' : 'info',
  });
}
