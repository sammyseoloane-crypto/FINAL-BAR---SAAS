/**
 * Edge Function Monitoring Utilities
 * Error tracking and alerting for Supabase Edge Functions
 */

// Deno type declarations for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Alert Severity Levels
 */
export enum AlertSeverity {
  CRITICAL = 'critical',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Alert Categories
 */
export enum AlertCategory {
  PAYMENT = 'payment',
  WEBHOOK = 'webhook',
  DATABASE = 'database',
  API = 'api',
  AUTH = 'authentication',
  SECURITY = 'security',
}

interface ErrorContext {
  [key: string]: any;
}

interface MonitoringConfig {
  sentryDsn?: string;
  environment?: string;
  enableConsoleLogging?: boolean;
}

/**
 * Monitoring class for Edge Functions
 */
export class EdgeFunctionMonitor {
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig = {}) {
    this.config = {
      sentryDsn: Deno.env.get('SENTRY_DSN'),
      environment: Deno.env.get('ENVIRONMENT') || 'production',
      enableConsoleLogging: true,
      ...config,
    };
  }

  /**
   * Track payment failures
   */
  async trackPaymentFailure(error: Error, context: ErrorContext = {}) {
    const errorInfo = {
      message: error.message || 'Payment processing failed',
      severity: AlertSeverity.CRITICAL,
      category: AlertCategory.PAYMENT,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (this.config.enableConsoleLogging) {
      console.error('💳 PAYMENT FAILURE:', JSON.stringify(errorInfo, null, 2));
    }

    await this.sendToSentry(error, {
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

    return errorInfo;
  }

  /**
   * Track webhook failures
   */
  async trackWebhookFailure(error: Error, context: ErrorContext = {}) {
    const errorInfo = {
      message: error.message || 'Webhook processing failed',
      severity: AlertSeverity.CRITICAL,
      category: AlertCategory.WEBHOOK,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (this.config.enableConsoleLogging) {
      console.error('🎣 WEBHOOK FAILURE:', JSON.stringify(errorInfo, null, 2));
    }

    await this.sendToSentry(error, {
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
          signatureValid: context.signatureValid,
        },
      },
      fingerprint: ['webhook-failure', context.eventType || 'unknown'],
    });

    return errorInfo;
  }

  /**
   * Track database errors
   */
  async trackDatabaseError(error: Error, context: ErrorContext = {}) {
    const errorInfo = {
      message: error.message || 'Database operation failed',
      severity: AlertSeverity.ERROR,
      category: AlertCategory.DATABASE,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (this.config.enableConsoleLogging) {
      console.error('🗄️ DATABASE ERROR:', JSON.stringify(errorInfo, null, 2));
    }

    await this.sendToSentry(error, {
      level: 'error',
      tags: {
        category: AlertCategory.DATABASE,
        severity: AlertSeverity.ERROR,
        operation: context.operation,
        table: context.table,
      },
      contexts: {
        database: {
          operation: context.operation,
          table: context.table,
          errorCode: context.code,
          errorDetails: context.details,
          hint: context.hint,
        },
      },
      fingerprint: ['database-error', context.table || 'unknown', context.operation || 'unknown'],
    });

    return errorInfo;
  }

  /**
   * Track API errors
   */
  async trackAPIError(error: Error, context: ErrorContext = {}) {
    const errorInfo = {
      message: error.message || 'API request failed',
      severity: (context.statusCode >= 500) ? AlertSeverity.CRITICAL : AlertSeverity.ERROR,
      category: AlertCategory.API,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (this.config.enableConsoleLogging) {
      console.error('🌐 API ERROR:', JSON.stringify(errorInfo, null, 2));
    }

    await this.sendToSentry(error, {
      level: (context.statusCode >= 500) ? 'error' : 'warning',
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

    return errorInfo;
  }

  /**
   * Track authentication failures
   */
  async trackAuthError(error: Error, context: ErrorContext = {}) {
    const errorInfo = {
      message: error.message || 'Authentication failed',
      severity: AlertSeverity.WARNING,
      category: AlertCategory.AUTH,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (this.config.enableConsoleLogging) {
      console.warn('🔐 AUTH ERROR:', JSON.stringify(errorInfo, null, 2));
    }

    await this.sendToSentry(error, {
      level: 'warning',
      tags: {
        category: AlertCategory.AUTH,
        severity: AlertSeverity.WARNING,
        authType: context.authType,
      },
      contexts: {
        auth: {
          authType: context.authType,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      },
      fingerprint: ['auth-error', context.authType || 'unknown'],
    });

    return errorInfo;
  }

  /**
   * Track security issues
   */
  async trackSecurityIssue(message: string, context: ErrorContext = {}) {
    const errorInfo = {
      message,
      severity: AlertSeverity.CRITICAL,
      category: AlertCategory.SECURITY,
      timestamp: new Date().toISOString(),
      ...context,
    };

    if (this.config.enableConsoleLogging) {
      console.error('🚨 SECURITY ISSUE:', JSON.stringify(errorInfo, null, 2));
    }

    await this.sendToSentry(new Error(message), {
      level: 'error',
      tags: {
        category: AlertCategory.SECURITY,
        severity: AlertSeverity.CRITICAL,
        issueType: context.issueType,
      },
      contexts: {
        security: {
          issueType: context.issueType,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          attemptedAction: context.attemptedAction,
          userId: context.userId,
        },
      },
      fingerprint: ['security-issue', context.issueType || 'unknown'],
    });

    return errorInfo;
  }

  /**
   * Send error to Sentry
   * Simplified implementation for Edge Functions
   */
  private async sendToSentry(error: Error, context: any) {
    if (!this.config.sentryDsn) {
      console.warn('⚠️ Sentry DSN not configured. Skipping Sentry integration.');
      return;
    }

    try {
      // Parse Sentry DSN
      const dsn = new URL(this.config.sentryDsn);
      const project = dsn.pathname.replace('/', '');
      const sentryEndpoint = `${dsn.protocol}//${dsn.host}/api/${project}/store/`;

      const payload = {
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: new Date().toISOString(),
        platform: 'javascript',
        environment: this.config.environment,
        level: context.level || 'error',
        exception: {
          values: [{
            type: error.name || 'Error',
            value: error.message,
            stacktrace: {
              frames: this.parseStackTrace(error.stack),
            },
          }],
        },
        tags: context.tags || {},
        contexts: context.contexts || {},
        fingerprint: context.fingerprint || ['{{ default }}'],
      };

      // Send to Sentry
      await fetch(sentryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, ` +
            `sentry_client=edge-function-monitor/1.0.0, ` +
            `sentry_key=${dsn.username}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Don't throw - monitoring should never break the function
      console.error('Failed to send error to Sentry:', err);
    }
  }

  /**
   * Parse stack trace for Sentry
   */
  private parseStackTrace(stack?: string): any[] {
    if (!stack) return [];

    const frames = stack
      .split('\n')
      .slice(1) // Skip error message line
      .map((line) => {
        const match = line.match(/at (.+?) \((.+?):(\d+):(\d+)\)/);
        if (match) {
          return {
            function: match[1],
            filename: match[2],
            lineno: parseInt(match[3]),
            colno: parseInt(match[4]),
          };
        }
        return null;
      })
      .filter(Boolean);

    return frames.reverse(); // Sentry wants oldest frame first
  }
}

/**
 * Create a global monitor instance
 */
export const monitor = new EdgeFunctionMonitor();

/**
 * Helper functions for common use cases
 */
export const trackPaymentFailure = (error: Error, context?: ErrorContext) =>
  monitor.trackPaymentFailure(error, context);

export const trackWebhookFailure = (error: Error, context?: ErrorContext) =>
  monitor.trackWebhookFailure(error, context);

export const trackDatabaseError = (error: Error, context?: ErrorContext) =>
  monitor.trackDatabaseError(error, context);

export const trackAPIError = (error: Error, context?: ErrorContext) =>
  monitor.trackAPIError(error, context);

export const trackAuthError = (error: Error, context?: ErrorContext) =>
  monitor.trackAuthError(error, context);

export const trackSecurityIssue = (message: string, context?: ErrorContext) =>
  monitor.trackSecurityIssue(message, context);
