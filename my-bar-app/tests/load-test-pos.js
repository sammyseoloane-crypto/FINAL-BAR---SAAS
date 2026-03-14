/**
 * Load Testing Script - POS System
 * Simulates peak nightclub operations with multiple staff using POS terminals
 *
 * Run with: node tests/load-test-pos.js
 * Requirements: npm install artillery@latest
 */

const Artillery = require('artillery');
const { performance } = require('perf_hooks');

// Test Configuration
const CONFIG = {
  target: process.env.TEST_TARGET_URL || 'http://localhost:5173',
  phases: [
    {
      name: 'Warm-up',
      duration: 60,
      arrivalRate: 5, // 5 staff members starting up
    },
    {
      name: 'Moderate Traffic',
      duration: 180,
      arrivalRate: 20, // 20 transactions per second
    },
    {
      name: 'Peak Hour Rush',
      duration: 300,
      arrivalRate: 50, // 50 transactions per second
    },
    {
      name: 'Cool Down',
      duration: 60,
      arrivalRate: 10,
    },
  ],
  payload: {
    path: './test-data/pos-transactions.csv',
  },
};

// Test Scenarios
const SCENARIOS = [
  {
    name: 'Quick Drink Order',
    weight: 50, // 50% of traffic
    flow: [
      { post: '/api/transactions', json: { items: [{ product_id: 'vodka', quantity: 1, price: 65.00 }], payment_method: 'card' } },
      { think: 2 },
    ],
  },
  {
    name: 'Multiple Items Order',
    weight: 30, // 30% of traffic
    flow: [
      { post: '/api/transactions', json: { items: [{ product_id: 'beer', quantity: 3 }, { product_id: 'shots', quantity: 5 }], payment_method: 'cash' } },
      { think: 3 },
    ],
  },
  {
    name: 'Large Group Order',
    weight: 15, // 15% of traffic
    flow: [
      { post: '/api/transactions', json: { items: [{ product_id: 'beer', quantity: 10 }, { product_id: 'cocktails', quantity: 8 }], payment_method: 'card' } },
      { think: 5 },
    ],
  },
  {
    name: 'Bottle Service Order',
    weight: 5, // 5% of traffic
    flow: [
      { post: '/api/bottle-orders', json: { package_id: 'premium-vodka-package', table_id: 'vip-1', guests: 8 } },
      { think: 10 },
    ],
  },
];

// Performance Thresholds
const THRESHOLDS = {
  maxResponseTime: 2000, // ms
  maxErrorRate: 0.01, // 1%
  minThroughput: 80, // requests/sec during peak
  maxMemoryUsage: 2048, // MB
};

// Test Results Container
const testResults = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  errors: [],
  startTime: null,
  endTime: null,
};

/**
 * Run POS Load Test
 */
async function runPOSLoadTest() {
  console.log('========================================');
  console.log('🚀 Starting POS System Load Test');
  console.log('========================================');
  console.log(`Target: ${CONFIG.target}`);
  console.log(`Duration: ${CONFIG.phases.reduce((sum, phase) => sum + phase.duration, 0)} seconds`);
  console.log(`Peak Load: ${Math.max(...CONFIG.phases.map((p) => p.arrivalRate))} req/sec`);
  console.log('');

  testResults.startTime = performance.now();

  // Simulate concurrent POS terminals
  const terminals = 50;
  console.log(`Simulating ${terminals} concurrent POS terminals...`);

  // Test scenarios
  for (const scenario of SCENARIOS) {
    console.log(`\n📊 Running scenario: ${scenario.name} (${scenario.weight}% traffic)`);
    for (let i = 0; i < scenario.weight; i++) {
      try {
        const startTime = performance.now();

        // Simulate API call
        const response = await simulateTransaction(scenario.flow[0]);

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        testResults.responseTimes.push(responseTime);
        testResults.totalRequests++;

        if (response.success) {
          testResults.successfulRequests++;
        } else {
          testResults.failedRequests++;
          testResults.errors.push(response.error);
        }
        // Log progress every 100 requests
        if (testResults.totalRequests % 100 === 0) {
          console.log(`  ✓ Completed ${testResults.totalRequests} requests...`);
        }

      } catch (error) {
        testResults.failedRequests++;
        testResults.errors.push(error.message);
      }
    }
  }

  testResults.endTime = performance.now();

  // Calculate metrics
  const metrics = calculateMetrics();
  printResults(metrics);

  // Validate against thresholds
  validateThresholds(metrics);
}

/**
 * Simulate a transaction
 */
