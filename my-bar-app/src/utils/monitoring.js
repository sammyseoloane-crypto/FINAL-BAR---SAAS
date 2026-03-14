/**
 * Monitoring and Alerting Utilities
 * Centralized error tracking and alerting for critical failures
 */

import * as Sentry from '@sentry/react';

/**
 * Alert Severity Levels
 */
export const AlertSeverity = {
  CRITICAL: 'critical', // Requires immediate attention
  ERROR: 'error', // Important but not urgent
  WARNING: 'warning', // Should be reviewed
  INFO: 'info', // Informational only
};

/**
 * Alert Categories
 */
export const AlertCategory = {
  PAYMENT: 'payment',
  WEBHOOK: 'webhook',
  DATABASE: 'database',
  API: 'api',
  AUTH: 'authentication',
  SECURITY: 'security',
};

/**
 * Track Payment Failures
 * @param {Object} error - Error object
 * @param {Object} context - Payment context (amount, userId, etc.)
 */
export function trackPaymentFailure(error, context = {}) {
  const errorInfo = {
    message: error.message || 'Payment processing failed',
    severity: AlertSeverity.CRITICAL,
    category: AlertCategory.PAYMENT,
    ...context,
  };

  // Log to console for immediate visibility
  console.error('💳 PAYMENT FAILURE:', errorInfo);

  // Send to Sentry
  Sentry.captureException(error, {
    level: 'error',
    tags: {
      category: AlertCategory.PAYMENT,
      severity: AlertSeverity.CRITICAL,
    },
    contexts: {
      payment: {
        amount: context.amount,
        currency: context.currency,
        userId: context.userId,
        tenantId: context.tenantId,
        sessionId: context.sessionId,
        errorCode: context.errorCode,
      },
    },
    fingerprint: ['payment-failure', context.errorCode || 'unknown'],
  });

  // Log to database for audit trail
  logErrorToDatabase({
    type: 'payment_failure',
    severity: AlertSeverity.CRITICAL,
    message: error.message,
    context: errorInfo,
  });

  return errorInfo;
}

/**
 * Track Webhook Failures
 * @param {Object} error - Error object
 * @param {Object} context - Webhook context
 */
export function trackWebhookFailure(error, context = {}) {
  const errorInfo = {
    message: error.message || 'Webhook processing failed',
    severity: AlertSeverity.CRITICAL,
    category: AlertCategory.WEBHOOK,
    ...context,
  };

  console.error('🎣 WEBHOOK FAILURE:', errorInfo);

  Sentry.captureException(error, {
    level: 'error',
    tags: {
      category: AlertCategory.WEBHOOK,
      severity: AlertSeverity.CRITICAL,
      webhookType: context.eventType,
    },
    contexts: {
      webhook: {
        eventType: context.eventType,
        eventId: context.eventId,
        source: context.source || 'stripe',
        attemptNumber: context.attemptNumber || 1,
        signature: context.signatureValid ? 'valid' : 'invalid',
      },
    },
    fingerprint: ['webhook-failure', context.eventType || 'unknown'],
  });

  logErrorToDatabase({
    type: 'webhook_failure',
    severity: AlertSeverity.CRITICAL,
    message: error.message,
    context: errorInfo,
  });

  return errorInfo;
}

/**
 * Track Database Errors
 * @param {Object} error - Error object
 * @param {Object} context - Database operation context
 */
export function trackDatabaseError(error, context = {}) {
  const errorInfo = {
    message: error.message || 'Database operation failed',
    severity: AlertSeverity.ERROR,
    category: AlertCategory.DATABASE,
    ...context,
  };

  console.error('🗄️ DATABASE ERROR:', errorInfo);

  Sentry.captureException(error, {
    level: 'error',
    tags: {
      category: AlertCategory.DATABASE,
      severity: AlertSeverity.ERROR,
      operation: context.operation,
      table: context.table,
    },
    contexts: {
      database: {
        operation: context.operation, // select, insert, update, delete
        table: context.table,
        errorCode: error.code,
        errorDetails: error.details,
        hint: error.hint,
      },
    },
    fingerprint: ['database-error', context.table || 'unknown', context.operation || 'unknown'],
  });

  logErrorToDatabase({
    type: 'database_error',
    severity: AlertSeverity.ERROR,
    message: error.message,
    context: errorInfo,
  });

  return errorInfo;
}

