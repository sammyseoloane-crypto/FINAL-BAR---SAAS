/**
 * Tax Utilities
 * Helper functions for tax calculation and compliance
 */

import { supabase } from '../supabaseClient';

/**
 * Fetch tax categories for a tenant
 */
export const fetchTaxCategories = async (tenantId) => {
  try {
    const { data, error } = await supabase
      .from('tax_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching tax categories:', error);
    return [];
  }
};

/**
 * Calculate tax for a product
 */
export const calculateProductTax = async (amount, productId, tenantId) => {
  try {
    // Fetch product category
    let categoryId = null;
    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('category_id')
        .eq('id', productId)
        .single();

      categoryId = product?.category_id;
    }

    // Fetch applicable tax rates
    const { data: taxCategories, error } = await supabase
      .from('tax_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const taxes = [];
    let totalTax = 0;

    taxCategories.forEach((tax) => {
      let applies = false;

      if (tax.applies_to_all) {
        applies = true;
      } else if (categoryId && tax.product_categories?.includes(categoryId)) {
        applies = true;
      }

      if (applies) {
        const taxAmount = (parseFloat(amount) * parseFloat(tax.rate)) / 100;
        taxes.push({
          id: tax.id,
          name: tax.name,
          rate: tax.rate,
          amount: taxAmount,
          description: tax.description,
        });
        totalTax += taxAmount;
      }
    });

    return {
      subtotal: parseFloat(amount),
      taxes: taxes,
      totalTax: totalTax,
      total: parseFloat(amount) + totalTax,
    };
  } catch (error) {
    console.error('Error calculating product tax:', error);
    return {
      subtotal: parseFloat(amount),
      taxes: [],
      totalTax: 0,
      total: parseFloat(amount),
    };
  }
};

/**
 * Calculate tax for entire cart
 */
export const calculateCartTax = async (cartItems, tenantId) => {
  try {
    let subtotal = 0;
    let totalTax = 0;
    const itemsWithTax = [];

    // Calculate tax for each item sequentially
    /* eslint-disable no-await-in-loop */
    for (const item of cartItems) {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      const taxCalc = await calculateProductTax(itemTotal, item.product_id, tenantId);
      totalTax += taxCalc.totalTax;

      itemsWithTax.push({
        ...item,
        tax: taxCalc.totalTax,
        totalWithTax: taxCalc.total,
      });
    }
    /* eslint-enable no-await-in-loop */

    return {
      subtotal,
      totalTax,
      total: subtotal + totalTax,
      items: itemsWithTax,
    };
  } catch (error) {
    console.error('Error calculating cart tax:', error);
    return {
      subtotal: 0,
      totalTax: 0,
      total: 0,
      items: [],
    };
  }
};

/**
 * Create or update tax category
 */
export const saveTaxCategory = async (taxData, tenantId) => {
  try {
    const categoryData = {
      ...taxData,
      tenant_id: tenantId,
      rate: parseFloat(taxData.rate),
    };

    if (taxData.id) {
      // Update existing
      const { data, error } = await supabase
        .from('tax_categories')
        .update(categoryData)
        .eq('id', taxData.id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return { success: true, data };
    } else {
      // Create new
      const { data, error } = await supabase
        .from('tax_categories')
        .insert([categoryData])
        .select()
        .single();

      if (error) {
        throw error;
      }
      return { success: true, data };
    }
  } catch (error) {
    console.error('Error saving tax category:', error);
    return { success: false, error };
  }
};

/**
 * Delete tax category
 */
export const deleteTaxCategory = async (taxId) => {
  try {
    const { error } = await supabase.from('tax_categories').delete().eq('id', taxId);

    if (error) {
      throw error;
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting tax category:', error);
    return { success: false, error };
  }
};

/**
 * Get tax summary for reporting
 */
export const getTaxSummary = async (tenantId, startDate, endDate) => {
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('amount, tax_amount, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      throw error;
    }

    const summary = {
      totalRevenue: 0,
      totalTax: 0,
      transactionCount: transactions.length,
      averageTax: 0,
    };

    transactions.forEach((t) => {
      summary.totalRevenue += parseFloat(t.amount);
      summary.totalTax += parseFloat(t.tax_amount || 0);
    });

    summary.averageTax =
      summary.transactionCount > 0 ? summary.totalTax / summary.transactionCount : 0;

    return summary;
  } catch (error) {
    console.error('Error getting tax summary:', error);
    return {
      totalRevenue: 0,
      totalTax: 0,
      transactionCount: 0,
      averageTax: 0,
    };
  }
};

/**
 * Format tax rate as percentage
 */
export const formatTaxRate = (rate) => {
  return `${parseFloat(rate).toFixed(2)}%`;
};

/**
 * Validate tax rate
 */
export const isValidTaxRate = (rate) => {
  const numRate = parseFloat(rate);
  return !isNaN(numRate) && numRate >= 0 && numRate <= 100;
};
