# Load Testing Guide

## Overview
This directory contains load and stress testing scripts for the Multi-Tenant Bar SaaS application. Tests are written for k6, a modern load testing tool.

## Installation

### Install k6
**Windows (Chocolatey):**
```powershell
choco install k6
```

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Test Files

### 1. `load-test-api.js`
Tests API endpoint performance under various load conditions.

**Run basic test:**
```bash
k6 run load-test-api.js
```

**Run with custom parameters:**
```bash
k6 run --vus 100 --duration 10m load-test-api.js
```

**Run with environment variables:**
```bash
k6 run -e BASE_URL=https://your-app.com -e SUPABASE_URL=https://your-supabase.com load-test-api.js
```

### 2. `load-test-database.js`
Tests database query performance and concurrent access patterns.

**Run database stress test:**
```bash
k6 run load-test-database.js
```

**Run specific scenario:**
```bash
k6 run --scenario constant_load load-test-database.js
```

## Test Scenarios

### API Load Test Stages
1. **Ramp-up (2m)**: 0 → 50 users
2. **Steady (5m)**: 50 users
3. **Scale-up (2m)**: 50 → 100 users
4. **Sustained (5m)**: 100 users
5. **Spike (3m)**: 100 → 200 users
6. **Ramp-down (2m)**: 200 → 0 users

### Database Stress Test Scenarios
1. **Constant Load**: 50 VUs for 5 minutes
2. **Ramping Load**: 0 → 200 VUs over 9 minutes
3. **Spike Test**: Rapid spike to 500 VUs

## Performance Thresholds

### API Tests
- 95% of requests < 500ms
- 99% of requests < 1000ms
- Error rate < 5%
- Failed requests < 10%

### Database Tests
- 95% of queries < 1000ms
- 99% of queries < 2000ms
- Query error rate < 10%

## Interpreting Results

### Key Metrics

**http_req_duration**: Time from request start to response
- `avg`: Average response time
- `p(95)`: 95th percentile response time
- `p(99)`: 99th percentile response time

**http_req_failed**: Percentage of failed requests
- Should be < 10% under normal load
- > 25% indicates serious issues

**http_reqs**: Total number of requests
- Higher is better for throughput tests

**vus**: Virtual users (concurrent users)

### Results Output

Results are saved to:
- `load-test-results.json`: Detailed metrics
- Console: Real-time summary

## Running Tests in CI/CD

### GitHub Actions Example
```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * 0' # Weekly on Sunday at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run Load Tests
        run: |
          k6 run tests/load-test-api.js
          k6 run tests/load-test-database.js
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: load-test-results.json
```

## Best Practices

1. **Start Small**: Begin with 10-20 VUs and gradually increase
2. **Test in Staging**: Never run load tests against production
3. **Monitor Resources**: Watch CPU, memory, and database connections
4. **Set Realistic Thresholds**: Base on actual SLA requirements
5. **Run Regularly**: Weekly or before major releases
6. **Analyze Trends**: Compare results over time

## Troubleshooting

### High Error Rates
- Check database connection limits
- Verify RLS policies aren't causing slowdowns
- Review server logs for errors

### Slow Response Times
- Check database indexes
- Review materialized view refresh frequency
- Examine slow query logs

### Connection Failures
- Increase connection pool size
- Check rate limiting configuration
- Verify network bandwidth

## Advanced Configuration

### Custom Thresholds
```javascript
export const options = {
  thresholds: {
    'http_req_duration{api:products}': ['p(95)<300'],
    'http_req_duration{api:checkout}': ['p(95)<1000'],
    'http_req_failed{critical:true}': ['rate<0.01'],
  },
};
```

### Cloud Execution (k6 Cloud)
```bash
k6 cloud load-test-api.js
```

### Distributed Testing
```bash
k6 run --out influxdb=http://localhost:8086 load-test-api.js
```

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://k6.io/docs/examples/)
- [Performance Testing Guide](https://k6.io/docs/test-types/)
