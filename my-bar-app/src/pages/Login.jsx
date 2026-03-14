import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, user, userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = useMemo(() => searchParams.get('redirect') || '/dashboard', [searchParams]);
  const hasRedirected = useRef(false);

  // Redirect if already logged in
  useEffect(() => {
    // Only redirect if we have a user AND their profile is loaded (or loading is done)
    if (user && userProfile && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate(redirectTo, { replace: true });
    }
  }, [user, userProfile, redirectTo, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    setError('');

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      console.error('Login error:', signInError);

      // Provide user-friendly error messages
      if (signInError.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please check your credentials.');
      } else if (signInError.message.includes('Email not confirmed')) {
        setError(
          'Please verify your email address before signing in. Check your inbox for the confirmation link.',
        );
      } else {
        setError(signInError.message);
      }

      setSubmitting(false);
    }
    // Don't navigate here - let the useEffect handle it when user state updates
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/jaive-logo.jpg" alt="Jaive Logo" className="auth-logo" />
          <h2>Sign In</h2>
          <p>Welcome back! Please sign in to continue.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/auth/forgot-password" className="link">
            Forgot password?
          </Link>
          <div className="divider">
            <span>Don&apos;t have an account?</span>
          </div>
          <Link to="/auth/register" className="btn btn-secondary">
            Create Account
          </Link>
          <div style={{ marginTop: '20px', fontSize: '0.85em', color: '#666', textAlign: 'center' }}>
            By signing in, you agree to our{' '}
            <Link to="/terms-of-service" target="_blank" style={{ color: '#d4af37' }}>
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link to="/privacy-policy" target="_blank" style={{ color: '#d4af37' }}>
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
