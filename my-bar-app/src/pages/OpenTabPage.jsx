import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './OpenTabPage.css';

export default function OpenTabPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tenantId, setTenantId] = useState('');
  const [tableId, setTableId] = useState('');
  const [tableName, setTableName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  // Load table info from URL params
  useEffect(() => {
    const loadTableInfo = async () => {
      try {
        const tenant = searchParams.get('tenant');
        const table = searchParams.get('table');

        if (!tenant || !table) {
          setError('Invalid QR code. Missing venue or table information.');
          setLoading(false);
          return;
        }

        setTenantId(tenant);
        setTableId(table);

        // Load table details
        const { data: tableData, error: tableError } = await supabase
          .from('tables')
          .select('name, capacity')
          .eq('id', table)
          .eq('tenant_id', tenant)
          .single();

        if (tableError) {
          throw tableError;
        }

        if (tableData) {
          setTableName(tableData.name);
        }

        // Check if customer already has an open tab
        const phone = localStorage.getItem('customerPhone');
        if (phone) {
          const { data: existingTab } = await supabase
            .rpc('get_customer_tab_by_phone', {
              p_tenant_id: tenant,
              p_phone: phone,
            });

          if (existingTab && existingTab.length > 0) {
            // Customer already has an open tab - redirect to tab view
            navigate(`/tab/view?tenant=${tenant}`);
            return;
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading table info:', err);
        setError('Error loading venue information. Please try scanning the QR code again.');
        setLoading(false);
      }
    };

    loadTableInfo();
  }, [searchParams, navigate]);

  // Handle open tab
  const handleOpenTab = async (e) => {
    e.preventDefault();

    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please enter your name and phone number');
      return;
    }

    try {
      setOpening(true);
      setError('');

      // Check if customer already has an open tab
      const { data: existingTabs } = await supabase
        .rpc('get_customer_tab_by_phone', {
          p_tenant_id: tenantId,
          p_phone: customerPhone,
        });

      if (existingTabs && existingTabs.length > 0) {
        alert('You already have an open tab! Redirecting...');
        localStorage.setItem('customerPhone', customerPhone);
        navigate(`/tab/view?tenant=${tenantId}`);
        return;
      }

      // Create new tab
      const { error: tabError } = await supabase
        .from('tabs')
        .insert({
          tenant_id: tenantId,
          table_id: tableId,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,
          status: 'open',
          subtotal: 0,
          tax_amount: 0,
          tip_amount: 0,
          total: 0,
        })
        .select()
        .single();

      if (tabError) {
        throw tabError;
      }

      // Store customer phone for easy access
      localStorage.setItem('customerPhone', customerPhone);
      localStorage.setItem('tenantId', tenantId);

      // Redirect to tab view
      alert('Tab opened successfully! Your bartender can now add drinks.');
      navigate(`/tab/view?tenant=${tenantId}`);
    } catch (err) {
      console.error('Error opening tab:', err);
      setError('Error opening tab. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <div className="open-tab-page">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !tableName) {
    return (
      <div className="open-tab-page">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Error</h2>
          <p>{error}</p>
          <p className="help-text">Please scan the QR code at your table again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="open-tab-page">
      <div className="open-tab-container">
        {/* Header */}
        <div className="open-tab-header">
          <div className="venue-logo">🍹</div>
          <h1>Open Your Tab</h1>
          {tableName && (
            <div className="table-info-badge">
              <span className="table-icon">📍</span>
              <span>{tableName}</span>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="info-card">
          <h2>How It Works</h2>
          <div className="steps-list">
            <div className="step-item">
              <span className="step-number">1</span>
              <span className="step-text">Enter your details below</span>
            </div>
            <div className="step-item">
              <span className="step-number">2</span>
              <span className="step-text">Bartender adds drinks to your tab</span>
            </div>
            <div className="step-item">
              <span className="step-number">3</span>
              <span className="step-text">View your tab anytime</span>
            </div>
            <div className="step-item">
              <span className="step-number">4</span>
              <span className="step-text">Pay when you&apos;re ready to leave</span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleOpenTab} className="open-tab-form">
          <div className="form-group">
            <label htmlFor="customerName">Your Name *</label>
            <input
              id="customerName"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Smith"
              required
              className="form-input"
              disabled={opening}
            />
          </div>

          <div className="form-group">
            <label htmlFor="customerPhone">Phone Number *</label>
            <input
              id="customerPhone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+27 123 456 789"
              required
              className="form-input"
              disabled={opening}
            />
            <p className="field-note">We&apos;ll use this to identify your tab</p>
          </div>

          <div className="form-group">
            <label htmlFor="customerEmail">Email (optional)</label>
            <input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
              className="form-input"
              disabled={opening}
            />
            <p className="field-note">Optional - for receipt</p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={opening || !customerName.trim() || !customerPhone.trim()}
            className="btn-open-tab"
          >
            {opening ? (
              <>
                <span className="btn-spinner"></span>
                Opening Tab...
              </>
            ) : (
              'Open My Tab 🍻'
            )}
          </button>
        </form>

        {/* Terms */}
        <div className="terms-text">
          <p>By opening a tab, you agree to pay for all items added before leaving.</p>
        </div>

        {/* Footer Info */}
        <div className="security-badges">
          <div className="security-badge">
            <span className="badge-icon">🔒</span>
            <span>Secure</span>
          </div>
          <div className="security-badge">
            <span className="badge-icon">💳</span>
            <span>Stripe Payments</span>
          </div>
        </div>
      </div>
    </div>
  );
}
