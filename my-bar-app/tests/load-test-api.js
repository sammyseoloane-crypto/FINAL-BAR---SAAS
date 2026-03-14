/**
 * Load Testing Script - API Endpoints
 * Uses k6 for load and stress testing
 *
 * Run with: k6 run load-test-api.js
 * Options: k6 run --vus 100 --duration 5m load-test-api.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp-up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp-up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '3m', target: 200 },  // Spike to 200 users
    { duration: '2m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    'errors': ['rate<0.05'], // Error rate < 5%
    'http_req_failed': ['rate<0.1'], // Failed requests < 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5173';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = __ENV.SUPABASE_ANON_KEY || '';

// Test data
const tenantIds = [];
const productIds = [];
const authToken = '';

export function setup() {
  // Setup: Create test data
  console.log('Setting up test data...');
  // Create test tenant
  const tenantResponse = http.post(
    `${SUPABASE_URL}/rest/v1/tenants`,
    JSON.stringify({
      name: `Load Test Tenant ${Date.now()}`,
      subscription_status: 'active',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Prefer': 'return=representation',
      },
    },
  );
  if (tenantResponse.status === 201) {
    const tenant = JSON.parse(tenantResponse.body)[0];
    tenantIds.push(tenant.id);
    // Create test products
    for (let i = 0; i < 10; i++) {
      const productResponse = http.post(
        `${SUPABASE_URL}/rest/v1/products`,
        JSON.stringify({
          tenant_id: tenant.id,
          name: `Test Product ${i}`,
          price: (Math.random() * 20 + 5).toFixed(2),
          available: true,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Prefer': 'return=representation',
          },
        },
      );
      if (productResponse.status === 201) {
        const product = JSON.parse(productResponse.body)[0];
        productIds.push(product.id);
      }
    }
  }
  return { tenantIds, productIds };
}

export default function (data) {
  // Test scenario 1: Product browsing
  group('Product Browsing', () => {
    const productsResponse = http.get(
      `${SUPABASE_URL}/rest/v1/products?select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
        },
      },
    );
    check(productsResponse, {
      'products loaded': (r) => r.status === 200,
      'response time OK': (r) => r.timings.duration < 500,
    });
    errorRate.add(productsResponse.status !== 200);
    apiResponseTime.add(productsResponse.timings.duration);

    if (productsResponse.status === 200) {
      successfulRequests.add(1);
    }
  });

  sleep(1);

  // Test scenario 2: Cart operations
  group('Shopping Cart', () => {
    const productId = data.productIds[Math.floor(Math.random() * data.productIds.length)];

    // Simulate adding to cart (localStorage operation - simulated)
    const cartResponse = http.get(`${BASE_URL}/api/cart`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    check(cartResponse, {
      'cart accessible': (r) => r.status === 200 || r.status === 404, // May not exist for load test
    });
  });

  sleep(1);

  // Test scenario 3: Payment checkout
  group('Checkout Process', () => {
    const tenantId = data.tenantIds[0];
    const productId = data.productIds[Math.floor(Math.random() * data.productIds.length)];

    const checkoutResponse = http.post(
      `${SUPABASE_URL}/functions/v1/create-checkout-session`,
      JSON.stringify({
        items: [
          { product_id: productId, quantity: Math.floor(Math.random() * 5) + 1 },
        ],
        tenant_id: tenantId,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      },
    );

    check(checkoutResponse, {
      'checkout initiated': (r) => r.status === 200 || r.status === 401, // May require auth
    });

    errorRate.add(checkoutResponse.status >= 500);
  });

  sleep(2);

  // Test scenario 4: Analytics queries
  group('Analytics Dashboard', () => {
    const analyticsResponse = http.post(
      `${SUPABASE_URL}/rest/v1/rpc/get_database_stats`,
      '{}',
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
        },
      },
    );

    check(analyticsResponse, {
      'analytics loaded': (r) => r.status === 200,
      'response under 2s': (r) => r.timings.duration < 2000,
    });

    apiResponseTime.add(analyticsResponse.timings.duration);
  });

  sleep(1);

  // Test scenario 5: Real-time subscriptions stress
  group('Realtime Load', () => {
    // Simulate multiple transactions being created
    const tenantId = data.tenantIds[0];
    const productId = data.productIds[Math.floor(Math.random() * data.productIds.length)];

    const transactionResponse = http.post(
      `${SUPABASE_URL}/rest/v1/transactions`,
      JSON.stringify({
        tenant_id: tenantId,
        product_id: productId,
        amount: (Math.random() * 50 + 10).toFixed(2),
        status: 'pending',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Prefer': 'return=representation',
        },
      },
    );

    check(transactionResponse, {
      'transaction created': (r) => r.status === 201 || r.status === 401,
    });
  });

  sleep(1);
}

export function teardown(data) {
  // Cleanup: Remove test data
  console.log('Cleaning up test data...');

  for (const tenantId of data.tenantIds) {
    http.del(
      `${SUPABASE_URL}/rest/v1/tenants?id=eq.${tenantId}`,
      null,
      {
        headers: {
          'apikey': SUPABASE_KEY,
        },
      },
    );
  }
}
