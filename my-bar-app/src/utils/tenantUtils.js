/**
 * Tenant Management Utilities
 * Ensures proper multi-tenant isolation across the application
 */

import { supabase } from '../supabaseClient';

/**
 * Get current user's tenant_id from their profile
 * @returns {Promise<string|null>} tenant_id or null
 */
export const getCurrentTenantId = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (error) {
      throw error;
    }
    return data?.tenant_id || null;
  } catch (error) {
    console.error('Error fetching tenant_id:', error);
    return null;
  }
};

/**
 * Query builder that automatically adds tenant_id filter
 * @param {string} table - Table name
 * @param {string} tenantId - Tenant ID to filter by
 * @returns {Object} Supabase query builder
 */
export const tenantQuery = (table, tenantId) => {
  if (!tenantId) {
    throw new Error('tenantId is required for tenant queries');
  }

  return supabase.from(table).select('*').eq('tenant_id', tenantId);
};

/**
 * Insert data with automatic tenant_id assignment
 * @param {string} table - Table name
 * @param {Object|Array} data - Data to insert
 * @param {string} tenantId - Tenant ID
 * @returns {Promise} Supabase insert result
 */
export const tenantInsert = async (table, data, tenantId) => {
  if (!tenantId) {
    throw new Error('tenantId is required for inserting data');
  }

  // Handle both single object and array of objects
  const dataWithTenant = Array.isArray(data)
    ? data.map((item) => ({ ...item, tenant_id: tenantId }))
    : { ...data, tenant_id: tenantId };

  return await supabase.from(table).insert(dataWithTenant).select();
};

/**
 * Update data with tenant_id verification
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {string} id - Record ID
 * @param {string} tenantId - Tenant ID for verification
 * @returns {Promise} Supabase update result
 */
export const tenantUpdate = async (table, data, id, tenantId) => {
  if (!tenantId) {
    throw new Error('tenantId is required for updating data');
  }

  return await supabase
    .from(table)
    .update(data)
    .eq('id', id)
    .eq('tenant_id', tenantId) // Ensures user can only update their tenant's data
    .select();
};

/**
 * Delete data with tenant_id verification
 * @param {string} table - Table name
 * @param {string} id - Record ID
 * @param {string} tenantId - Tenant ID for verification
 * @returns {Promise} Supabase delete result
 */
export const tenantDelete = async (table, id, tenantId) => {
  if (!tenantId) {
    throw new Error('tenantId is required for deleting data');
  }

  return await supabase.from(table).delete().eq('id', id).eq('tenant_id', tenantId); // Ensures user can only delete their tenant's data
};

/**
 * Get tenant information
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object|null>} Tenant data or null
 */
export const getTenantInfo = async (tenantId) => {
  try {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).single();

    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error fetching tenant info:', error);
    return null;
  }
};

/**
 * Check if tenant subscription is active
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<boolean>} True if subscription is active
 */
export const isTenantActive = async (tenantId) => {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('subscription_status, subscription_end')
      .eq('id', tenantId)
      .single();

    if (error) {
      throw error;
    }

    if (data.subscription_status === 'inactive') {
      return false;
    }

    if (data.subscription_end) {
      return new Date(data.subscription_end) > new Date();
    }

    return data.subscription_status === 'active' || data.subscription_status === 'trial';
  } catch (error) {
    console.error('Error checking tenant status:', error);
    return false;
  }
};

/**
 * Get all users in a tenant (owner/admin only)
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Array>} Array of users
 */
export const getTenantUsers = async (tenantId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching tenant users:', error);
    return [];
  }
};

/**
 * Validate that user belongs to tenant
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<boolean>} True if user belongs to tenant
 */
export const validateUserTenant = async (userId, tenantId) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }
    return data?.tenant_id === tenantId;
  } catch (error) {
    console.error('Error validating user tenant:', error);
    return false;
  }
};

/**
 * Switch user's tenant (for testing/admin purposes only)
 * WARNING: This bypasses normal security. Use only in development.
 * @param {string} userId - User ID
 * @param {string} newTenantId - New tenant ID
 * @returns {Promise} Update result
 */
export const switchUserTenant = async (userId, newTenantId) => {
  console.warn('⚠️ switchUserTenant should only be used in development/testing');

  return await supabase.from('users').update({ tenant_id: newTenantId }).eq('id', userId);
};

export default {
  getCurrentTenantId,
  tenantQuery,
  tenantInsert,
  tenantUpdate,
  tenantDelete,
  getTenantInfo,
  isTenantActive,
  getTenantUsers,
  validateUserTenant,
  switchUserTenant,
};
