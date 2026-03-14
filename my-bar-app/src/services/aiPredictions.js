/**
 * AI Predictions Service
 * Predicts drink demand, revenue, and sales patterns
 * Uses historical data from transactions, events, and products
 */

import { supabase } from '../supabaseClient';

/**
 * Generate sales predictions for a specific date
 * @param {Date} targetDate - Date to predict
 * @param {Object} options - { productId, eventId, locationId }
 * @returns {Promise<Object>} Prediction results
 */
export async function generateSalesPrediction(targetDate, options = {}) {
  try {
    const { productId, eventId, locationId } = options;

    // Get user's tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 90);

    const { data: historicalData } = await supabase
      .from('transactions')
      .select(`
        id,
        total_amount,
        created_at,
        metadata,
        orders (
          product_id,
          quantity,
          unit_price,
          subtotal
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', startDate.toISOString())
      .eq('status', 'completed');

    if (!historicalData || historicalData.length === 0) {
      return {
        error: 'Insufficient historical data for predictions',
        message: 'Need at least 30 days of transaction data',
      };
    }

    // Analyze patterns
    const patterns = analyzeHistoricalPatterns(historicalData, productId);

    // Generate predictions
    const predictions = calculatePredictions(patterns, targetDate, {
      productId,
      eventId,
      locationId,
      tenantId: profile.tenant_id,
    });

    // Save predictions to database
    await savePredictions(predictions, profile.tenant_id);

    return {
      success: true,
      predictions,
      confidence: patterns.confidence,
      dataPoints: historicalData.length,
    };

  } catch (error) {
    console.error('Error generating predictions:', error);
    return {
      error: error.message,
      success: false,
    };
  }
}

/**
 * Analyze historical transaction patterns
 * @param {Array} transactions - Historical transactions
 * @param {string} productId - Optional product filter
 * @returns {Object} Pattern analysis
 */
function analyzeHistoricalPatterns(transactions, productId = null) {
  // Group by day of week
  const byDayOfWeek = Array(7).fill(0).map(() => ({ count: 0, revenue: 0 }));

  // Group by hour
  const byHour = Array(24).fill(0).map(() => ({ count: 0, revenue: 0 }));

  // Product-specific data
  const productSales = {};

  transactions.forEach(transaction => {
    const date = new Date(transaction.created_at);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    byDayOfWeek[dayOfWeek].count++;
    byDayOfWeek[dayOfWeek].revenue += parseFloat(transaction.total_amount);

    byHour[hour].count++;
    byHour[hour].revenue += parseFloat(transaction.total_amount);

    // Analyze product sales
    if (transaction.orders) {
      transaction.orders.forEach(order => {
        if (!productId || order.product_id === productId) {
          if (!productSales[order.product_id]) {
            productSales[order.product_id] = {
              totalQuantity: 0,
              totalRevenue: 0,
              transactionCount: 0,
            };
          }
          productSales[order.product_id].totalQuantity += order.quantity;
          productSales[order.product_id].totalRevenue += parseFloat(order.subtotal);
          productSales[order.product_id].transactionCount++;
        }
      });
    }
  });

  // Calculate peak hours
  const peakHourData = byHour.reduce((peak, current, index) => {
    if (current.revenue > peak.revenue) {
      return { hour: index, ...current };
    }
    return peak;
  }, { hour: 0, revenue: 0, count: 0 });

  // Calculate confidence based on data consistency
  const revenueVariance = calculateVariance(byDayOfWeek.map(d => d.revenue));
  const confidence = Math.max(0.5, Math.min(0.99, 1 - (revenueVariance / 10000)));

  return {
    byDayOfWeek,
    byHour,
    productSales,
    peakHourStart: peakHourData.hour,
    peakHourEnd: (peakHourData.hour + 2) % 24,
    confidence,
    totalTransactions: transactions.length,
  };
}

/**
 * Calculate predictions based on patterns
 * @param {Object} patterns - Analyzed patterns
 * @param {Date} targetDate - Date to predict
 * @param {Object} context - Additional context
 * @returns {Array} Predictions
 */
function calculatePredictions(patterns, targetDate, context) {
  const predictions = [];
  const dayOfWeek = targetDate.getDay();

  // Daily prediction
  const avgDailySales = patterns.byDayOfWeek[dayOfWeek];
  const dailyPrediction = {
    prediction_type: 'daily',
    prediction_date: targetDate.toISOString().split('T')[0],
    predicted_sales_volume: Math.round(avgDailySales.count),
    predicted_revenue: avgDailySales.revenue,
    confidence_score: patterns.confidence,
    day_of_week: dayOfWeek,
    peak_hour_start: patterns.peakHourStart,
    peak_hour_end: patterns.peakHourEnd,
    model_version: 'v1.0-pattern-based',
    training_data_size: patterns.totalTransactions,
  };

  predictions.push(dailyPrediction);

  // Hourly predictions
  patterns.byHour.forEach((hourData, hour) => {
    if (hourData.count > 0) {
      predictions.push({
        prediction_type: 'hourly',
        prediction_date: targetDate.toISOString().split('T')[0],
        hour_of_day: hour,
        predicted_sales_volume: Math.round(hourData.count / 7), // Average per day
        predicted_revenue: hourData.revenue / 7,
        confidence_score: patterns.confidence * 0.9, // Slightly lower for hourly
        day_of_week: dayOfWeek,
        model_version: 'v1.0-pattern-based',
        training_data_size: patterns.totalTransactions,
      });
    }
  });

  // Product-specific predictions
  if (context.productId && patterns.productSales[context.productId]) {
    const productData = patterns.productSales[context.productId];
    predictions.push({
      prediction_type: 'product',
      prediction_date: targetDate.toISOString().split('T')[0],
      product_id: context.productId,
      predicted_sales_volume: Math.round(productData.totalQuantity / 90), // Daily average
      predicted_revenue: productData.totalRevenue / 90,
      confidence_score: patterns.confidence,
      model_version: 'v1.0-pattern-based',
      training_data_size: productData.transactionCount,
    });
  }

  // Event prediction (if event context provided)
  if (context.eventId) {
    predictions.push({
      prediction_type: 'event',
      prediction_date: targetDate.toISOString().split('T')[0],
      event_id: context.eventId,
      event_factor: true,
      predicted_sales_volume: Math.round(avgDailySales.count * 1.5), // 50% boost during events
      predicted_revenue: avgDailySales.revenue * 1.5,
      confidence_score: patterns.confidence * 0.85,
      model_version: 'v1.0-pattern-based',
      training_data_size: patterns.totalTransactions,
    });
  }

  return predictions;
}

/**
 * Save predictions to database
 * @param {Array} predictions - Predictions to save
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<void>}
 */
async function savePredictions(predictions, tenantId) {
  const recordsToInsert = predictions.map(pred => ({
    tenant_id: tenantId,
    ...pred,
    metadata: {},
  }));

  const { error } = await supabase
    .from('sales_predictions')
    .upsert(recordsToInsert, {
      onConflict: 'tenant_id,prediction_date,prediction_type,product_id,hour_of_day',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error saving predictions:', error);
    throw error;
  }
}

/**
 * Get predictions for a date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} filters - { productId, eventId }
 * @returns {Promise<Array>} Predictions
 */
export async function getPredictions(startDate, endDate, filters = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    let query = supabase
      .from('sales_predictions')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .gte('prediction_date', startDate.toISOString().split('T')[0])
      .lte('prediction_date', endDate.toISOString().split('T')[0])
      .order('prediction_date', { ascending: true })
      .order('hour_of_day', { ascending: true });

    if (filters.productId) {
      query = query.eq('product_id', filters.productId);
    }

    if (filters.eventId) {
      query = query.eq('event_id', filters.eventId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching predictions:', error);
    return [];
  }
}

/**
 * Generate inventory predictions
 * @param {string} productId - Product ID to predict
 * @returns {Promise<Object>} Inventory prediction
 */
export async function generateInventoryPrediction(productId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    // Get current inventory
    const { data: inventory } = await supabase
      .from('inventory')
      .select('current_stock, minimum_stock')
      .eq('product_id', productId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (!inventory) {
      throw new Error('Inventory record not found');
    }

    // Get stock movements from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: movements } = await supabase
      .from('stock_movements')
      .select('quantity, movement_type, created_at')
      .eq('product_id', productId)
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!movements || movements.length === 0) {
      return {
        error: 'Insufficient stock movement data',
        message: 'Need at least 7 days of stock data',
      };
    }

    // Calculate daily usage (only count 'sale' movements)
    const saleMovements = movements.filter(m => m.movement_type === 'sale');
    const totalUsed = saleMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const dailyAvgUsage = totalUsed / 30;
    const weeklyAvgUsage = dailyAvgUsage * 7;

    // Calculate stockout date
    const daysUntilStockout = inventory.current_stock / dailyAvgUsage;
    const stockoutDate = new Date();
    stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysUntilStockout));

    // Determine risk level
    let riskLevel = 'low';
    if (daysUntilStockout <= 3) {
      riskLevel = 'critical';
    } else if (daysUntilStockout <= 7) {
      riskLevel = 'high';
    } else if (daysUntilStockout <= 14) {
      riskLevel = 'medium';
    }

    // Calculate suggested reorder
    const optimalStock = dailyAvgUsage * 30; // 30 days supply
    const suggestedReorder = Math.max(0, optimalStock - inventory.current_stock);
    const reorderDate = new Date();
    reorderDate.setDate(reorderDate.getDate() + Math.floor(daysUntilStockout - 7)); // Reorder 7 days before stockout

    const prediction = {
      tenant_id: profile.tenant_id,
      product_id: productId,
      current_stock: inventory.current_stock,
      minimum_stock: inventory.minimum_stock,
      predicted_daily_usage: dailyAvgUsage,
      predicted_weekly_usage: weeklyAvgUsage,
      predicted_stockout_date: stockoutDate.toISOString().split('T')[0],
      days_until_stockout: Math.floor(daysUntilStockout),
      suggested_reorder_quantity: Math.ceil(suggestedReorder),
      suggested_reorder_date: reorderDate.toISOString().split('T')[0],
      optimal_stock_level: Math.ceil(optimalStock),
      low_stock_risk: riskLevel,
      stockout_probability: Math.max(0, Math.min(1, 1 - (daysUntilStockout / 30))),
      seasonal_factor: 1.0,
      trend_factor: 1.0,
      upcoming_events_factor: 1.0,
      model_version: 'v1.0-linear',
      confidence_score: 0.85,
      based_on_days_data: 30,
      is_current: true,
    };

    // Save prediction
    const { error } = await supabase
      .from('inventory_predictions')
      .insert(prediction);

    if (error) {
      throw error;
    }

    return {
      success: true,
      prediction,
    };

  } catch (error) {
    console.error('Error generating inventory prediction:', error);
    return {
      error: error.message,
      success: false,
    };
  }
}

/**
 * Get inventory predictions with critical alerts
 * @returns {Promise<Array>} Inventory predictions
 */
export async function getCriticalInventoryAlerts() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const { data, error } = await supabase
      .from('inventory_predictions')
      .select(`
        *,
        products (
          name,
          sku
        )
      `)
      .eq('tenant_id', profile.tenant_id)
      .eq('is_current', true)
      .in('low_stock_risk', ['high', 'critical'])
      .order('days_until_stockout', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];

  } catch (error) {
    console.error('Error fetching critical alerts:', error);
    return [];
  }
}

/**
 * Calculate variance of an array
 * @param {Array<number>} values - Numbers to calculate variance
 * @returns {number} Variance
 */
function calculateVariance(values) {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return variance;
}

/**
 * Batch generate predictions for all active products
 * @param {Date} targetDate - Date to predict
 * @returns {Promise<Object>} Results
 */
export async function batchGeneratePredictions(targetDate) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    // Get all active products
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true);

    if (!products || products.length === 0) {
      return { error: 'No active products found' };
    }

    // Generate prediction for overall sales first
    const overallResult = await generateSalesPrediction(targetDate);

    // Generate predictions for each product
    const productResults = await Promise.all(
      products.slice(0, 10).map(product => // Limit to 10 products to avoid timeout
        generateSalesPrediction(targetDate, { productId: product.id }),
      ),
    );
    return {
      success: true,
      overall: overallResult,
      products: productResults,
      totalPredictions: productResults.length + 1,
    };

  } catch (error) {
    console.error('Error batch generating predictions:', error);
    return {
      error: error.message,
      success: false,
    };
  }
}
