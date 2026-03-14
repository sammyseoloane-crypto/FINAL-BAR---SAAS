import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import './CustomerTabView.css';

// Initialize Stripe (you'll need to add your publishable key)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

export default function CustomerTabView() {
  const { user, userProfile } = useAuth();
  const [tab, setTab] = useState(null);
  const [tabItems, setTabItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [tabNotFound, setTabNotFound] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [tipPercentage, setTipPercentage] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [showTipOptions, setShowTipOptions] = useState(false);

  // Auto-load tab if user is logged in
  useEffect(() => {
    const autoLoadTab = async () => {
      // Try localStorage first
      const storedPhone = localStorage.getItem('customerPhone');

      if (storedPhone) {
        setPhoneInput(storedPhone);
        await loadTabByPhone(storedPhone);
      } else if (userProfile?.phone) {
        // Use logged-in user's phone
        setPhoneInput(userProfile.phone);
        await loadTabByPhone(userProfile.phone);
      } else {
        setLoading(false);
      }
    };

    autoLoadTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userProfile]);

  // Load tab by phone number
  const loadTabByPhone = async (phone) => {
    try {
      setLoading(true);
      setTabNotFound(false);

      // Get tenant_id from user profile, URL, or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const tenantId = userProfile?.tenant_id ||
                      urlParams.get('tenant') ||
                      localStorage.getItem('tenantId');

      if (!tenantId) {
        alert('Venue information not found. Please make sure you are logged in or scan the QR code again.');
        setLoading(false);
        return;
      }

      // Find customer's open tab
      const { data: tabData, error: tabError } = await supabase
        .rpc('get_customer_tab_by_phone', {
          p_tenant_id: tenantId,
          p_phone: phone,
        });

      if (tabError) {
        throw tabError;
      }

      if (!tabData || tabData.length === 0) {
        setTabNotFound(true);
        setTab(null);
        setTabItems([]);
        setCustomerPhone(phone); // Set phone even when no tab found
        return;
      }

      const foundTab = tabData[0];
      setTab(foundTab);
      setCustomerPhone(phone);

      // Store phone for future use
      localStorage.setItem('customerPhone', phone);

      // Load tab items
      await loadTabItems(foundTab.tab_id);
    } catch (error) {
      console.error('Error loading tab:', error);
      alert(`Error loading tab: ${error.message}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Load tab items
  const loadTabItems = async (tabId) => {
    try {
      const { data, error } = await supabase
        .from('tab_items')
        .select('*')
        .eq('tab_id', tabId)
        .not('status', 'in', '("removed","cancelled")')
        .order('added_at', { ascending: true });

      if (error) {
        throw error;
      }
      setTabItems(data || []);
    } catch (error) {
      console.error('Error loading tab items:', error);
    }
  };

  // Real-time subscription
  useEffect(() => {
    if (!tab?.tab_id) {
      return;
    }

    // Subscribe to tab updates
    const tabChannel = supabase
      .channel(`customer-tab-${tab.tab_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tabs',
        filter: `id=eq.${tab.tab_id}`,
      }, (payload) => {
        setTab(prev => ({ ...prev, ...payload.new }));
      })
      .subscribe();

    // Subscribe to tab items changes
    const itemsChannel = supabase
      .channel(`customer-tab-items-${tab.tab_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tab_items',
        filter: `tab_id=eq.${tab.tab_id}`,
      }, () => {
        loadTabItems(tab.tab_id);
      })
      .subscribe();

    return () => {
      tabChannel.unsubscribe();
      itemsChannel.unsubscribe();
    };
  }, [tab?.tab_id]);

  // Handle tip selection
  const handleTipChange = (percentage) => {
    setTipPercentage(percentage);
    setCustomTip('');
  };

  const handleCustomTipChange = (value) => {
    setCustomTip(value);
    setTipPercentage(0);
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = parseFloat(tab?.total || 0) - parseFloat(tab?.tax_amount || 0) - parseFloat(tab?.tip_amount || 0);
    const tax = parseFloat(tab?.tax_amount || 0);
    let tip = 0;

    if (customTip) {
      tip = parseFloat(customTip) || 0;
    } else if (tipPercentage > 0) {
      tip = subtotal * (tipPercentage / 100);
    }

    const total = subtotal + tax + tip;

    return { subtotal, tax, tip, total };
  };

  // Handle payment
  const handlePayment = async () => {
    try {
      setPaying(true);
      const stripe = await stripePromise;
      const totals = calculateTotals();

      // Update tab with tip amount
      if (totals.tip > 0) {
        await supabase
          .from('tabs')
          .update({
            tip_amount: totals.tip,
            total: totals.total,
          })
          .eq('id', tab.tab_id);
      }

      // Create payment intent via Supabase Edge Function
      const { data, error: functionError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          tabId: tab.tab_id,
          amount: Math.round(totals.total * 100), // Convert to cents
          customerPhone: customerPhone,
        },
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const { clientSecret } = data;

      // Confirm payment with Stripe
      const { error: stripeError } = await stripe.confirmCardPayment(clientSecret);

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      // Update tab status
      await supabase
        .from('tabs')
        .update({
          status: 'closed',
          payment_status: 'succeeded',
          paid_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
        })
        .eq('id', tab.tab_id);

      alert('Payment successful! Thank you for visiting.');
      setTab(null);
      setTabItems([]);
      setCustomerPhone('');
    } catch (error) {
      console.error('Payment error:', error);
      alert(`Payment failed: ${error.message}`);
    } finally {
      setPaying(false);
    }
  };

  // Initial phone input form
  if (!customerPhone && !loading) {
    return (
      <div className="customer-tab-view">
        <div className="phone-input-container">
          <div className="phone-input-card">
            <h1>View Your Tab</h1>
            {user && !userProfile?.phone ? (
              <div className="info-box" style={{ marginBottom: '15px', backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
                <p style={{ margin: 0, color: '#856404' }}>
                  ℹ️ No phone number found in your profile. Please enter it below or update your profile settings.
                </p>
              </div>
            ) : null}
            <p>Enter your phone number to view your open tab</p>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Phone number"
              className="phone-input"
            />
            <button
              onClick={() => loadTabByPhone(phoneInput)}
              disabled={!phoneInput}
              className="btn-primary"
            >
              View My Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tab not found
  if (tabNotFound) {
    return (
      <div className="customer-tab-view">
        <div className="tab-not-found">
          <div className="empty-state-icon">🍸</div>
          <h2>No Open Tab Found</h2>
          <p>We couldn&apos;t find an open tab for {customerPhone}</p>
          <div className="tab-actions">
            <button onClick={() => {
              setCustomerPhone('');
              setPhoneInput('');
              setTabNotFound(false);
            }} className="btn-secondary">
              Try Different Number
            </button>
          </div>
          <div className="info-box" style={{ marginTop: '20px' }}>
            <h3>How to Open a Tab:</h3>
            <ol style={{ textAlign: 'left', paddingLeft: '20px' }}>
              <li>Scan the QR code on your table</li>
              <li>Enter your details</li>
              <li>Your bartender will add drinks to your tab</li>
              <li>Pay when you&apos;re ready to leave</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="customer-tab-view">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading your tab...</p>
        </div>
      </div>
    );
  }

  // No tab loaded yet
  if (!tab) {
    return null;
  }

  const totals = calculateTotals();

  return (
    <div className="customer-tab-view">
      <div className="tab-container">
        {/* Header */}
        <div className="tab-header">
          <div className="tab-header-content">
            <h1>Your Tab</h1>
            <p className="customer-name">{tab.customer_name}</p>
            {tab.table_name && (
              <div className="table-info">
                <span className="table-icon">🪑</span>
                <span className="table-name">{tab.table_name}</span>
              </div>
            )}
          </div>
          <div className="tab-status">
            <span className="status-badge open">Open</span>
          </div>
        </div>

        {/* Items List */}
        <div className="tab-items-section">
          <h2>Items Ordered</h2>
          {tabItems.length === 0 ? (
            <div className="no-items">
              <p>No items yet. Your bartender will add items to your tab.</p>
            </div>
          ) : (
            <div className="items-list">
              {tabItems.map((item) => (
                <div key={item.id} className="item-card">
                  <div className="item-info">
                    <div className="item-name">{item.drink_name}</div>
                    {item.drink_category && (
                      <div className="item-category">{item.drink_category}</div>
                    )}
                    {item.special_instructions && (
                      <div className="item-notes">{item.special_instructions}</div>
                    )}
                  </div>
                  <div className="item-pricing">
                    <div className="item-quantity">×{item.quantity}</div>
                    <div className="item-price">R{parseFloat(item.total_price).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="tab-totals">
          <div className="total-row">
            <span>Subtotal</span>
            <span>R{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>Tax (15%)</span>
            <span>R{totals.tax.toFixed(2)}</span>
          </div>

          {/* Tip Section */}
          <div className="tip-section">
            <div className="tip-header">
              <span>Tip</span>
              <span>R{totals.tip.toFixed(2)}</span>
            </div>
            <div className="tip-options">
              <button
                className={`tip-btn ${tipPercentage === 10 ? 'selected' : ''}`}
                onClick={() => handleTipChange(10)}
              >
                10%
              </button>
              <button
                className={`tip-btn ${tipPercentage === 15 ? 'selected' : ''}`}
                onClick={() => handleTipChange(15)}
              >
                15%
              </button>
              <button
                className={`tip-btn ${tipPercentage === 20 ? 'selected' : ''}`}
                onClick={() => handleTipChange(20)}
              >
                20%
              </button>
              <button
                className={`tip-btn ${customTip ? 'selected' : ''}`}
                onClick={() => setShowTipOptions(!showTipOptions)}
              >
                Custom
              </button>
            </div>
            {showTipOptions && (
              <input
                type="number"
                value={customTip}
                onChange={(e) => handleCustomTipChange(e.target.value)}
                placeholder="Enter custom tip amount"
                className="custom-tip-input"
                step="0.01"
                min="0"
              />
            )}
          </div>

          <div className="total-row total-final">
            <span>Total</span>
            <span>R{totals.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="tab-actions">
          <button
            onClick={handlePayment}
            disabled={paying || tabItems.length === 0}
            className="btn-pay"
          >
            {paying ? 'Processing...' : `Pay R${totals.total.toFixed(2)}`}
          </button>
          <p className="payment-note">Powered by Stripe - Secure payment</p>
        </div>

        {/* Footer */}
        <div className="tab-footer">
          <p>Tab opened at {new Date(tab.opened_at).toLocaleTimeString()}</p>
          <button
            onClick={() => {
              setCustomerPhone('');
              setPhoneInput('');
              setTab(null);
              setTabItems([]);
            }}
            className="btn-link"
          >
            Not your tab?
          </button>
        </div>
      </div>
    </div>
  );
}