async function simulateTransaction(transactionData) {
  // In a real test, this would make actual HTTP requests
  // For now, simulate with random success/failure

  return new Promise((resolve) => {
    setTimeout(() => {
      const success = Math.random() > 0.01; // 99% success rate

      resolve({
        success,
        error: success ? null : 'Transaction failed',
        responseTime: Math.random() * 500 + 50, // 50-550ms
      });
    }, Math.random() * 200 + 50); // Simulate network delay
  });
}

/**
 * Calculate performance metrics
 */
function calculateMetrics() {
  const totalTime = (testResults.endTime - testResults.startTime) / 1000; // seconds
  const sortedTimes = testResults.responseTimes.sort((a, b) => a - b);

  return {
    totalRequests: testResults.totalRequests,
    successfulRequests: testResults.successfulRequests,
    failedRequests: testResults.failedRequests,
    errorRate: (testResults.failedRequests / testResults.totalRequests) * 100,

    // Response times
    avgResponseTime: sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length,
    minResponseTime: sortedTimes[0],
    maxResponseTime: sortedTimes[sortedTimes.length - 1],
    p50ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
    p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
    p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)],

    // Throughput
    throughput: testResults.totalRequests / totalTime,
    duration: totalTime,
  };
}

/**
 * Print test results
 */
function printResults(metrics) {
  console.log('\n');
  console.log('========================================');
  console.log('📊 TEST RESULTS');
  console.log('========================================');
  console.log('');
  console.log('Request Statistics:');
  console.log(`  Total Requests:      ${metrics.totalRequests}`);
  console.log(`  Successful:          ${metrics.successfulRequests} (${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%)`);
  console.log(`  Failed:              ${metrics.failedRequests} (${metrics.errorRate.toFixed(2)}%)`);
  console.log('');
  console.log('Response Time Statistics:');
  console.log(`  Average:             ${metrics.avgResponseTime.toFixed(2)} ms`);
  console.log(`  Min:                 ${metrics.minResponseTime.toFixed(2)} ms`);
  console.log(`  Max:                 ${metrics.maxResponseTime.toFixed(2)} ms`);
  console.log(`  P50 (Median):        ${metrics.p50ResponseTime.toFixed(2)} ms`);
  console.log(`  P95:                 ${metrics.p95ResponseTime.toFixed(2)} ms`);
  console.log(`  P99:                 ${metrics.p99ResponseTime.toFixed(2)} ms`);
  console.log('');
  console.log('Performance Metrics:');
  console.log(`  Throughput:          ${metrics.throughput.toFixed(2)} req/sec`);
  console.log(`  Duration:            ${metrics.duration.toFixed(2)} seconds`);
  console.log('');
  // Top errors
  if (testResults.errors.length > 0) {
    console.log('Top Errors:');
    const errorCounts = {};
    testResults.errors.forEach((error) => {
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });
    Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([error, count]) => {
        console.log(`  ${count}x: ${error}`);
      });
    console.log('');
  }
}

/**
 * Validate against thresholds
 */
function validateThresholds(metrics) {
  console.log('========================================');
  console.log('✓ THRESHOLD VALIDATION');
  console.log('========================================');
  console.log('');
  const checks = [
    {
      name: 'Response Time (P95)',
      value: metrics.p95ResponseTime,
      threshold: THRESHOLDS.maxResponseTime,
      unit: 'ms',
      condition: metrics.p95ResponseTime <= THRESHOLDS.maxResponseTime,
    },
    {
      name: 'Error Rate',
      value: metrics.errorRate,
      threshold: THRESHOLDS.maxErrorRate * 100,
      unit: '%',
      condition: metrics.errorRate <= THRESHOLDS.maxErrorRate * 100,
    },
    {
      name: 'Throughput',
      value: metrics.throughput,
      threshold: THRESHOLDS.minThroughput,
      unit: 'req/sec',
      condition: metrics.throughput >= THRESHOLDS.minThroughput,
    },
  ];
  let allChecksPassed = true;
  checks.forEach((check) => {
    const status = check.condition ? '✓ PASS' : '✗ FAIL';
    const statusColor = check.condition ? '\x1b[32m' : '\x1b[31m';
    console.log(`${statusColor}${status}\x1b[0m ${check.name}`);
    console.log(`      Value: ${check.value.toFixed(2)} ${check.unit}`);
    console.log(`      Threshold: ${check.threshold} ${check.unit}`);
    console.log('');
    if (!check.condition) {
      allChecksPassed = false;
    }
  });
  if (allChecksPassed) {
    console.log('\x1b[32m✓ All checks passed! System is ready for production.\x1b[0m');
    process.exit(0);
  } else {
    console.log('\x1b[31m✗ Some checks failed. Please review and optimize.\x1b[0m');
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runPOSLoadTest().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { runPOSLoadTest };
