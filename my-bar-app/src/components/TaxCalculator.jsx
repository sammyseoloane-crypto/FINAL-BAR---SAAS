/**
 * Tax Calculator Component
 * Handles tax calculations with support for multiple tax rates and compliance
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../supabaseClient';
import './TaxCalculator.css';

function TaxCalculator({ amount, productId, tenantId, onTaxCalculated }) {
  const [taxBreakdown, setTaxBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (amount && tenantId) {
      calculateTax();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, productId, tenantId]);

  const calculateTax = async () => {
    setLoading(true);
    try {
      // Fetch product category for tax lookup
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

      // Calculate tax for each applicable category
      const taxes = [];
      let totalTax = 0;

      taxCategories.forEach((tax) => {
        let applies = false;

        // Check if tax applies to this product/category
        if (tax.applies_to_all) {
          applies = true;
        } else if (categoryId && tax.product_categories?.includes(categoryId)) {
          applies = true;
        }

        if (applies) {
          const taxAmount = (parseFloat(amount) * parseFloat(tax.rate)) / 100;
          taxes.push({
            name: tax.name,
            rate: tax.rate,
            amount: taxAmount,
            description: tax.description,
          });
          totalTax += taxAmount;
        }
      });

      const breakdown = {
        subtotal: parseFloat(amount),
        taxes: taxes,
        totalTax: totalTax,
        total: parseFloat(amount) + totalTax,
      };

      setTaxBreakdown(breakdown);

      if (onTaxCalculated) {
        onTaxCalculated(breakdown);
      }
    } catch (error) {
      console.error('Error calculating tax:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(value);
  };

  if (loading) {
    return <div className="tax-calculator loading">Calculating tax...</div>;
  }

  if (!taxBreakdown) {
    return null;
  }

  return (
    <div className="tax-calculator">
      <div className="tax-summary">
        <div className="tax-row subtotal">
          <span className="tax-label">Subtotal</span>
          <span className="tax-value">{formatCurrency(taxBreakdown.subtotal)}</span>
        </div>

        {taxBreakdown.taxes.length > 0 && (
          <div className="tax-breakdown">
            {taxBreakdown.taxes.map((tax, index) => (
              <div key={index} className="tax-row tax-item">
                <span className="tax-label">
                  {tax.name} ({tax.rate}%)
                  {tax.description && (
                    <span className="tax-description" title={tax.description}>
                      ⓘ
                    </span>
                  )}
                </span>
                <span className="tax-value">{formatCurrency(tax.amount)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="tax-row total-tax">
          <span className="tax-label">Total Tax</span>
          <span className="tax-value">{formatCurrency(taxBreakdown.totalTax)}</span>
        </div>

        <div className="tax-row total">
          <span className="tax-label">Total</span>
          <span className="tax-value">{formatCurrency(taxBreakdown.total)}</span>
        </div>
      </div>
    </div>
  );
}

TaxCalculator.propTypes = {
  amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  productId: PropTypes.string,
  tenantId: PropTypes.string.isRequired,
  onTaxCalculated: PropTypes.func.isRequired,
};

export default TaxCalculator;

// Utility function for tax calculation without component
export const calculateTaxAmount = async (amount, productId, tenantId, supabase) => {
  try {
    let categoryId = null;
    if (productId) {
      const { data: product } = await supabase
        .from('products')
        .select('category_id')
        .eq('id', productId)
        .single();

      categoryId = product?.category_id;
    }

    const { data: taxCategories, error } = await supabase
      .from('tax_categories')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    let totalTax = 0;

    taxCategories.forEach((tax) => {
      let applies = false;

      if (tax.applies_to_all) {
        applies = true;
      } else if (categoryId && tax.product_categories?.includes(categoryId)) {
        applies = true;
      }

      if (applies) {
        totalTax += (parseFloat(amount) * parseFloat(tax.rate)) / 100;
      }
    });

    return {
      subtotal: parseFloat(amount),
      tax: totalTax,
      total: parseFloat(amount) + totalTax,
    };
  } catch (error) {
    console.error('Error calculating tax:', error);
    return {
      subtotal: parseFloat(amount),
      tax: 0,
      total: parseFloat(amount),
    };
  }
};
