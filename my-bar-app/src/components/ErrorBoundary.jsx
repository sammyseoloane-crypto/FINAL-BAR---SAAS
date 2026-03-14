/**
 * Comprehensive Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */

import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  // eslint-disable-next-line no-unused-vars
  componentDidCatch(error, errorInfo) {
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught an error:', error, errorInfo);
    }

    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          boundary: this.props.name || 'unknown',
        },
      });
    }

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.handleReset,
        });
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-container">
            <div className="error-icon">⚠️</div>
            <h1 className="error-title">Oops! Something went wrong</h1>
            <p className="error-message">
              {this.props.friendlyMessage ||
                'We encountered an unexpected error. Please try again or contact support if the problem persists.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Error Details (Development Only)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-actions">
              <button onClick={this.handleReset} className="btn-primary">
                Try Again
              </button>
              <button onClick={this.handleReload} className="btn-secondary">
                Reload Page
              </button>
              {!this.props.preventNavigation && (
                <button onClick={this.handleGoHome} className="btn-tertiary">
                  Go to Home
                </button>
              )}
            </div>

            {this.state.errorCount > 3 && (
              <div className="error-warning">
                <p>
                  ⚠️ This error has occurred multiple times. Please contact support for assistance.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  name: PropTypes.string,
  onError: PropTypes.func,
  onReset: PropTypes.func,
  fallback: PropTypes.node,
  friendlyMessage: PropTypes.string,
  preventNavigation: PropTypes.bool,
};

export const withErrorBoundary = (Component, errorBoundaryProps = {}) => {
  return (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
};

export const useErrorHandler = () => {
  const [error, setError] = React.useState(null);

  if (error) {
    throw error;
  }

  return setError;
};

export const useAsyncError = () => {
  const [, setError] = React.useState();

  return React.useCallback(
    (error) => {
      setError(() => {
        throw error;
      });
    },
    [setError],
  );
};

export default ErrorBoundary;
