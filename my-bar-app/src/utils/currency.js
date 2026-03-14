/**
 * Currency Utilities
 * Helper functions for currency conversion and formatting
 */

import { supabase } from '../supabaseClient';

/**
 * Fetch all active currencies
 */
export const fetchCurrencies = async () => {
  try {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) {
      throw error;
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return [];
  }
};

/**
 * Fetch exchange rates for a base currency
 */
export const fetchExchangeRates = async (baseCurrency) => {
  try {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('from_currency', baseCurrency)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    const rates = {};
    data.forEach((rate) => {
      rates[rate.to_currency] = parseFloat(rate.rate);
    });

    return rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return {};
  }
};

/**
 * Convert amount from one currency to another
 */
export const convertCurrency = (amount, fromCurrency, toCurrency, exchangeRates) => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rate = exchangeRates[toCurrency];
  if (!rate) {
    console.warn(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    return amount;
  }

  return amount * rate;
};

/**
 * Format amount as currency string
 */
export const formatCurrency = (amount, currencyCode = 'ZAR', decimalPlaces = 2) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(amount);
};

/**
 * Get currency symbol
 */
export const getCurrencySymbol = (currencyCode) => {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    CHF: 'CHF',
    CNY: '¥',
    INR: '₹',
    MXN: 'Mex$',
    BRL: 'R$',
  };
  return symbols[currencyCode] || currencyCode;
};

/**
 * Update exchange rates (admin function)
 */
export const updateExchangeRate = async (fromCurrency, toCurrency, rate) => {
  try {
    const { data, error } = await supabase.from('exchange_rates').upsert(
      {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate: parseFloat(rate),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'from_currency,to_currency',
      },
    );

    if (error) {
      throw error;
    }
    return { success: true, data };
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    return { success: false, error };
  }
};

/**
 * Fetch live exchange rates from external API (optional integration)
 */
export const fetchLiveExchangeRates = async (_baseCurrency = 'USD') => {
  try {
    // Example: Using exchangerate-api.com (replace with your preferred API)
    // const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    // const data = await response.json();
    // return data.rates;

    // Placeholder implementation
    // eslint-disable-next-line no-console
    console.log('Live exchange rate fetching not implemented. Using local rates.');
    return {};
  } catch (error) {
    console.error('Error fetching live exchange rates:', error);
    return {};
  }
};

/**
 * Convert entire cart to different currency
 */
export const convertCartCurrency = (cartItems, fromCurrency, toCurrency, exchangeRates) => {
  return cartItems.map((item) => ({
    ...item,
    price: convertCurrency(item.price, fromCurrency, toCurrency, exchangeRates),
    total: convertCurrency(item.price * item.quantity, fromCurrency, toCurrency, exchangeRates),
  }));
};
