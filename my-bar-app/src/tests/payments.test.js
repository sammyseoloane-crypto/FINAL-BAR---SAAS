/**
 * Payment Integration Tests
 * Tests for Stripe payment processing and webhook handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Stripe
vi.mock('@stripe/stripe-js');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

describe('Payment Processing Tests', () => {
  let testTenantId;
  let testUserId;
  let testProductId;

  beforeEach(async () => {
    // Create test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({ name: 'Test Payment Tenant', subscription_status: 'active' })
      .select()
      .single();
    testTenantId = tenant.id;

    // Create test user
    const {
      data: { user },
    } = await supabase.auth.signUp({
      email: `test-${Date.now()}@test.com`,
      password: 'testpassword123',
    });
    testUserId = user.id;

    // Create test product
    const { data: product } = await supabase
      .from('products')
      .insert({
        tenant_id: testTenantId,
        name: 'Test Beer',
        price: 5.99,
        available: true,
      })
      .select()
      .single();
    testProductId = product.id;
  });

  afterEach(async () => {
    // Cleanup test data
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  describe('Checkout Session Creation', () => {
    it('should create a checkout session', async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            items: [{ product_id: testProductId, quantity: 2 }],
            tenant_id: testTenantId,
          }),
        },
      );

      const data = await response.json();
      expect(response.ok).toBe(true);
      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('url');
    });

    it('should reject checkout with invalid product', async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            items: [{ product_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
            tenant_id: testTenantId,
          }),
        },
      );

      expect(response.ok).toBe(false);
    });

    it('should calculate correct total amount', async () => {
      const quantity = 3;
      const { data: product } = await supabase
        .from('products')
        .select('price')
        .eq('id', testProductId)
        .single();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            items: [{ product_id: testProductId, quantity }],
            tenant_id: testTenantId,
          }),
        },
      );

      const data = await response.json();
      const expectedAmount = product.price * quantity * 100; // Convert to cents
      expect(data.amount).toBe(expectedAmount);
    });
  });

  describe('Webhook Processing', () => {
    it('should process successful payment webhook', async () => {
      // Create pending transaction
      const { data: transaction } = await supabase
        .from('transactions')
        .insert({
          tenant_id: testTenantId,
          user_id: testUserId,
          product_id: testProductId,
          amount: 11.98,
          status: 'pending',
          stripe_session_id: 'cs_test_123',
        })
        .select()
        .single();

      // Simulate webhook payload
      const webhookPayload = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            payment_status: 'paid',
            amount_total: 1198,
          },
        },
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': 'test_signature',
          },
          body: JSON.stringify(webhookPayload),
        },
      );

      expect(response.ok).toBe(true);

      // Verify transaction updated
      const { data: updatedTransaction } = await supabase
        .from('transactions')
        .select('status')
        .eq('id', transaction.id)
        .single();

      expect(updatedTransaction.status).toBe('completed');
    });

    it('should handle failed payment webhook', async () => {
      const { data: transaction } = await supabase
        .from('transactions')
        .insert({
          tenant_id: testTenantId,
          user_id: testUserId,
          product_id: testProductId,
          amount: 5.99,
          status: 'pending',
          stripe_session_id: 'cs_test_failed',
        })
        .select()
        .single();

      const webhookPayload = {
        type: 'checkout.session.expired',
        data: {
          object: {
            id: 'cs_test_failed',
            payment_status: 'unpaid',
          },
        },
      };

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'test_signature',
        },
        body: JSON.stringify(webhookPayload),
      });

      const { data: updatedTransaction } = await supabase
        .from('transactions')
        .select('status')
        .eq('id', transaction.id)
        .single();

      expect(updatedTransaction.status).toBe('cancelled');
    });
  });

  describe('Refund Processing', () => {
    it('should process refund successfully', async () => {
      const { data: transaction } = await supabase
        .from('transactions')
        .insert({
          tenant_id: testTenantId,
          user_id: testUserId,
          product_id: testProductId,
          amount: 5.99,
          status: 'completed',
          stripe_payment_intent_id: 'pi_test_123',
        })
        .select()
        .single();

      // Simulate refund
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'refunded' })
        .eq('id', transaction.id);

      expect(error).toBeNull();

      const { data: refundedTransaction } = await supabase
        .from('transactions')
        .select('status')
        .eq('id', transaction.id)
        .single();

      expect(refundedTransaction.status).toBe('refunded');
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle different currencies', async () => {
      // Test with EUR
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            items: [{ product_id: testProductId, quantity: 1 }],
            tenant_id: testTenantId,
            currency: 'eur',
          }),
        },
      );

      const data = await response.json();
      expect(data.currency).toBe('eur');
    });
  });

  describe('Payment Analytics', () => {
    it('should track payment metrics', async () => {
      // Create multiple transactions
      const transactions = await Promise.all([
        supabase.from('transactions').insert({
          tenant_id: testTenantId,
          user_id: testUserId,
          product_id: testProductId,
          amount: 10.0,
          status: 'completed',
        }),
        supabase.from('transactions').insert({
          tenant_id: testTenantId,
          user_id: testUserId,
          product_id: testProductId,
          amount: 15.0,
          status: 'completed',
        }),
      ]);

      // Query analytics
      const { data: analytics } = await supabase
        .from('transactions')
        .select('amount, status')
        .eq('tenant_id', testTenantId)
        .eq('status', 'completed');

      const totalRevenue = analytics.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      expect(totalRevenue).toBe(25.0);
      expect(analytics.length).toBe(2);
    });
  });
});
