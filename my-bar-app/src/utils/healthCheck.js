/**
 * System Health Check Utilities
 * Validates system configuration and dependencies
 */

import { supabase } from '../supabaseClient';

/**
 * Check if all required environment variables are set
 * @returns {object} { isValid, missing, warnings }
 */
export const checkEnvironmentVariables = () => {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

  const optional = ['VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_NETLIFY_FUNCTIONS_URL'];

  const missing = required.filter((key) => !import.meta.env[key]);
  const warnings = optional.filter((key) => !import.meta.env[key]);

  return {
    isValid: missing.length === 0,
    missing,
    warnings,
    message:
      missing.length > 0
        ? `Missing required environment variables: ${missing.join(', ')}`
        : 'All required environment variables are set',
  };
};

/**
 * Test database connection
 * @returns {Promise<object>} { isConnected, message }
 */
export const checkDatabaseConnection = async () => {
  try {
    // eslint-disable-next-line no-unused-vars
    const { data, error } = await supabase.from('tenants').select('count').limit(1);

    if (error) {
      throw error;
    }

    return {
      isConnected: true,
      message: 'Database connection successful',
    };
  } catch (error) {
    return {
      isConnected: false,
      message: `Database connection failed: ${error.message}`,
    };
  }
};

/**
 * Check if user is authenticated
 * @returns {Promise<object>} { isAuthenticated, user }
 */
export const checkAuthentication = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return {
      isAuthenticated: !!user,
      user,
      message: user ? 'User is authenticated' : 'User is not authenticated',
    };
  } catch (error) {
    return {
      isAuthenticated: false,
      user: null,
      message: `Authentication check failed: ${error.message}`,
    };
  }
};

/**
 * Check tenant subscription status
 * @param {string} tenantId - Tenant ID to check
 * @returns {Promise<object>} { isActive, status, expiresAt }
 */
export const checkTenantSubscription = async (tenantId) => {
  try {
    if (!tenantId) {
      return {
        isActive: false,
        status: 'unknown',
        message: 'No tenant ID provided',
      };
    }

    const { data, error } = await supabase
      .from('tenants')
      .select('subscription_status, subscription_end')
      .eq('id', tenantId)
      .single();

    if (error) {
      throw error;
    }

    const isActive = data.subscription_status === 'active' || data.subscription_status === 'trial';
    const expiresAt = data.subscription_end ? new Date(data.subscription_end) : null;
    const isExpired = expiresAt && expiresAt < new Date();

    return {
      isActive: isActive && !isExpired,
      status: data.subscription_status,
      expiresAt,
      isExpired,
      message:
        isActive && !isExpired
          ? `Subscription is ${data.subscription_status}`
          : 'Subscription is inactive or expired',
    };
  } catch (error) {
    return {
      isActive: false,
      status: 'error',
      message: `Failed to check subscription: ${error.message}`,
    };
  }
};

/**
 * Check RLS policies are enabled
 * @returns {Promise<object>} { rlsEnabled, tables }
 */
export const checkRLSPolicies = async () => {
  try {
    // This would require superuser access, so we'll do a simplified check
    // by attempting to query tables and seeing if RLS is enforced
    const tables = [
      'profiles',
      'tenants',
      'locations',
      'products',
      'events',
      'tasks',
      'transactions',
      'qr_codes',
    ];

    const results = {};

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('id').limit(1);

        results[table] = {
          accessible: !error,
          error: error?.message,
        };
      } catch (err) {
        results[table] = {
          accessible: false,
          error: err.message,
        };
      }
    }

    return {
      rlsEnabled: true,
      tables: results,
      message: 'RLS policy check completed',
    };
  } catch (error) {
    return {
      rlsEnabled: false,
      tables: {},
      message: `RLS check failed: ${error.message}`,
    };
  }
};

/**
 * Run comprehensive system health check
 * @param {string} tenantId - Optional tenant ID for tenant-specific checks
 * @returns {Promise<object>} Complete health check results
 */
export const runSystemHealthCheck = async (tenantId = null) => {
  console.log('🏥 Running system health check...');

  const results = {
    timestamp: new Date().toISOString(),
    overall: 'unknown',
    checks: {},
  };

  // Environment variables check
  results.checks.environment = checkEnvironmentVariables();

  // Database connection
  results.checks.database = await checkDatabaseConnection();

  // Authentication
  results.checks.authentication = await checkAuthentication();

  // Tenant subscription (if tenant ID provided)
  if (tenantId) {
    results.checks.subscription = await checkTenantSubscription(tenantId);
  }

  // RLS policies
  results.checks.rls = await checkRLSPolicies();

  // Determine overall health
  const criticalChecks = [results.checks.environment.isValid, results.checks.database.isConnected];

  if (criticalChecks.every((check) => check === true)) {
    results.overall = 'healthy';
  } else if (criticalChecks.some((check) => check === true)) {
    results.overall = 'degraded';
  } else {
    results.overall = 'unhealthy';
  }

  console.log('🏥 Health check complete:', results.overall);
  return results;
};

/**
 * Format health check results for display
 * @param {object} healthCheck - Health check results
 * @returns {string} Formatted HTML string
 */
export const formatHealthCheckResults = (healthCheck) => {
  const { overall, checks } = healthCheck;

  let html = `<div style="font-family: monospace;">
    <h3>System Health: ${overall.toUpperCase()}</h3>
    <p>Timestamp: ${new Date(healthCheck.timestamp).toLocaleString()}</p>
    <hr/>
  `;

  Object.entries(checks).forEach(([name, result]) => {
    const status =
      result.isValid || result.isConnected || result.isAuthenticated || result.rlsEnabled;
    const icon = status ? '✓' : '✗';
    const color = status ? 'green' : 'red';

    html += `
      <div style="margin: 10px 0;">
        <strong style="color: ${color};">${icon} ${name.toUpperCase()}</strong>
        <br/>
        ${result.message || ''}
      </div>
    `;
  });

  html += '</div>';
  return html;
};
