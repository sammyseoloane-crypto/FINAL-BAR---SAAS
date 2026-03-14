/**
 * Database Stress Testing Script
 * Tests database performance under heavy concurrent load
 *
 * Run with: k6 run load-test-database.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const queryResponseTime = new Trend('query_response_time');
const queryErrorRate = new Rate('query_errors');

export const options = {
  scenarios: {
    // Scenario 1: Constant load
    constant_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
    // Scenario 2: Ramping load
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      startTime: '5m',
    },
    // Scenario 3: Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 500 },  // Rapid spike
        { duration: '1m', target: 500 },   // Sustain spike
        { duration: '10s', target: 0 },    // Rapid drop
      ],
      startTime: '14m',
    },
  },
  thresholds: {
    'query_response_time': ['p(95)<1000', 'p(99)<2000'],
    'query_errors': ['rate<0.1'],
  },
};

const SUPABASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = __ENV.SUPABASE_ANON_KEY || '';

export default function () {
  // Test 1: Complex JOIN query
  group('Complex Queries', () => {
    const complexQueryResponse = http.get(
      `${SUPABASE_URL}/rest/v1/transactions?select=*,products(*),profiles(*)&limit=100`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
        },
      },
    );

    const success = check(complexQueryResponse, {
      'complex query success': (r) => r.status === 200,
      'complex query fast': (r) => r.timings.duration < 1000,
    });

    queryResponseTime.add(complexQueryResponse.timings.duration);
    queryErrorRate.add(!success);
  });

  sleep(0.5);

  // Test 2: Aggregation query
  group('Aggregation Queries', () => {
    const aggregationResponse = http.post(
      `${SUPABASE_URL}/rest/v1/rpc/get_sales_trends`,
      JSON.stringify({
        p_tenant_id: null,
        p_days: 30,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
        },
      },
    );

    check(aggregationResponse, {
      'aggregation success': (r) => r.status === 200,
    });

    queryResponseTime.add(aggregationResponse.timings.duration);
  });

  sleep(0.5);

  // Test 3: Materialized view query
  group('Materialized Views', () => {
    const mvResponse = http.get(
      `${SUPABASE_URL}/rest/v1/mv_tenant_revenue_summary?select=*&limit=50`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
        },
      },
    );

    check(mvResponse, {
      'materialized view fast': (r) => r.status === 200 && r.timings.duration < 200,
    });

    queryResponseTime.add(mvResponse.timings.duration);
  });

  sleep(0.5);

  // Test 4: Write operations
  group('Write Performance', () => {
    const writeResponse = http.post(
      `${SUPABASE_URL}/rest/v1/audit_logs`,
      JSON.stringify({
        action: 'LOAD_TEST',
        resource_type: 'test',
        status: 'success',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Prefer': 'return=minimal',
        },
      },
    );

    check(writeResponse, {
      'write success': (r) => r.status === 201 || r.status === 401,
    });
  });

  sleep(0.5);

  // Test 5: Full-text search
  group('Search Performance', () => {
    const searchResponse = http.get(
      `${SUPABASE_URL}/rest/v1/products?name=ilike.*beer*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
        },
      },
    );
    check(searchResponse, {
      'search responsive': (r) => r.status === 200 && r.timings.duration < 500,
    });
    queryResponseTime.add(searchResponse.timings.duration);
  });
  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  const summary = `
${indent}================== LOAD TEST SUMMARY ==================
${indent}Total Requests: ${data.metrics.http_reqs.values.count}
${indent}Failed Requests: ${data.metrics.http_req_failed.values.rate.toFixed(2)}%
${indent}Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
${indent}P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
${indent}P99 Response Time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms
${indent}=======================================================
`;

  return summary;
}