/**
 * Track API Errors
 * @param {Object} error - Error object
 * @param {Object} context - API request context
 */
export function trackAPIError(error, context = {}) {
  const errorInfo = {
    message: error.message || 'API request failed',
    severity: context.statusCode >= 500 ? AlertSeverity.CRITICAL : AlertSeverity.ERROR,
    category: AlertCategory.API,
    ...context,
  };

  console.error('🌐 API ERROR:', errorInfo);

  Sentry.captureException(error, {
    level: context.statusCode >= 500 ? 'error' : 'warning',
    tags: {
      category: AlertCategory.API,
      severity: errorInfo.severity,
      statusCode: context.statusCode,
      endpoint: context.endpoint,
    },
    contexts: {
      api: {
        method: context.method,
        endpoint: context.endpoint,
        statusCode: context.statusCode,
        responseTime: context.responseTime,
        requestId: context.requestId,
      },
    },
    fingerprint: ['api-error', context.endpoint || 'unknown', String(context.statusCode)],
  });

  logErrorToDatabase({
    type: 'api_error',
    severity: errorInfo.severity,
    message: error.message,
    context: errorInfo,
  });

  return errorInfo;
}

/**
 * Track Authentication Failures
 * @param {Object} error - Error object
 * @param {Object} context - Auth context
 */
export function trackAuthError(error, context = {}) {
  const errorInfo = {
    message: error.message || 'Authentication failed',
    severity: AlertSeverity.WARNING,
    category: AlertCategory.AUTH,
    ...context,
  };

  console.warn('🔐 AUTH ERROR:', errorInfo);

  Sentry.captureException(error, {
    level: 'warning',
    tags: {
      category: AlertCategory.AUTH,
      severity: AlertSeverity.WARNING,
      authType: context.authType,
    },
    contexts: {
      auth: {
        authType: context.authType, // login, register, reset, etc.
        email: context.email ? `***@${context.email.split('@')[1]}` : undefined,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    },
    fingerprint: ['auth-error', context.authType || 'unknown'],
  });

  return errorInfo;
}

/**
 * Track Security Issues
 * @param {string} message - Security issue description
 * @param {Object} context - Security context
 */
export function trackSecurityIssue(message, context = {}) {
  const errorInfo = {
    message,
    severity: AlertSeverity.CRITICAL,
    category: AlertCategory.SECURITY,
    ...context,
  };

  console.error('🚨 SECURITY ISSUE:', errorInfo);

  Sentry.captureMessage(message, {
    level: 'error',
    tags: {
      category: AlertCategory.SECURITY,
      severity: AlertSeverity.CRITICAL,
      issueType: context.issueType,
    },
    contexts: {
      security: {
        issueType: context.issueType, // unauthorized_access, injection_attempt, etc.
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        attemptedAction: context.attemptedAction,
        userId: context.userId,
      },
    },
    fingerprint: ['security-issue', context.issueType || 'unknown'],
  });

  logErrorToDatabase({
    type: 'security_issue',
    severity: AlertSeverity.CRITICAL,
    message,
    context: errorInfo,
  });

  return errorInfo;
}

/**
 * Track Performance Issues
 * @param {string} metric - Performance metric name
 * @param {number} value - Metric value
 * @param {Object} context - Additional context
 */
export function trackPerformanceIssue(metric, value, context = {}) {
  const warningThresholds = {
    pageLoadTime: 3000, // 3 seconds
    apiResponseTime: 1000, // 1 second
    databaseQueryTime: 500, // 500ms
  };

  const threshold = warningThresholds[metric] || 1000;

  if (value > threshold) {
    console.warn(`⚡ PERFORMANCE WARNING: ${metric} = ${value}ms (threshold: ${threshold}ms)`);

    Sentry.captureMessage(`Performance issue: ${metric} exceeded threshold`, {
      level: 'warning',
      tags: {
        category: 'performance',
        metric,
      },
      contexts: {
        performance: {
          metric,
          value,
          threshold,
          ...context,
        },
      },
    });
  }
}

/**
 * Log error to database for audit trail
 * (Implement based on your database schema)
 */
async function logErrorToDatabase(_errorData) {
  try {
    // Only log in production to avoid cluttering dev database
    if (import.meta.env.VITE_ENVIRONMENT !== 'production') {
      return;
    }

    // This would be implemented with your actual database client
    // Example using Supabase:
    /*
    const { supabase } = await import('../supabaseClient');
    await supabase.from('error_logs').insert({
      type: _errorData.type,
      severity: _errorData.severity,
      message: _errorData.message,
      context: _errorData.context,
      created_at: new Date().toISOString(),
    });
    */
  } catch (err) {
    // Don't throw - logging should never break the app
    console.error('Failed to log error to database:', err);
  }
}

/**
 * Check system health and send alerts if issues detected
 */
export async function performHealthCheck() {
  const healthStatus = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check Supabase connectivity
  try {
    const { supabase } = await import('../supabaseClient');
    const { error } = await supabase.from('tenants').select('count').limit(1);

    healthStatus.checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      error: error?.message,
    };

    if (error) {
      trackDatabaseError(error, {
        operation: 'health-check',
        table: 'tenants',
      });
    }
  } catch (error) {
    healthStatus.checks.database = {
      status: 'unhealthy',
      error: error.message,
    };
    trackDatabaseError(error, {
      operation: 'health-check',
      table: 'connection',
    });
  }

  // Check API connectivity (example)
  try {
    const response = await fetch('/api/health', { timeout: 5000 });
    healthStatus.checks.api = {
      status: response.ok ? 'healthy' : 'unhealthy',
      statusCode: response.status,
    };

    if (!response.ok) {
      trackAPIError(new Error('API health check failed'), {
        endpoint: '/api/health',
        statusCode: response.status,
        method: 'GET',
      });
    }
  } catch (error) {
    healthStatus.checks.api = {
      status: 'unhealthy',
      error: error.message,
    };
  }

  return healthStatus;
}

