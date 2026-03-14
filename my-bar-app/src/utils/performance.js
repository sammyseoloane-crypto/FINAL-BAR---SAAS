/**
 * Performance Monitoring Utilities
 * Track component render times, API calls, and user interactions
 */

import React from 'react';

// Performance measurement wrapper
export class PerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.enabled =
      process.env.NODE_ENV !== 'production' || window.location.search.includes('debug=true');
  }

  /**
   * Start a performance measurement
   */
  startMeasure(name) {
    if (!this.enabled) {
      return;
    }
    performance.mark(`${name}-start`);
  }

  /**
   * End a performance measurement
   */
  endMeasure(name) {
    if (!this.enabled) {
      return;
    }

    performance.mark(`${name}-end`);
    try {
      performance.measure(name, `${name}-start`, `${name}-end`);
      const measure = performance.getEntriesByName(name)[0];

      this.metrics.push({
        name,
        duration: measure.duration,
        timestamp: Date.now(),
      });

      // Warn if operation is slow
      if (measure.duration > 1000) {
        console.warn(`⚠️ Slow operation detected: ${name} took ${measure.duration.toFixed(2)}ms`);
      }

      // Clean up marks
      performance.clearMarks(`${name}-start`);
      performance.clearMarks(`${name}-end`);
      performance.clearMeasures(name);

      return measure.duration;
    } catch (error) {
      console.error('Performance measurement error:', error);
      return null;
    }
  }

  /**
   * Measure async function execution time
   */
  async measureAsync(name, fn) {
    this.startMeasure(name);
    try {
      const result = await fn();
      this.endMeasure(name);
      return result;
    } catch (error) {
      this.endMeasure(name);
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(filterByName = null) {
    if (filterByName) {
      return this.metrics.filter((m) => m.name.includes(filterByName));
    }
    return this.metrics;
  }

  /**
   * Get average duration for a metric
   */
  getAverageDuration(name) {
    const filtered = this.metrics.filter((m) => m.name === name);
    if (filtered.length === 0) {
      return 0;
    }

    const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
    return sum / filtered.length;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * Export metrics as CSV
   */
  exportMetrics() {
    const csv = [
      'Name,Duration (ms),Timestamp',
      ...this.metrics.map(
        (m) => `${m.name},${m.duration.toFixed(2)},${new Date(m.timestamp).toISOString()}`,
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React Hook for component render tracking
 */
export const usePerformanceTracking = (componentName) => {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(Date.now());

  React.useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (renderCount.current > 1 && timeSinceLastRender < 100) {
      console.warn(
        `⚠️ ${componentName} re-rendered ${renderCount.current} times. ` +
          `Last render was ${timeSinceLastRender}ms ago.`,
      );
    }
  });

  return {
    renderCount: renderCount.current,
    trackEvent: (eventName, data = {}) => {
      performanceMonitor.metrics.push({
        name: `${componentName}:${eventName}`,
        duration: 0,
        timestamp: Date.now(),
        data,
      });
    },
  };
};

/**
 * Measure API call performance
 */
export const measureApiCall = async (endpoint, apiCall) => {
  const startTime = performance.now();

  try {
    const result = await apiCall();
    const duration = performance.now() - startTime;

    performanceMonitor.metrics.push({
      name: `api:${endpoint}`,
      duration,
      timestamp: Date.now(),
      success: true,
    });

    if (duration > 2000) {
      console.warn(`⚠️ Slow API call: ${endpoint} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    performanceMonitor.metrics.push({
      name: `api:${endpoint}`,
      duration,
      timestamp: Date.now(),
      success: false,
      error: error.message,
    });

    throw error;
  }
};

/**
 * Debounce function for performance optimization
 */
export const debounce = (func, wait = 300) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function for performance optimization
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;

  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Lazy load images for better performance
 */
export const lazyLoadImage = (src, placeholder = '/placeholder.png') => {
  return new Promise((resolve, _reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(src);
    img.onerror = () => resolve(placeholder);
  });
};

/**
 * Batch state updates for better performance
 */
export class StateBatcher {
  constructor(callback, delay = 50) {
    this.callback = callback;
    this.delay = delay;
    this.updates = [];
    this.timeoutId = null;
  }

  add(update) {
    this.updates.push(update);

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  flush() {
    if (this.updates.length > 0) {
      this.callback(this.updates);
      this.updates = [];
    }
    this.timeoutId = null;
  }
}

/**
 * Monitor memory usage (Chrome only)
 */
export const checkMemoryUsage = () => {
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize / 1048576;
    const total = performance.memory.totalJSHeapSize / 1048576;
    const limit = performance.memory.jsHeapSizeLimit / 1048576;

    // eslint-disable-next-line no-console
    console.log(`Memory Usage:
      Used: ${used.toFixed(2)} MB
      Total: ${total.toFixed(2)} MB
      Limit: ${limit.toFixed(2)} MB
      Usage: ${((used / limit) * 100).toFixed(2)}%
    `);

    if (used / limit > 0.9) {
      console.warn('⚠️ High memory usage detected! Consider optimizing.');
    }

    return { used, total, limit, percentage: (used / limit) * 100 };
  }

  return null;
};

/**
 * Log component lifecycle events
 */
export const useComponentLifecycle = (componentName) => {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`✅ ${componentName} mounted`);

    return () => {
      // eslint-disable-next-line no-console
      console.log(`❌ ${componentName} unmounted`);
    };
  }, [componentName]);
};

/**
 * Measure render time of a component
 */
export const withPerformanceTracking = (Component, componentName) => {
  return React.memo((props) => {
    const startTime = React.useRef(performance.now());

    React.useEffect(() => {
      const renderTime = performance.now() - startTime.current;
      performanceMonitor.metrics.push({
        name: `render:${componentName}`,
        duration: renderTime,
        timestamp: Date.now(),
      });

      if (renderTime > 100) {
        console.warn(`⚠️ Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
      }
    });

    return <Component {...props} />;
  });
};

// Export default performance monitor
export default performanceMonitor;
