/**
 * Currency Selector Component
 * Allows users to select and display prices in different currencies
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import './CurrencySelector.css';

function CurrencySelector({ tenantId, onCurrencyChange }) {
  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const fetchCurrencies = async () => {
    setLoading(true);
    try {
      const { data: currenciesData, error: currenciesError } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (currenciesError) {
        throw currenciesError;
      }

      setCurrencies(currenciesData || []);

      // Set default currency (ZAR or first available)
      const defaultCurrency = currenciesData.find((c) => c.code === 'ZAR') || currenciesData[0];
      setSelectedCurrency(defaultCurrency);

      // Fetch exchange rates
      if (defaultCurrency) {
        await fetchExchangeRates(defaultCurrency.code);
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExchangeRates = async (baseCurrency) => {
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
        rates[rate.to_currency] = rate.rate;
      });

      setExchangeRates(rates);
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    }
  };

  const handleCurrencyChange = async (currency) => {
    setSelectedCurrency(currency);
    await fetchExchangeRates(currency.code);

    if (onCurrencyChange) {
      onCurrencyChange(currency, exchangeRates);
    }
  };

  if (loading) {
    return <div className="currency-selector loading">Loading currencies...</div>;
  }

  return (
    <div className="currency-selector">
      <div className="currency-dropdown">
        <button className="currency-button">
          <span className="currency-symbol">{selectedCurrency?.symbol}</span>
          <span className="currency-code">{selectedCurrency?.code}</span>
          <span className="dropdown-arrow">▼</span>
        </button>
        <div className="currency-menu">
          {currencies.map((currency) => (
            <button
              key={currency.code}
              onClick={() => handleCurrencyChange(currency)}
              className={`currency-option ${currency.code === selectedCurrency?.code ? 'active' : ''}`}
            >
              <span className="option-symbol">{currency.symbol}</span>
              <div className="option-details">
                <div className="option-code">{currency.code}</div>
                <div className="option-name">{currency.name}</div>
              </div>
              {exchangeRates[currency.code] && (
                <div className="option-rate">
                  1 {selectedCurrency?.code} = {exchangeRates[currency.code].toFixed(4)}{' '}
                  {currency.code}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

CurrencySelector.propTypes = {
  tenantId: PropTypes.string.isRequired,
  onCurrencyChange: PropTypes.func.isRequired,
};

export default CurrencySelector;

// Export utility functions for use in other components
export const useCurrency = () => {
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [exchangeRates, setExchangeRates] = useState({});

  const convertPrice = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = exchangeRates[toCurrency];
    if (!rate) {
      return amount;
    }

    return amount * rate;
  };

  const formatPrice = (amount, currency = selectedCurrency) => {
    if (!currency) {
      return amount.toFixed(2);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimal_places || 2,
      maximumFractionDigits: currency.decimal_places || 2,
    }).format(amount);
  };

  return {
    selectedCurrency,
    setSelectedCurrency,
    exchangeRates,
    setExchangeRates,
    convertPrice,
    formatPrice,
  };
};
