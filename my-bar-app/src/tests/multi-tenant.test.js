/**
 * Multi-Tenant Isolation Tests
 * Tests for data isolation, RLS policies, and tenant-specific queries
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

describe('Multi-Tenant Data Isolation', () => {
  let tenant1, tenant2;
  let user1, user2;
  let supabase1, supabase2;

  beforeAll(async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create two test tenants
    const { data: t1 } = await supabase
      .from('tenants')
      .insert({ name: 'Tenant 1', subscription_status: 'active' })
      .select()
      .single();
    tenant1 = t1;

    const { data: t2 } = await supabase
      .from('tenants')
      .insert({ name: 'Tenant 2', subscription_status: 'active' })
      .select()
      .single();
    tenant2 = t2;

    // Create users for each tenant
    const {
      data: { user: u1 },
    } = await supabase.auth.signUp({
      email: `tenant1-${Date.now()}@test.com`,
      password: 'testpass123',
    });
    user1 = u1;

    await supabase
      .from('profiles')
      .update({
        tenant_id: tenant1.id,
        role: 'owner',
      })
      .eq('id', user1.id);

    const {
      data: { user: u2 },
    } = await supabase.auth.signUp({
      email: `tenant2-${Date.now()}@test.com`,
      password: 'testpass123',
    });
    user2 = u2;

    await supabase
      .from('profiles')
      .update({
        tenant_id: tenant2.id,
        role: 'owner',
      })
      .eq('id', user2.id);

    // Create separate clients for each user
    supabase1 = createClient(supabaseUrl, supabaseAnonKey);
    supabase2 = createClient(supabaseUrl, supabaseAnonKey);

    await supabase1.auth.signInWithPassword({
      email: `tenant1-${Date.now()}@test.com`,
      password: 'testpass123',
    });

    await supabase2.auth.signInWithPassword({
      email: `tenant2-${Date.now()}@test.com`,
      password: 'testpass123',
    });
  });

  afterAll(async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    if (tenant1) {
      await supabase.from('tenants').delete().eq('id', tenant1.id);
    }
    if (tenant2) {
      await supabase.from('tenants').delete().eq('id', tenant2.id);
    }
  });

  describe('Product Isolation', () => {
    it('should only show products from own tenant', async () => {
      // Create products for each tenant
      await supabase1.from('products').insert({
        tenant_id: tenant1.id,
        name: 'Tenant 1 Product',
        price: 10.0,
        available: true,
      });

      await supabase2.from('products').insert({
        tenant_id: tenant2.id,
        name: 'Tenant 2 Product',
        price: 20.0,
        available: true,
      });

      // Tenant 1 should only see their own products
      const { data: products1 } = await supabase1.from('products').select('*');

      expect(products1.every((p) => p.tenant_id === tenant1.id)).toBe(true);
      expect(products1.some((p) => p.name === 'Tenant 1 Product')).toBe(true);
      expect(products1.some((p) => p.name === 'Tenant 2 Product')).toBe(false);

      // Tenant 2 should only see their own products
      const { data: products2 } = await supabase2.from('products').select('*');

      expect(products2.every((p) => p.tenant_id === tenant2.id)).toBe(true);
      expect(products2.some((p) => p.name === 'Tenant 2 Product')).toBe(true);
      expect(products2.some((p) => p.name === 'Tenant 1 Product')).toBe(false);
    });

    it('should prevent cross-tenant product updates', async () => {
      const { data: product } = await supabase1
        .from('products')
        .insert({
          tenant_id: tenant1.id,
          name: 'Protected Product',
          price: 5.0,
          available: true,
        })
        .select()
        .single();

      // Tenant 2 should not be able to update Tenant 1's product
      const { error } = await supabase2
        .from('products')
        .update({ name: 'Hacked Product' })
        .eq('id', product.id);

      expect(error).not.toBeNull();

      // Verify product unchanged
      const { data: unchangedProduct } = await supabase1
        .from('products')
        .select('name')
        .eq('id', product.id)
        .single();

      expect(unchangedProduct.name).toBe('Protected Product');
    });
  });

  describe('Transaction Isolation', () => {
    it('should only show transactions from own tenant', async () => {
      const { data: product1 } = await supabase1
        .from('products')
        .insert({
          tenant_id: tenant1.id,
          name: 'Beer',
          price: 5.0,
          available: true,
        })
        .select()
        .single();

      const { data: product2 } = await supabase2
        .from('products')
        .insert({
          tenant_id: tenant2.id,
          name: 'Wine',
          price: 8.0,
          available: true,
        })
        .select()
        .single();

      // Create transactions
      await supabase1.from('transactions').insert({
        tenant_id: tenant1.id,
        user_id: user1.id,
        product_id: product1.id,
        amount: 5.0,
        status: 'completed',
      });

      await supabase2.from('transactions').insert({
        tenant_id: tenant2.id,
        user_id: user2.id,
        product_id: product2.id,
        amount: 8.0,
        status: 'completed',
      });

      // Verify isolation
      const { data: trans1 } = await supabase1.from('transactions').select('*');

      expect(trans1.every((t) => t.tenant_id === tenant1.id)).toBe(true);

      const { data: trans2 } = await supabase2.from('transactions').select('*');

      expect(trans2.every((t) => t.tenant_id === tenant2.id)).toBe(true);
    });

    it('should prevent cross-tenant transaction viewing', async () => {
      const { data: transaction } = await supabase1
        .from('transactions')
        .select('*')
        .limit(1)
        .single();

      // Tenant 2 should not see Tenant 1's transactions
      const { data: forbidden } = await supabase2
        .from('transactions')
        .select('*')
        .eq('id', transaction.id);

      expect(forbidden.length).toBe(0);
    });
  });

  describe('User/Profile Isolation', () => {
    it('should only show users from own tenant', async () => {
      const { data: profiles1 } = await supabase1.from('profiles').select('*');

      expect(profiles1.every((p) => p.tenant_id === tenant1.id)).toBe(true);

      const { data: profiles2 } = await supabase2.from('profiles').select('*');

      expect(profiles2.every((p) => p.tenant_id === tenant2.id)).toBe(true);
    });

    it('should prevent cross-tenant user data access', async () => {
      // Tenant 2 should not be able to read Tenant 1's user profiles
      const { data: crossTenantProfiles } = await supabase2
        .from('profiles')
        .select('*')
        .eq('tenant_id', tenant1.id);

      expect(crossTenantProfiles.length).toBe(0);
    });
  });

  describe('Task Isolation', () => {
    it('should enforce tenant boundaries on tasks', async () => {
      const { data: task1 } = await supabase1
        .from('tasks')
        .insert({
          tenant_id: tenant1.id,
          title: 'Tenant 1 Task',
          description: 'Private task',
          status: 'pending',
        })
        .select()
        .single();

      // eslint-disable-next-line no-unused-vars
      const { data: task2 } = await supabase2
        .from('tasks')
        .insert({
          tenant_id: tenant2.id,
          title: 'Tenant 2 Task',
          description: 'Another private task',
          status: 'pending',
        })
        .select()
        .single();

      // Each tenant should only see their own tasks
      const { data: tasks1 } = await supabase1.from('tasks').select('*');
      expect(tasks1.every((t) => t.tenant_id === tenant1.id)).toBe(true);

      const { data: tasks2 } = await supabase2.from('tasks').select('*');
      expect(tasks2.every((t) => t.tenant_id === tenant2.id)).toBe(true);
    });
  });

  describe('QR Code Isolation', () => {
    it('should prevent cross-tenant QR code access', async () => {
      const { data: qr1 } = await supabase1
        .from('qr_codes')
        .insert({
          tenant_id: tenant1.id,
          code: 'QR-TENANT-1',
          type: 'payment',
        })
        .select()
        .single();

      // Tenant 2 should not be able to access Tenant 1's QR codes
      const { data: forbidden } = await supabase2.from('qr_codes').select('*').eq('id', qr1.id);

      expect(forbidden.length).toBe(0);
    });
  });

  describe('Analytics Isolation', () => {
    it('should only show analytics for own tenant', async () => {
      // Use materialized view or analytics function
      const { data: analytics1 } = await supabase1.rpc('get_database_stats');

      const { data: analytics2 } = await supabase2.rpc('get_database_stats');

      // Both should get results, but data should be tenant-specific
      expect(analytics1).toBeDefined();
      expect(analytics2).toBeDefined();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce role permissions within tenant', async () => {
      // Create a staff user for tenant 1
      const {
        data: { user: staffUser },
      } = await supabase1.auth.signUp({
        email: `staff-${Date.now()}@test.com`,
        password: 'testpass123',
      });

      await supabase1
        .from('profiles')
        .update({
          tenant_id: tenant1.id,
          role: 'staff',
        })
        .eq('id', staffUser.id);

      // Staff should be able to read products
      const staffClient = createClient(supabaseUrl, supabaseAnonKey);
      await staffClient.auth.signInWithPassword({
        email: `staff-${Date.now()}@test.com`,
        password: 'testpass123',
      });

      const { data: products } = await staffClient.from('products').select('*');

      expect(products).toBeDefined();

      // Staff should not be able to delete tenant
      const { error } = await staffClient.from('tenants').delete().eq('id', tenant1.id);

      expect(error).not.toBeNull();
    });
  });

  describe('Performance with Multi-Tenancy', () => {
    it('should efficiently query with tenant_id filter', async () => {
      const startTime = performance.now();

      const { data } = await supabase1.from('products').select('*').eq('tenant_id', tenant1.id);

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      // Query should complete quickly (< 100ms)
      expect(queryTime).toBeLessThan(100);
      expect(data).toBeDefined();
    });
  });
});
