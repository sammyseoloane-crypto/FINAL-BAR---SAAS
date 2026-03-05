/**
 * Payment Utilities
 * Functions for handling payments, transactions, and QR code operations
 */

import { supabase } from '../supabaseClient';

/**
 * Generate a unique QR code string
 * Format: {tenant_id}_{user_id}_{transaction_id}_{timestamp}_{random}
 */
export const generateQRCode = (tenantId, userId, transactionId) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${tenantId}_${userId}_${transactionId}_${timestamp}_${random}`;
};

/**
 * Create a new transaction (customer purchases product)
 */
export const createTransaction = async (tenantId, userId, productId, amount) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          tenant_id: tenantId,
          user_id: userId,
          product_id: productId,
          amount: amount,
          status: 'pending'
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating transaction:', error);
    return { data: null, error };
  }
};

/**
 * Confirm a transaction (staff confirms payment received)
 * Also generates QR code for the customer
 */
export const confirmTransaction = async (transactionId, staffUserId) => {
  try {
    // Start a transaction to update transaction and create QR code
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .update({
        status: 'confirmed',
        confirmed_by: staffUserId,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .select()
      .single();

    if (txError) throw txError;

    // Generate QR code for this transaction
    const qrCodeString = generateQRCode(
      transaction.tenant_id,
      transaction.user_id,
      transaction.id
    );

    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .insert([
        {
          transaction_id: transaction.id,
          user_id: transaction.user_id,
          code: qrCodeString
        }
      ])
      .select()
      .single();

    if (qrError) throw qrError;

    return { 
      transaction, 
      qrCode, 
      error: null 
    };
  } catch (error) {
    console.error('Error confirming transaction:', error);
    return { transaction: null, qrCode: null, error };
  }
};

/**
 * Bulk confirm multiple transactions
 */
export const bulkConfirmTransactions = async (transactionIds, staffUserId) => {
  try {
    const results = await Promise.all(
      transactionIds.map(id => confirmTransaction(id, staffUserId))
    );

    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    return { 
      successful, 
      failed,
      total: transactionIds.length,
      successCount: successful.length,
      failCount: failed.length
    };
  } catch (error) {
    console.error('Error bulk confirming transactions:', error);
    return { successful: [], failed: [], error };
  }
};

/**
 * Cancel a transaction
 */
export const cancelTransaction = async (transactionId) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update({ status: 'cancelled' })
      .eq('id', transactionId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error cancelling transaction:', error);
    return { data: null, error };
  }
};

/**
 * Get pending transactions for a tenant
 */
export const getPendingTransactions = async (tenantId) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        users!transactions_user_id_fkey (
          id,
          full_name,
          email
        ),
        products (
          id,
          name,
          price,
          type
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    return { data: null, error };
  }
};

/**
 * Get all transactions for a tenant (with filters)
 */
export const getTransactions = async (tenantId, filters = {}) => {
  try {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        users!transactions_user_id_fkey (
          id,
          full_name,
          email
        ),
        products (
          id,
          name,
          price,
          type
        ),
        confirmed_user:users!transactions_confirmed_by_fkey (
          id,
          full_name
        )
      `)
      .eq('tenant_id', tenantId);

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.productId) {
      query = query.eq('product_id', filters.productId);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return { data: null, error };
  }
};

/**
 * Get user's own transactions (customer view)
 */
export const getMyTransactions = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        products (
          id,
          name,
          price,
          type,
          description
        ),
        qr_codes (
          id,
          code,
          scanned_at,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching my transactions:', error);
    return { data: null, error };
  }
};

/**
 * Get active QR code for a transaction
 */
export const getQRCodeForTransaction = async (transactionId) => {
  try {
    const { data, error } = await supabase
      .from('qr_codes')
      .select(`
        *,
        transactions (
          id,
          amount,
          status,
          confirmed_at,
          products (
            name,
            type
          )
        )
      `)
      .eq('transaction_id', transactionId)
      .is('scanned_at', null) // Only unscanned codes
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching QR code:', error);
    return { data: null, error };
  }
};

/**
 * Get all active QR codes for a user
 */
export const getMyQRCodes = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('qr_codes')
      .select(`
        *,
        transactions (
          id,
          amount,
          status,
          confirmed_at,
          products (
            name,
            type,
            description
          )
        )
      `)
      .eq('user_id', userId)
      .is('scanned_at', null) // Only unscanned codes
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching my QR codes:', error);
    return { data: null, error };
  }
};

/**
 * Validate and scan a QR code (staff scans at door)
 */
export const scanQRCode = async (qrCodeString, scannedByUserId) => {
  try {
    // First, verify the QR code exists and is valid
    const { data: qrCode, error: fetchError } = await supabase
      .from('qr_codes')
      .select(`
        *,
        transactions (
          id,
          status,
          amount,
          products (
            name,
            type
          )
        ),
        users (
          id,
          full_name,
          email
        )
      `)
      .eq('code', qrCodeString)
      .single();

    if (fetchError) {
      return { 
        data: null, 
        error: fetchError,
        message: 'Invalid QR code' 
      };
    }

    // Check if already scanned
    if (qrCode.scanned_at) {
      return { 
        data: qrCode, 
        error: null,
        message: 'QR code already scanned',
        alreadyScanned: true 
      };
    }

    // Check if transaction is confirmed
    if (qrCode.transactions.status !== 'confirmed') {
      return { 
        data: qrCode, 
        error: null,
        message: 'Transaction not confirmed yet',
        notConfirmed: true 
      };
    }

    // Mark as scanned
    const { data: updatedQR, error: updateError } = await supabase
      .from('qr_codes')
      .update({ scanned_at: new Date().toISOString() })
      .eq('id', qrCode.id)
      .select(`
        *,
        transactions (
          id,
          status,
          amount,
          products (
            name,
            type
          )
        ),
        users (
          id,
          full_name,
          email
        )
      `)
      .single();

    if (updateError) throw updateError;

    return { 
      data: updatedQR, 
      error: null,
      message: 'Access granted',
      success: true 
    };
  } catch (error) {
    console.error('Error scanning QR code:', error);
    return { 
      data: null, 
      error,
      message: 'Error scanning QR code' 
    };
  }
};

/**
 * Get transaction statistics for a tenant
 */
export const getTransactionStats = async (tenantId) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter(t => t.status === 'pending').length,
      confirmed: data.filter(t => t.status === 'confirmed').length,
      cancelled: data.filter(t => t.status === 'cancelled').length,
      totalRevenue: data
        .filter(t => t.status === 'confirmed')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
      pendingRevenue: data
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0)
    };

    return { data: stats, error: null };
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    return { data: null, error };
  }
};
