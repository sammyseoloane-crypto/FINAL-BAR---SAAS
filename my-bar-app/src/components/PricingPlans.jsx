import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { getSubscriptionPlans, getFeaturesComparison, formatPrice, TIER_INFO } from '../utils/subscriptionUtils';
import { startSubscriptionCheckout } from '../services/subscriptionService';
import './PricingPlans.css';

const PricingPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState('monthly'); // 'monthly' or 'yearly'
  const { userProfile } = useAuth();
  const { subscription } = useSubscription();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const data = await getSubscriptionPlans();
      // Include all plans, sort by price (trial will be first at 0)
      setPlans(data);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan) => {
    try {
      // Platform admins cannot subscribe (they don't have a tenant)
      if (userProfile?.role === 'platform_admin') {
        alert('Platform Admin Notice\n\nPlatform administrators cannot subscribe to plans.\n\nYou have full access to manage all tenants and their subscriptions through the Platform Admin dashboard.');
        return;
      }

      // Require login for non-admin users
      if (!userProfile || !userProfile.tenant_id) {
        alert('Please log in or create an account to subscribe to a plan.');
        return;
      }

      // Handle free trial - no payment required
      if (plan.tier === 'trial') {
        // eslint-disable-next-line no-console
        console.log('Starting free trial');
        alert('Free Trial activation!\n\nYour 14-day free trial will be activated immediately after registration.\n\nNo credit card required.');
        return;
      }

      // Check if Stripe price IDs are configured
      const priceId = billingPeriod === 'yearly'
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id_monthly;

      if (!priceId) {
        alert(`Stripe is not configured for ${plan.display_name}.\n\nPlease contact support to set up your subscription.`);
        return;
      }

      // eslint-disable-next-line no-console
      console.log('Selected plan:', plan.tier, 'Billing:', billingPeriod);

      // Start the checkout flow
      await startSubscriptionCheckout(plan, billingPeriod);

    } catch (error) {
      console.error('Checkout error:', error);
      alert(`Failed to start checkout: ${error.message}\n\nPlease try again or contact support.`);
    }
  };

  const getPrice = (plan) => {
    const amount = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly;
    return formatPrice(amount, plan.currency);
  };

  const getSavings = (plan) => {
    if (billingPeriod === 'monthly' || !plan.price_yearly) {
      return null;
    }
    const yearlyCost = plan.price_monthly * 12;
    const savings = yearlyCost - plan.price_yearly;
    if (savings <= 0) {
      return null;
    }
    return formatPrice(savings, plan.currency);
  };

  const isCurrentPlan = (tier) => {
    return subscription?.subscription_tier === tier;
  };

  const getTierColor = (tier) => {
    return TIER_INFO[tier]?.color || 'blue';
  };

  if (loading) {
    return (
      <div className="pricing-container">
        <div className="pricing-loading">
          <div className="spinner"></div>
          <p>Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-container">
      <div className="pricing-header">
        <h1 className="pricing-title">Choose Your Perfect Plan</h1>
        <p className="pricing-subtitle">
          Scale your nightclub business with the right tools at every stage
        </p>

        {/* Billing Toggle */}
        <div className="billing-toggle">
          <button
            className={billingPeriod === 'monthly' ? 'active' : ''}
            onClick={() => setBillingPeriod('monthly')}
          >
            Monthly
          </button>
          <button
            className={billingPeriod === 'yearly' ? 'active' : ''}
            onClick={() => setBillingPeriod('yearly')}
          >
            Yearly
            <span className="savings-badge">Save up to 17%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="pricing-grid">
        {plans.map((plan) => {
          const savings = getSavings(plan);
          const current = isCurrentPlan(plan.tier);
          const tierColor = getTierColor(plan.tier);
          const isTrial = plan.tier === 'trial';

          return (
            <div
              key={plan.id}
              className={`pricing-card ${current ? 'current' : ''} tier-${tierColor} ${isTrial ? 'trial-card' : ''}`}
            >
              {isTrial && <div className="trial-badge">🎉 Start Free</div>}
              {plan.tier === 'pro' && !isTrial && <div className="popular-badge">Most Popular</div>}
              {current && <div className="current-badge">Current Plan</div>}

              <div className="plan-header">
                <h3 className="plan-name">{plan.display_name}</h3>
                {isTrial ? (
                  <div className="plan-price">
                    <span style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981' }}>FREE</span>
                    <span className="price-period">/ 14 days</span>
                  </div>
                ) : (
                  <div className="plan-price">
                    <span>{getPrice(plan)}</span>
                    <span className="price-period">/{billingPeriod === 'yearly' ? 'year' : 'month'}</span>
                  </div>
                )}
                {!isTrial && savings && <div className="plan-savings">Save {savings} yearly</div>}
              </div>

              <div className="plan-features">
                <h4>Key Features:</h4>
                <ul>
                  {plan.max_staff && (
                    <li>
                      ✓ {plan.max_staff >= 999999 ? 'Unlimited' : plan.max_staff} Staff Accounts
                    </li>
                  )}
                  {plan.max_locations && (
                    <li>
                      ✓ {plan.max_locations >= 999999 ? 'Unlimited' : plan.max_locations} Venue{plan.max_locations > 1 ? 's' : ''}
                    </li>
                  )}
                  {plan.max_events_per_month && (
                    <li>
                      ✓ {plan.max_events_per_month >= 999999 ? 'Unlimited' : plan.max_events_per_month} Events/Month
                    </li>
                  )}

                  {/* Feature highlights based on tier */}
                  {plan.tier === 'trial' && (
                    <>
                      <li>✓ Full Access to All Features</li>
                      <li>✓ No Credit Card Required</li>
                      <li>✓ 14 Days Free</li>
                      <li>✓ Email Support</li>
                      <li>✓ Basic Reports</li>
                    </>
                  )}

                  {plan.tier === 'starter' && (
                    <>
                      <li>✓ POS & Inventory</li>
                      <li>✓ QR Payments</li>
                      <li>✓ Digital Menu</li>
                      <li>✓ Basic Reports</li>
                    </>
                  )}

                  {plan.tier === 'growth' && (
                    <>
                      <li>✓ Everything in Starter</li>
                      <li>✓ VIP Table Booking</li>
                      <li>✓ Bottle Service</li>
                      <li>✓ Guest Lists</li>
                      <li>✓ Digital Bar Tabs</li>
                      <li>✓ Loyalty Program</li>
                    </>
                  )}

                  {plan.tier === 'pro' && (
                    <>
                      <li>✓ Everything in Growth</li>
                      <li>✓ AI Analytics</li>
                      <li>✓ Dynamic Pricing</li>
                      <li>✓ Table Layout Manager</li>
                      <li>✓ Event Revenue Tracking</li>
                      <li>✓ Staff Performance</li>
                    </>
                  )}

                  {plan.tier === 'enterprise' && (
                    <>
                      <li>✓ Everything in Pro</li>
                      <li>✓ Multi-Location Management</li>
                      <li>✓ Franchise Dashboard</li>
                      <li>✓ API Access</li>
                      <li>✓ Dedicated Support</li>
                      <li>✓ Custom Integrations</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="plan-action">
                {current ? (
                  <button className="btn-current" disabled>
                    Current Plan
                  </button>
                ) : (
                  <button
                    className={`btn-select ${plan.tier === 'trial' ? 'btn-trial' : ''}`}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {plan.tier === 'trial' ? 'Start Free Trial' : (
                      subscription?.subscription_tier && plan.tier > subscription.subscription_tier
                        ? 'Upgrade'
                        : 'Select Plan'
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="feature-comparison">
        <h2>Feature Comparison</h2>
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Starter</th>
                <th>Growth</th>
                <th>Pro</th>
                <th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {getFeaturesComparison().map((row, idx) => (
                <tr key={idx}>
                  <td className="feature-name">{row.feature}</td>
                  <td className="feature-value">
                    {typeof row.starter === 'boolean' ? (
                      row.starter ? '✓' : '—'
                    ) : (
                      row.starter
                    )}
                  </td>
                  <td className="feature-value">
                    {typeof row.growth === 'boolean' ? (
                      row.growth ? '✓' : '—'
                    ) : (
                      row.growth
                    )}
                  </td>
                  <td className="feature-value">
                    {typeof row.pro === 'boolean' ? (
                      row.pro ? '✓' : '—'
                    ) : (
                      row.pro
                    )}
                  </td>
                  <td className="feature-value">
                    {typeof row.enterprise === 'boolean' ? (
                      row.enterprise ? '✓' : '—'
                    ) : (
                      row.enterprise
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="pricing-faq">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-grid">
          <div className="faq-item">
            <h3>Can I change plans at any time?</h3>
            <p>Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
          </div>
          <div className="faq-item">
            <h3>What happens if I exceed my limits?</h3>
            <p>You&apos;ll be prompted to upgrade to a higher tier. We&apos;ll never stop your service without notice.</p>
          </div>
          <div className="faq-item">
            <h3>Is there a free trial?</h3>
            <p>Yes! All new accounts get a 14-day free trial with Starter plan features.</p>
          </div>
          <div className="faq-item">
            <h3>Do you offer refunds?</h3>
            <p>We offer a 30-day money-back guarantee if you&apos;re not satisfied with our service.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPlans;
