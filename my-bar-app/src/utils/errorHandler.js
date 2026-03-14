/**
 * Global Error Handler
 * Production-grade error handling with logging and user notifications
 */

import { supabase } from '../supabaseClient';

export class AppError extends Error {
  constructor(message, code, statusCode, metadata) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Log error to database audit_logs table
 */
async function logErrorToDatabase(error) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Get tenant_id from user profile if available
    let tenantId = error.tenant_id;
    if (user && !tenantId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      tenantId = profile?.tenant_id;
    }

    // Log to audit_logs table using the log_audit_action function
    if (user && tenantId) {
      await supabase.rpc('log_audit_action', {
        p_action: 'ERROR',
        p_resource_type: 'application_error',
        p_resource_id: null,
        p_metadata: {
          message: error.message,
          code: error.code,
          severity: error.severity,
          stack: error.stack,
          page_url: error.page_url,
          user_agent: error.user_agent,
          ...error.metadata,
        },
      });
    }
  } catch (logError) {
    // Silently fail if logging fails - don't want to throw errors while handling errors
    console.error('Failed to log error to database:', logError);
  }
}

/**
 * Log error to console with formatting
 */
function logErrorToConsole(error, severity) {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    severity,
    message: error.message,
    code: error.code,
    stack: error.stack,
    metadata: error.metadata,
  };

  switch (severity) {
    case ErrorSeverity.CRITICAL:
      console.error('🚨 CRITICAL ERROR:', errorInfo);
      break;
    case ErrorSeverity.HIGH:
      console.error('❌ HIGH SEVERITY:', errorInfo);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('⚠️ MEDIUM SEVERITY:', errorInfo);
      break;
    case ErrorSeverity.LOW:
      // Low severity info logged silently
      break;
  }
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error) {
  // Check for common error patterns
  if (error.message.includes('PGRST')) {
    return 'Database error. Please try again or contact support.';
  }

  if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
    return 'Network connection issue. Please check your internet connection.';
  }

  if (error.message.includes('CORS')) {
    return 'Connection blocked. Please contact support.';
  }

  if (error.message.includes('JWT') || error.message.includes('token')) {
    return 'Session expired. Please log in again.';
  }

  // Return custom message if AppError, otherwise generic message
  if (error instanceof AppError && error.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determine error severity based on error type
 */
function determineErrorSeverity(error) {
  if (error instanceof AppError && error.statusCode) {
    if (error.statusCode >= 500) {
      return ErrorSeverity.CRITICAL;
    }
    if (error.statusCode >= 400) {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  // Check error message for severity indicators
  const message = error.message.toLowerCase();

  if (message.includes('critical') || message.includes('fatal')) {
    return ErrorSeverity.CRITICAL;
  }

  if (message.includes('database') || message.includes('auth') || message.includes('payment')) {
    return ErrorSeverity.HIGH;
  }

  if (message.includes('validation') || message.includes('not found')) {
    return ErrorSeverity.LOW;
  }

  return ErrorSeverity.MEDIUM;
}

/**
 * Main error handler
 * Use this throughout your application to handle errors consistently
 */
export async function handleError(error, context, _showToUser = true) {
  const severity = determineErrorSeverity(error);
  const userMessage = getUserFriendlyMessage(error);

  // Log to console
  logErrorToConsole(error, severity);

  // Log to database
  const errorLog = {
    message: error.message,
    code: error.code,
    severity,
    stack: error.stack,
    page_url: window.location.href,
    user_agent: navigator.userAgent,
    metadata: {
      context,
      ...error.metadata,
    },
  };

  await logErrorToDatabase(errorLog);

  // For critical errors, you might want to send to external monitoring service
  if (severity === ErrorSeverity.CRITICAL) {
    // TODO: Send to Sentry, LogRocket, or other monitoring service
    console.error('Critical error detected - should alert monitoring service');
  }

  return userMessage;
}

/**
 * Global unhandled error handler
 * Set up in your main.jsx/main.tsx
 */
export function setupGlobalErrorHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    handleError(
      new Error(event.reason?.message || 'Unhandled promise rejection'),
      'unhandled_promise',
    );
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    event.preventDefault();
    handleError(event.error || new Error(event.message), 'global_error');
  });
}

/**
 * Async operation wrapper with error handling
 */
export async function withErrorHandling(operation, context, fallbackValue) {
  try {
    return await operation();
  } catch (error) {
    await handleError(error, context);
    return fallbackValue;
  }
}

/**
 * Supabase error parser
 * Extracts useful information from Supabase errors
 */
export function parseSupabaseError(error) {
  const message = error.message || 'Database error occurred';
  const code = error.code || 'UNKNOWN_ERROR';
  const statusCode = error.status || 500;

  return new AppError(message, code, statusCode, {
    hint: error.hint,
    details: error.details,
  });
}

/**
 * HTTP error parser
 */
export function parseHTTPError(response, body) {
  const message = body?.message || body?.error || `HTTP ${response.status}: ${response.statusText}`;

  return new AppError(
    message,
    `HTTP_${response.status}`,
    response.status,
    { body },
  );
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

export default {
  handleError,
  setupGlobalErrorHandlers,
  withErrorHandling,
  parseSupabaseError,
  parseHTTPError,
  retryWithBackoff,
  AppError,
  ErrorSeverity,
};