/**
 * Initialize monitoring for the application
 */
export function initializeMonitoring() {
  // Set up global error handler
  window.addEventListener('error', (event) => {
    trackAPIError(event.error || new Error(event.message), {
      endpoint: 'global-error-handler',
      statusCode: 500,
    });
  });

  // Set up unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    trackAPIError(event.reason || new Error('Unhandled Promise Rejection'), {
      endpoint: 'unhandled-rejection',
      statusCode: 500,
    });
  });

  // Periodic health checks (every 5 minutes)
  if (import.meta.env.VITE_ENVIRONMENT === 'production') {
    setInterval(() => {
      performHealthCheck();
    }, 5 * 60 * 1000);
  }

  // eslint-disable-next-line no-console
  console.log('✅ Monitoring initialized');
}

/**
 * Create custom alert for specific conditions
 */
export function sendCustomAlert(title, message, severity = AlertSeverity.ERROR, context = {}) {
  // eslint-disable-next-line no-console
  console.log(`🔔 ALERT [${severity}]: ${title} - ${message}`);

  Sentry.captureMessage(`${title}: ${message}`, {
    level: severity === AlertSeverity.CRITICAL ? 'error' : 'warning',
    tags: {
      alertType: 'custom',
      severity,
    },
    contexts: {
      alert: {
        title,
        ...context,
      },
    },
  });
}

export default {
  trackPaymentFailure,
  trackWebhookFailure,
  trackDatabaseError,
  trackAPIError,
  trackAuthError,
  trackSecurityIssue,
  trackPerformanceIssue,
  performHealthCheck,
  initializeMonitoring,
  sendCustomAlert,
  AlertSeverity,
  AlertCategory,
};
