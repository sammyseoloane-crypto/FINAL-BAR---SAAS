/**
 * Test Setup and Global Configuration
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
});

// Setup global test utilities
beforeAll(() => {
  // Mock environment variables for testing
  if (!import.meta.env.VITE_SUPABASE_URL) {
    import.meta.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  }
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
    import.meta.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'test-key';
  }
  if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
    import.meta.env.VITE_STRIPE_PUBLIC_KEY = process.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_';
  }
});

// Global test cleanup
afterAll(() => {
  // Clean up any remaining resources
});

// Suppress console errors in tests
global.console = {
  ...console,
  error: (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
        args[0].includes('Error: Could not parse CSS stylesheet'))
    ) {
      return;
    }
    console.error(...args);
  },
};
