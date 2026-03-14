import { useState, useEffect } from 'react';
import { performHealthCheck, AlertSeverity } from '../utils/monitoring';
import * as Sentry from '@sentry/react';

/**
 * Monitoring Dashboard Component
 * Displays system health status and recent errors
 *
 * Usage:
 * import MonitoringDashboard from './components/MonitoringDashboard';
 *
 * // In your admin/owner dashboard:
 * <MonitoringDashboard />
 */
const MonitoringDashboard = () => {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState(null);
  const [sentryStatus, setSentryStatus] = useState('unknown');

  useEffect(() => {
    checkSystemHealth();

    // Refresh every 30 seconds
    const interval = setInterval(checkSystemHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkSentryStatus();
  }, []);

  const checkSystemHealth = async () => {
    try {
      setLoading(true);
      const status = await performHealthCheck();
      setHealthStatus(status);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'unhealthy', error: error.message },
          api: { status: 'unhealthy', error: error.message },
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const checkSentryStatus = () => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) {
      setSentryStatus('disabled');
    } else if (Sentry.getCurrentHub().getClient()) {
      setSentryStatus('active');
    } else {
      setSentryStatus('configured_not_initialized');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return '#10b981'; // green
      case 'unhealthy':
      case 'disabled':
        return '#ef4444'; // red
      case 'warning':
      case 'configured_not_initialized':
        return '#f59e0b'; // orange
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
      case 'active':
        return '✅';
      case 'unhealthy':
      case 'disabled':
        return '❌';
      case 'warning':
      case 'configured_not_initialized':
        return '⚠️';
      default:
        return '❓';
    }
  };

  const sendTestAlert = async (severity) => {
    try {
      const message = `Test ${severity} alert from Monitoring Dashboard`;

      Sentry.captureMessage(message, {
        level: severity === AlertSeverity.CRITICAL ? 'error' : 'warning',
        tags: {
          category: 'test',
          severity: severity,
          source: 'monitoring_dashboard',
        },
      });

      alert('Test alert sent to Sentry! Check your Sentry dashboard and configured alert channels.');
    } catch (error) {
      alert(`Failed to send test alert: ${error.message}`);
    }
  };

  if (loading && !healthStatus) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>System Monitoring</h2>
        <div style={styles.loading}>Loading health status...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🔍 System Monitoring Dashboard</h2>
        <button onClick={checkSystemHealth} style={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>

      {lastCheck && (
        <div style={styles.lastCheck}>
          Last checked: {lastCheck.toLocaleTimeString()}
        </div>
      )}

      {/* Sentry Status */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Error Tracking (Sentry)</h3>
        <div style={styles.statusRow}>
          <span style={styles.statusLabel}>Status:</span>
          <span style={{
            ...styles.statusBadge,
            backgroundColor: getStatusColor(sentryStatus),
          }}>
            {getStatusIcon(sentryStatus)} {sentryStatus.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>

        {sentryStatus === 'active' && (
          <div style={styles.testButtons}>
            <button
              onClick={() => sendTestAlert(AlertSeverity.WARNING)}
              style={{ ...styles.testButton, ...styles.warningButton }}
            >
              Send Test Warning
            </button>
            <button
              onClick={() => sendTestAlert(AlertSeverity.CRITICAL)}
              style={{ ...styles.testButton, ...styles.criticalButton }}
            >
              Send Test Critical Alert
            </button>
          </div>
        )}

        {sentryStatus === 'disabled' && (
          <div style={styles.warning}>
            ⚠️ Sentry is not configured. Add VITE_SENTRY_DSN to your .env file.
            <br />
            <a
              href="https://sentry.io"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Create Sentry Account →
            </a>
          </div>
        )}
      </div>

      {/* System Health */}
      {healthStatus && (
        <>
          {/* Database Health */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Database Health</h3>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>Status:</span>
              <span style={{
                ...styles.statusBadge,
                backgroundColor: getStatusColor(healthStatus.checks.database?.status),
              }}>
                {getStatusIcon(healthStatus.checks.database?.status)}{' '}
                {healthStatus.checks.database?.status?.toUpperCase()}
              </span>
            </div>
            {healthStatus.checks.database?.error && (
              <div style={styles.error}>
                Error: {healthStatus.checks.database.error}
              </div>
            )}
          </div>

          {/* API Health */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>API Health</h3>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>Status:</span>
              <span style={{
                ...styles.statusBadge,
                backgroundColor: getStatusColor(healthStatus.checks.api?.status),
              }}>
                {getStatusIcon(healthStatus.checks.api?.status)}{' '}
                {healthStatus.checks.api?.status?.toUpperCase()}
              </span>
            </div>
            {healthStatus.checks.api?.statusCode && (
              <div style={styles.info}>
                Status Code: {healthStatus.checks.api.statusCode}
              </div>
            )}
            {healthStatus.checks.api?.error && (
              <div style={styles.error}>
                Error: {healthStatus.checks.api.error}
              </div>
            )}
          </div>
        </>
      )}

      {/* Quick Links */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Monitoring Tools</h3>
        <div style={styles.links}>
          <a
            href="https://sentry.io"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.externalLink}
          >
            📊 Sentry Dashboard
          </a>
          <a
            href={`https://app.supabase.com/project/${import.meta.env.VITE_SUPABASE_URL?.split('.')[0]?.split('//')[1]}/logs/edge-functions`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.externalLink}
          >
            📝 Supabase Logs
          </a>
          <a
            href="https://dashboard.stripe.com/webhooks"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.externalLink}
          >
            🎣 Stripe Webhooks
          </a>
        </div>
      </div>

      {/* Alert Categories */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Alert Categories Monitored</h3>
        <ul style={styles.list}>
          <li style={styles.listItem}>
            <span style={styles.emoji}>💳</span> Payment Failures
          </li>
          <li style={styles.listItem}>
            <span style={styles.emoji}>🎣</span> Webhook Failures
          </li>
          <li style={styles.listItem}>
            <span style={styles.emoji}>🗄️</span> Database Errors
          </li>
          <li style={styles.listItem}>
            <span style={styles.emoji}>🌐</span> API Errors
          </li>
          <li style={styles.listItem}>
            <span style={styles.emoji}>🔐</span> Authentication Failures
          </li>
          <li style={styles.listItem}>
            <span style={styles.emoji}>🚨</span> Security Issues
          </li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    margin: 0,
  },
  refreshButton: {
    padding: '8px 16px',
    backgroundColor: '#d4af37',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  lastCheck: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '20px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
  },
  card: {
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginTop: 0,
    marginBottom: '16px',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  statusLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  statusBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
  },
  testButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
  testButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: 'white',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  criticalButton: {
    backgroundColor: '#ef4444',
  },
  warning: {
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    fontSize: '14px',
    color: '#92400e',
  },
  error: {
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    fontSize: '14px',
    color: '#991b1b',
  },
  info: {
    backgroundColor: '#dbeafe',
    border: '1px solid #d4af37',
    borderRadius: '6px',
    padding: '12px',
    marginTop: '12px',
    fontSize: '14px',
    color: '#1e40af',
  },
  links: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  externalLink: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 16px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    textDecoration: 'none',
    color: '#1f2937',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  link: {
    color: '#d4af37',
    textDecoration: 'underline',
    marginTop: '8px',
    display: 'inline-block',
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  listItem: {
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  emoji: {
    fontSize: '18px',
  },
};

export default MonitoringDashboard;
