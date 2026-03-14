import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './OpenTabPage.css';

export default function TabStartPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [tableInfo, setTableInfo] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  // Load table info from QR token
  useEffect(() => {
    const loadTableInfo = async () => {
      try {
        if (!token) {
          setError('Invalid QR code. No token provided.');
          setLoading(false);
          return;
        }

        // Look up table by QR token
        const { data, error: lookupError } = await supabase
          .rpc('get_table_by_qr_token', {
            p_token: token,
          });

        if (lookupError) {
          throw lookupError;
        }

        if (!data || data.length === 0) {
          setError('Invalid QR code. Table not found or inactive.');
          setLoading(false);
          return;
        }

        const table = data[0];
        setTableInfo(table);

        // Check if customer already has an open tab
        const phone = localStorage.getItem('customerPhone');
        if (phone) {
          const { data: existingTab } = await supabase
            .rpc('get_customer_tab_by_phone', {
              p_tenant_id: table.tenant_id,
              p_phone: phone,
            });

          if (existingTab && existingTab.length > 0) {
            // Customer already has an open tab - redirect to tab view
            localStorage.setItem('tenantId', table.tenant_id);
            navigate('/tab/view');
            return;
          }

          // Pre-fill phone if stored
          setCustomerPhone(phone);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading table info:', err);
        setError('Error loading table information. Please try scanning the QR code again.');
        setLoading(false);
      }
    };

    loadTableInfo();
  }, [token, navigate]);

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
          p_tenant_id: tableInfo.tenant_id,
          p_phone: customerPhone,
        });

      if (existingTabs && existingTabs.length > 0) {
        alert('You already have an open tab! Redirecting...');
        localStorage.setItem('customerPhone', customerPhone);
        localStorage.setItem('tenantId', tableInfo.tenant_id);
        navigate('/tab/view');
        return;
      }

      // Create new tab
      const { error: tabError } = await supabase
        .from('tabs')
        .insert({
          tenant_id: tableInfo.tenant_id,
          table_id: tableInfo.table_id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim() || null,
          status: 'open',
          qr_code_id: token, // Store the QR token used
        })
        .select()
        .single();

      if (tabError) {
        throw tabError;
      }

      // Store customer phone for future use
      localStorage.setItem('customerPhone', customerPhone);
      localStorage.setItem('tenantId', tableInfo.tenant_id);

      // Redirect to tab view
      navigate('/tab/view');
    } catch (err) {
      console.error('Error opening tab:', err);
      setError(`Error opening tab: ${err.message}`);
    } finally {
      setOpening(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="open-tab-page">
        <div className="open-tab-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tableInfo) {
    return (
      <div className="open-tab-page">
        <div className="open-tab-container">
          <div className="error-card">
            <div className="error-icon">⚠️</div>
            <h2>QR Code Error</h2>
            <p>{error || 'Unable to load table information'}</p>
            <p className="error-detail">
              Please make sure you scanned a valid bar tab QR code from this venue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="open-tab-page">
      <div className="open-tab-container">
        <div className="venue-header">
          <h1>{tableInfo.tenant_name}</h1>
          <div className="table-badge">
            <span className="table-icon">🪑</span>
            <span className="table-name">{tableInfo.table_name}</span>
          </div>
          {tableInfo.minimum_spend > 0 && (
            <div className="minimum-spend-notice">
              <span className="icon">💰</span>
              <span>Minimum spend: R{parseFloat(tableInfo.minimum_spend).toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="form-card">
          <h2>Open Your Tab</h2>
          <p className="form-subtitle">
            Enter your details to start your bar tab
          </p>

          <form onSubmit={handleOpenTab} className="tab-form">
            <div className="form-group">
              <label htmlFor="customerName">Full Name *</label>
              <input
                type="text"
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Doe"
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="customerPhone">Phone Number *</label>
              <input
                type="tel"
                id="customerPhone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0821234567"
                required
                className="form-input"
              />
              <span className="input-hint">
                Used to identify your tab
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="customerEmail">Email (Optional)</label>
              <input
                type="email"
                id="customerEmail"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com"
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={opening}
              className="btn-open-tab"
            >
              {opening ? 'Opening Tab...' : 'Open My Tab'}
            </button>
          </form>

          <div className="info-box">
            <p><strong>How it works:</strong></p>
            <ol>
              <li>Your bartender will add drinks to your tab</li>
              <li>View your tab anytime via &quot;My Bar Tab&quot;</li>
              <li>Pay when you&apos;re ready to leave</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
