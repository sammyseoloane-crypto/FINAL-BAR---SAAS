import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import './Auth.css';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'customer',
    tenantName: '',
    selectedTenant: '',
  });
  const [availableTenants, setAvailableTenants] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Fetch available tenants for customer/staff registration
  useEffect(() => {
    if (formData.role === 'customer' || formData.role === 'staff') {
      fetchTenants();
    }
  }, [formData.role]);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase.from('tenants').select('id, name').order('name');

      if (error) {
        throw error;
      }
      setAvailableTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.role === 'owner' && !formData.tenantName) {
      setError('Business name is required for owners');
      return;
    }

    if ((formData.role === 'customer' || formData.role === 'staff') && !formData.selectedTenant) {
      setError('Please select a bar location');
      return;
    }

    setLoading(true);

    try {
      const tenantId = formData.selectedTenant || null;
      const tenantName = formData.tenantName || null;

      const { error: signUpError } = await signUp(
        formData.email,
        formData.password,
        formData.role,
        tenantId,
        tenantName,
      );

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          navigate('/auth/login');
        }, 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/jaive-logo.jpg" alt="Jaive Logo" className="auth-logo" />
          <h2>Create Account</h2>
          <p>Join us and start managing your bar today!</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {success && (
          <div className="alert alert-success">
            Account created successfully! Please check your email to verify your account.
            Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              disabled={loading || success}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role">Account Type *</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              disabled={loading || success}
              required
            >
              <option value="customer">Customer</option>
              <option value="owner">Bar Owner</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          {formData.role === 'owner' && (
            <div className="form-group">
              <label htmlFor="tenantName">Business Name *</label>
              <input
                id="tenantName"
                name="tenantName"
                type="text"
                value={formData.tenantName}
                onChange={handleChange}
                placeholder="Your Bar Name"
                disabled={loading || success}
                required
              />
              <small>This will be your business/bar name</small>
            </div>
          )}

          {(formData.role === 'customer' || formData.role === 'staff') && (
            <div className="form-group">
              <label htmlFor="selectedTenant">Select Bar Location *</label>
              <select
                id="selectedTenant"
                name="selectedTenant"
                value={formData.selectedTenant}
                onChange={handleChange}
                disabled={loading || success}
                required
              >
                <option value="">-- Choose a bar --</option>
                {availableTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
              <small>
                {formData.role === 'staff'
                  ? 'Select the bar you work at (requires manager approval)'
                  : 'Select your preferred bar location'}
              </small>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={loading || success}
              required
            />
            <small>Must be at least 6 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              disabled={loading || success}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || success}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <div className="divider">
            <span>Already have an account?</span>
          </div>
          <Link to="/auth/login" className="btn btn-secondary">
            Sign In
          </Link>
          <div style={{ marginTop: '20px', fontSize: '0.85em', color: '#666', textAlign: 'center' }}>
            By creating an account, you agree to our{' '}
            <Link to="/terms-of-service" target="_blank" style={{ color: '#d4af37' }}>
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link to="/privacy-policy" target="_blank" style={{ color: '#d4af37' }}>
              Privacy Policy
            </Link>
            <br />
            <span style={{ fontSize: '0.9em', marginTop: '8px', display: 'block' }}>
              🔒 POPIA Compliant - Your data is protected under South African law
            </span>
          </div>        </div>
      </div>
    </div>
  );
}
