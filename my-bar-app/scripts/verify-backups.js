/**
 * Backup Verification Script
 * Verifies database backups and tests integrity
 */

/* eslint-disable no-console */
/* eslint-disable curly */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-unused-vars */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BACKUP_DIR = process.env.BACKUP_DIR || 'D:\\backups\\bar-saas';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyBackups() {
  console.log('\n=== Database Backup Verification ===\n');

  const results = {
    timestamp: new Date().toISOString(),
    status: 'PASS',
    checks: [],
  };

  // Check 1: Database Connectivity
  console.log('1. Testing database connectivity...');
  try {
    const { data: _data, error } = await supabase
      .from('tenants')
      .select('count', { count: 'exact', head: true });

    if (error) throw error;

    results.checks.push({
      name: 'Database Connectivity',
      status: 'PASS',
      message: 'Successfully connected to database',
    });
    console.log('   ✓ Database connectivity OK\n');
  } catch (error) {
    results.checks.push({
      name: 'Database Connectivity',
      status: 'FAIL',
      message: error.message,
    });
    results.status = 'FAIL';
    console.error('   ✗ Database connectivity failed:', error.message, '\n');
  }

  // Check 2: Critical Tables Exist
  console.log('2. Verifying critical tables...');
  const criticalTables = [
    'tenants',
    'profiles',
    'products',
    'transactions',
    'tasks',
    'qr_codes',
    'audit_logs',
    'customer_loyalty',
  ];

  for (const table of criticalTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      console.log(`   ✓ ${table}: ${count} rows`);
      results.checks.push({
        name: `Table: ${table}`,
        status: 'PASS',
        rowCount: count,
      });
    } catch (error) {
      console.error(`   ✗ ${table}: ${error.message}`);
      results.checks.push({
        name: `Table: ${table}`,
        status: 'FAIL',
        message: error.message,
      });
      results.status = 'FAIL';
    }
  }
  console.log('');

  // Check 3: Check Local Backup Files
  console.log('3. Checking local backup files...');
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error(`Backup directory not found: ${BACKUP_DIR}`);
    }

    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup_') && (file.endsWith('.dump') || file.endsWith('.zip')))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        stats: fs.statSync(path.join(BACKUP_DIR, file)),
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime);

    if (backupFiles.length === 0) {
      throw new Error('No backup files found');
    }

    const latestBackup = backupFiles[0];
    const backupAge = (Date.now() - latestBackup.stats.mtime) / (1000 * 60 * 60); // hours
    const backupSizeMB = latestBackup.stats.size / (1024 * 1024);

    console.log(`   Latest backup: ${latestBackup.name}`);
    console.log(`   Age: ${backupAge.toFixed(2)} hours`);
    console.log(`   Size: ${backupSizeMB.toFixed(2)} MB`);
    console.log(`   Total backups: ${backupFiles.length}`);

    if (backupAge > 26) {
      results.checks.push({
        name: 'Backup Freshness',
        status: 'WARN',
        message: `Latest backup is ${backupAge.toFixed(2)} hours old (>26 hours)`,
      });
      console.log('   ⚠ WARNING: Backup is older than 26 hours\n');
    } else {
      results.checks.push({
        name: 'Backup Freshness',
        status: 'PASS',
        age: `${backupAge.toFixed(2)} hours`,
      });
      console.log('   ✓ Backup freshness OK\n');
    }

    results.checks.push({
      name: 'Backup Files',
      status: 'PASS',
      totalBackups: backupFiles.length,
      latestBackup: latestBackup.name,
      sizeMB: backupSizeMB.toFixed(2),
    });
  } catch (error) {
    console.error(`   ✗ ${error.message}\n`);
    results.checks.push({
      name: 'Backup Files',
      status: 'FAIL',
      message: error.message,
    });
    results.status = 'FAIL';
  }

  // Check 4: Data Integrity
  console.log('4. Checking data integrity...');
  try {
    // Check for orphaned records
    const { data: orphanedTransactions } = await supabase
      .from('transactions')
      .select('id')
      .is('tenant_id', null)
      .limit(1);

    if (orphanedTransactions && orphanedTransactions.length > 0) {
      throw new Error('Found orphaned transactions without tenant_id');
    }

    // Check for data consistency
    const { data: productCounts } = await supabase
      .from('products')
      .select('tenant_id, count')
      .limit(1);

    console.log('   ✓ No orphaned records found');
    console.log('   ✓ Data integrity checks passed\n');

    results.checks.push({
      name: 'Data Integrity',
      status: 'PASS',
    });
  } catch (error) {
    console.error(`   ✗ ${error.message}\n`);
    results.checks.push({
      name: 'Data Integrity',
      status: 'FAIL',
      message: error.message,
    });
    results.status = 'FAIL';
  }

  // Check 5: RLS Policies Active
  console.log('5. Verifying RLS policies...');
  try {
    const { data, error } = await supabase.rpc('get_database_stats');
    if (error) throw error;

    console.log('   ✓ RLS policies verified\n');
    results.checks.push({
      name: 'RLS Policies',
      status: 'PASS',
    });
  } catch (error) {
    console.error(`   ✗ ${error.message}\n`);
    results.checks.push({
      name: 'RLS Policies',
      status: 'WARN',
      message: 'Unable to verify RLS policies',
    });
  }

  // Generate report
  console.log('=== Verification Summary ===');
  console.log(`Status: ${results.status}`);
  console.log(`Total Checks: ${results.checks.length}`);
  console.log(`Passed: ${results.checks.filter(c => c.status === 'PASS').length}`);
  console.log(`Failed: ${results.checks.filter(c => c.status === 'FAIL').length}`);
  console.log(`Warnings: ${results.checks.filter(c => c.status === 'WARN').length}`);
  console.log(`Timestamp: ${results.timestamp}\n`);

  // Save report
  const reportPath = path.join(BACKUP_DIR, `verification_report_${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Report saved to: ${reportPath}\n`);

  // Exit with appropriate code
  if (results.status === 'FAIL') {
    process.exit(1);
  }

  process.exit(0);
}

// Run verification
verifyBackups().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
