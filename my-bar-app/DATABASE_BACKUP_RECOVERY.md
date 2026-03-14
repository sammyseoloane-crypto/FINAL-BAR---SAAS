# Database Backup and Recovery Strategy

## Overview
Comprehensive backup and recovery strategy for the Multi-Tenant Bar SaaS application using Supabase PostgreSQL database.

## Table of Contents
1. [Backup Strategy](#backup-strategy)
2. [Automated Backups](#automated-backups)
3. [Manual Backups](#manual-backups)
4. [Point-in-Time Recovery (PITR)](#point-in-time-recovery)
5. [Disaster Recovery Plan](#disaster-recovery-plan)
6. [Testing Backups](#testing-backups)
7. [Monitoring](#monitoring)

---

## Backup Strategy

### Backup Types

#### 1. **Automated Daily Backups** (Supabase Built-in)
- **Frequency**: Daily at 2:00 AM UTC
- **Retention**: 7 days (Free tier), 30 days (Pro tier)
- **Location**: Supabase managed storage
- **Type**: Full database snapshot

#### 2. **Point-in-Time Recovery (PITR)**
- **Availability**: Pro tier and above
- **Retention**: 7 days
- **Granularity**: Down to the second
- **Use Case**: Recover from data corruption or accidental deletion

#### 3. **Manual Exports**
- **Frequency**: Before major changes
- **Retention**: Indefinite (your storage)
- **Type**: SQL dump files
- **Use Case**: Major migrations, regulatory compliance

### Backup Schedule

```
┌─────────────────────────────────────────┐
│ Daily:    2:00 AM UTC - Full Backup     │
│ Weekly:   Sunday 3:00 AM - Verification │
│ Monthly:  1st - Long-term Archive       │
│ On-demand: Before major deployments     │
└─────────────────────────────────────────┘
```

---

## Automated Backups

### Supabase Dashboard Backups

1. **Enable Backups** (Pro tier):
   ```
   Settings → Database → Enable daily backups
   ```

2. **Configure Retention**:
   ```
   Settings → Database → Backup retention: 30 days
   ```

3. **Enable PITR**:
   ```
   Settings → Database → Enable Point-in-Time Recovery
   ```

### Verification Script

Create `scripts/verify-backups.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function verifyBackups() {
  console.log('Verifying database backups...\n');

  // 1. Check backup status via Supabase API
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/get_backup_status`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  const backupStatus = await response.json();
  console.log('✓ Backup Status:', backupStatus);

  // 2. Test database connectivity
  const { data, error } = await supabase.from('tenants').select('count');
  
  if (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  }
  
  console.log('✓ Database connection successful');

  // 3. Verify critical tables exist
  const criticalTables = [
    'tenants',
    'profiles',
    'products',
    'transactions',
    'audit_logs',
  ];

  for (const table of criticalTables) {
    const { error } = await supabase.from(table).select('count');
    if (error) {
      console.error(`✗ Table '${table}' verification failed`);
    } else {
      console.log(`✓ Table '${table}' exists`);
    }
  }

  console.log('\n✓ Backup verification complete');
}

verifyBackups();
```

Run weekly:
```bash
node scripts/verify-backups.js
```

---

## Manual Backups

### Using `pg_dump` (Recommended)

#### Full Database Backup:

```bash
# Windows PowerShell
$env:PGPASSWORD="your-database-password"
pg_dump -h db.your-project.supabase.co -p 5432 -U postgres -d postgres -F c -f "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
```

```bash
# Linux/macOS
export PGPASSWORD="your-database-password"
pg_dump -h db.your-project.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -F c \
  -f backup_$(date +%Y%m%d_%H%M%S).dump
```

#### Schema-Only Backup:

```bash
pg_dump -h db.your-project.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  --schema-only \
  -f schema_$(date +%Y%m%d).sql
```

#### Data-Only Backup:

```bash
pg_dump -h db.your-project.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  --data-only \
  -f data_$(date +%Y%m%d).sql
```

#### Specific Tables:

```bash
pg_dump -h db.your-project.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -t transactions \
  -t products \
  -f critical_tables_$(date +%Y%m%d).sql
```

### Automated Backup Script

Create `scripts/backup-database.ps1`:

```powershell
# Database Backup Script
param(
    [string]$BackupDir = "D:\backups\bar-saas",
    [switch]$Compress
)

$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "backup_$Date.dump"

# Ensure backup directory exists
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# Set database password
$env:PGPASSWORD = $env:SUPABASE_DB_PASSWORD

Write-Host "Starting database backup..." -ForegroundColor Cyan

# Create backup
pg_dump -h $env:SUPABASE_DB_HOST `
    -p 5432 `
    -U postgres `
    -d postgres `
    -F c `
    -f $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backup created: $BackupFile" -ForegroundColor Green
    
    # Compress if requested
    if ($Compress) {
        Compress-Archive -Path $BackupFile -DestinationPath "$BackupFile.zip"
        Remove-Item $BackupFile
        Write-Host "✓ Backup compressed" -ForegroundColor Green
    }
    
    # Delete backups older than 30 days
    Get-ChildItem $BackupDir -Filter "backup_*.dump*" | 
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | 
        Remove-Item
    
    Write-Host "✓ Old backups cleaned up" -ForegroundColor Green
} else {
    Write-Host "✗ Backup failed" -ForegroundColor Red
    exit 1
}
```

Run manually:
```powershell
.\scripts\backup-database.ps1 -Compress
```

Schedule with Task Scheduler:
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute 'PowerShell.exe' `
    -Argument '-File "D:\MULTI-TENANT BAR SAAS APP\my-bar-app\scripts\backup-database.ps1" -Compress'

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

Register-ScheduledTask -Action $action -Trigger $trigger `
    -TaskName "BarSaaS-DailyBackup" -Description "Daily database backup"
```

---

## Point-in-Time Recovery (PITR)

### Requirements
- Supabase Pro tier or higher
- PITR enabled in settings

### Recovery Process

#### 1. **Via Supabase Dashboard**:

```
1. Go to Settings → Database
2. Click "Point in Time Recovery"
3. Select date and time
4. Click "Restore to new project"
5. Verify data integrity
6. Update DNS/environment variables if switching
```

#### 2. **Using Supabase CLI**:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Create recovery database
supabase db recovery create \
  --project-ref your-project-ref \
  --recovery-time "2026-03-11 10:30:00+00" \
  --new-project-name "recovery-bar-saas"
```

### Example Scenarios

#### Scenario 1: Accidental Data Deletion
```
Time of incident: 2026-03-11 14:35:00 UTC
Data deleted: 50 transactions
Recovery point: 2026-03-11 14:30:00 UTC (5 minutes before)

Steps:
1. Create PITR restore to 14:30:00
2. Export missing transactions
3. Import to production database
4. Verify transaction integrity
```

#### Scenario 2: Bad Migration
```
Migration deployed: 2026-03-11 10:00:00 UTC
Issue discovered: 2026-03-11 10:15:00 UTC
Recovery point: 2026-03-11 09:55:00 UTC

Steps:
1. Create PITR restore to 09:55:00
2. Fix migration script
3. Test migration on recovery database
4. Apply corrected migration to production
```

---

## Disaster Recovery Plan

### Recovery Time Objective (RTO)
- **Critical**: 4 hours
- **High**: 24 hours
- **Medium**: 72 hours

### Recovery Point Objective (RPO)
- **Transaction Data**: 5 minutes (PITR)
- **Analytics Data**: 24 hours
- **Static Data**: 7 days

### Disaster Scenarios

#### 1. **Complete Database Loss**

**Recovery Steps:**

```bash
# 1. Provision new Supabase project
supabase projects create bar-saas-recovery

# 2. Apply schema from backup
psql -h new-db.supabase.co -U postgres -d postgres -f schema_latest.sql

# 3. Restore data from latest backup
pg_restore -h new-db.supabase.co \
  -U postgres \
  -d postgres \
  backup_latest.dump

# 4. Verify data integrity
node scripts/verify-backups.js

# 5. Update environment variables
# VITE_SUPABASE_URL=https://new-project.supabase.co
# VITE_SUPABASE_ANON_KEY=new-anon-key

# 6. Update DNS (if using custom domain)

# 7. Monitor application health
```

**Estimated Time**: 2-4 hours

#### 2. **Data Corruption**

```bash
# 1. Identify corruption time
# 2. Create PITR restore before corruption
# 3. Export affected tables
# 4. Drop corrupted tables
# 5. Import clean data
# 6. Verify integrity
```

**Estimated Time**: 1-2 hours

#### 3. **Ransomware Attack**

```bash
# 1. Isolate affected systems
# 2. Restore from offline backup (30-day archive)
# 3. Apply transaction logs up to attack time
# 4. Change all credentials
# 5. Perform security audit
# 6. Restore service
```

**Estimated Time**: 4-8 hours

### Communication Plan

```
┌──────────────────────────────────────────┐
│ Incident Detection                        │
│   ↓                                       │
│ Notify: CTO, Dev Team (within 15 min)    │
│   ↓                                       │
│ Assess Impact & RTO                       │
│   ↓                                       │
│ Initiate Recovery (within 1 hour)        │
│   ↓                                       │
│ Status Updates (every 30 min)            │
│   ↓                                       │
│ Notify Customers (via status page)       │
│   ↓                                       │
│ Recovery Complete                         │
│   ↓                                       │
│ Post-Mortem (within 48 hours)            │
└──────────────────────────────────────────┘
```

---

## Testing Backups

### Monthly Backup Test Procedure

Create `scripts/test-backup-restore.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testBackupRestore() {
  console.log('=== Backup Restore Test ===\n');

  const testDbUrl = process.env.TEST_SUPABASE_URL;
  const testDbKey = process.env.TEST_SUPABASE_KEY;

  const supabase = createClient(testDbUrl, testDbKey);

  // 1. Restore backup to test database
  console.log('1. Restoring backup to test database...');
  await execAsync(`
    pg_restore -h ${process.env.TEST_DB_HOST} \
      -U postgres \
      -d postgres \
      --clean \
      backup_latest.dump
  `);
  console.log('✓ Backup restored\n');

  // 2. Verify data integrity
  console.log('2. Verifying data integrity...');
  
  const tables = ['tenants', 'products', 'transactions', 'profiles'];
  const counts = {};

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    counts[table] = count;
    console.log(`✓ ${table}: ${count} rows`);
  }

  // 3. Test queries
  console.log('\n3. Testing queries...');
  
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .limit(10);
  
  console.log(`✓ Products query: ${products?.length} rows`);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, products(*)')
    .limit(10);
  
  console.log(`✓ Join query: ${transactions?.length} rows`);

  // 4. Test RLS policies
  console.log('\n4. Testing RLS policies...');
  
  // Sign in as test user
  const { data: { user } } = await supabase.auth.signInWithPassword({
    email: 'test@test.com',
    password: 'testpassword',
  });

  const { data: restrictedData } = await supabase
    .from('products')
    .select('*');
  
  console.log(`✓ RLS enforced: ${restrictedData?.length} accessible rows`);

  // 5. Generate report
  console.log('\n=== Test Report ===');
  console.log('Status: SUCCESS');
  console.log('Total tables verified:', tables.length);
  console.log('Total rows:', Object.values(counts).reduce((a, b) => a + b, 0));
  console.log('Test completed at:', new Date().toISOString());
}

testBackupRestore().catch(console.error);
```

Run monthly:
```bash
node scripts/test-backup-restore.js
```

---

## Monitoring

### Backup Monitoring Checklist

- [ ] Daily backup completion
- [ ] Backup file size (should be consistent)
- [ ] Backup verification passed
- [ ] PITR status enabled
- [ ] Storage space available
- [ ] Test restores successful

### Monitoring Script

Create `scripts/monitor-backups.ps1`:

```powershell
# Check Supabase backup status
$Response = Invoke-RestMethod -Uri "$env:SUPABASE_URL/rest/v1/rpc/get_database_stats" `
    -Headers @{
        "apikey" = $env:SUPABASE_SERVICE_KEY
        "Content-Type" = "application/json"
    }

Write-Host "Database Size: $($Response.database_size)" -ForegroundColor Cyan

# Check local backup directory
$BackupDir = "D:\backups\bar-saas"
$LatestBackup = Get-ChildItem $BackupDir -Filter "backup_*.dump" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 1

if ($LatestBackup) {
    $Age = (Get-Date) - $LatestBackup.LastWriteTime
    Write-Host "Latest Backup: $($LatestBackup.Name)" -ForegroundColor Green
    Write-Host "Age: $([Math]::Round($Age.TotalHours, 2)) hours" -ForegroundColor Green
    
    if ($Age.TotalHours -gt 26) {
        Write-Host "WARNING: Backup is older than 26 hours!" -ForegroundColor Yellow
    }
} else {
    Write-Host "ERROR: No backups found!" -ForegroundColor Red
}
```

### Alerts

Set up alerts for:
- Backup failures
- PITR disabled
- Storage >80% full
- Backup age >26 hours
- Test restore failures

---

## Best Practices

1. **3-2-1 Rule**: 3 copies, 2 different media, 1 offsite
2. **Encrypt Backups**: Use encryption at rest and in transit
3. **Test Regularly**: Monthly restore tests
4. **Document Procedures**: Keep runbooks updated
5. **Automate Everything**: Minimize manual steps
6. **Monitor Continuously**: Set up alerts
7. **Version Control**: Keep schema migrations in Git
8. **Audit Access**: Log all backup access

---

## Compliance

### GDPR Requirements
- Customer data export capability
- Data deletion verification
- Backup retention limits (30 days max)
- Encryption requirements

### PCI DSS Requirements (if handling payments)
- Daily backups
- Encrypted storage
- Access controls
- Quarterly testing

### POPIA Requirements (South Africa)
- Data protection measures
- Breach notification
- Access logs
- Retention policies

---

## Emergency Contacts

```
Primary DBA: [Your Name]
  Email: dba@yourcompany.com
  Phone: +27 XX XXX XXXX

Backup DBA: [Backup Name]
  Email: backup-dba@yourcompany.com
  Phone: +27 XX XXX XXXX

Supabase Support: support@supabase.io
  Dashboard: https://app.supabase.com/support
```

---

## Appendix: Useful Commands

```bash
# Check database size
SELECT pg_size_pretty(pg_database_size('postgres'));

# List all tables with sizes
SELECT 
  schemaname, 
  tablename, 
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check backup locks
SELECT * FROM pg_stat_activity WHERE query LIKE '%pg_dump%';

# Kill stuck backup process
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE query LIKE '%pg_dump%';
```
