import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import DashboardLayout from '../../components/DashboardLayout';
import '../owner/Pages.css';

export default function ProfilePage() {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
      });
    }
  }, [userProfile]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      alert('Profile updated successfully!');
    } catch (error) {
      alert(`Error updating profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) {
        throw error;
      }

      alert('Password updated successfully!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      alert(`Error updating password: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const requestDataDeletion = async (type) => {
    if (!deleteReason.trim()) {
      alert('Please provide a reason for deletion');
      return;
    }

    const confirmMessage = type === 'immediate'
      ? 'Are you sure you want to delete your account immediately? This action cannot be undone and all your data will be permanently deleted.'
      : 'Your account will be scheduled for deletion in 30 days. You can cancel this request by logging in before then.';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-data-deletion`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestType: type,
            reason: deleteReason,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process deletion request');
      }

      alert(result.message);

      if (type === 'immediate') {
        // Log user out since account is deleted
        await supabase.auth.signOut();
        window.location.href = '/';
      } else {
        setShowDeleteConfirm(false);
        setDeleteReason('');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="page-content">
        <div className="page-header">
          <h2>👤 My Profile</h2>
          <p>Manage your account information</p>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <h3>Account Information</h3>
            </div>
            <div className="card-body">
              <form onSubmit={updateProfile}>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    style={{ background: '#f7fafc', cursor: 'not-allowed' }}
                  />
                  <small style={{ color: '#666' }}>Email cannot be changed</small>
                </div>

                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="e.g., 0812345678"
                  />
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <input
                    type="text"
                    value={userProfile?.role || ''}
                    disabled
                    style={{
                      background: '#f7fafc',
                      cursor: 'not-allowed',
                      textTransform: 'capitalize',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Updating...' : '💾 Update Profile'}
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Change Password</h3>
            </div>
            <div className="card-body">
              <form onSubmit={updatePassword}>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Enter new password"
                    minLength="6"
                  />
                  <small style={{ color: '#666' }}>Must be at least 6 characters</small>
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Confirm new password"
                    minLength="6"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  {loading ? 'Updating...' : '🔒 Change Password'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Account Statistics</h3>
          </div>
          <div className="card-body">
            <div className="stats-grid">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', color: '#d4af37', marginBottom: '5px' }}>
                  {userProfile?.created_at
                    ? Math.floor((new Date() - new Date(userProfile.created_at)) / (1000 * 60 * 60 * 24) )
                    : 0}
                </div>
                <div style={{ color: '#666' }}>Days as Member</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', color: '#d4af37', marginBottom: '5px' }}>
                  {new Date(userProfile?.created_at || Date.now()).toLocaleDateString('en-ZA', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
                <div style={{ color: '#666' }}>Member Since</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', color: '#d4af37', marginBottom: '5px' }}>
                  {userProfile?.role === 'customer' ? '🌟' : '🏆'}
                </div>
                <div style={{ color: '#666' }}>Account Type</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #4299e1' }}>
          <div className="card-header">
            <h3>💡 Profile Tips</h3>
          </div>
          <div className="card-body">
            <ul style={{ lineHeight: '1.8' }}>
              <li>Keep your phone number updated for order notifications</li>
              <li>Use a strong password and change it regularly</li>
              <li>Your email is used for login and cannot be changed</li>
              <li>Contact support if you need to update your email address</li>
            </ul>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid #e53e3e' }}>
          <div className="card-header">
            <h3>🗑️ Data Privacy & Deletion</h3>
          </div>
          <div className="card-body">
            <p style={{ marginBottom: '15px', color: '#666' }}>
              Under South Africa&apos;s Protection of Personal Information Act (POPIA), you have the right to request deletion of your personal data.
            </p>

            <div style={{ marginBottom: '20px', padding: '15px', background: '#f7fafc', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>Your Rights:</h4>
              <ul style={{ lineHeight: '1.8', marginLeft: '20px' }}>
                <li>Right to access your personal information</li>
                <li>Right to correct inaccurate information</li>
                <li>Right to delete your personal data (Right to be Forgotten)</li>
                <li>Right to restrict processing of your data</li>
                <li>Right to data portability</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '10px', fontWeight: '500' }}>
                View our legal documents:
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link
                  to="/privacy-policy"
                  target="_blank"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.9em' }}
                >
                  📜 Privacy Policy
                </Link>
                <Link
                  to="/terms-of-service"
                  target="_blank"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.9em' }}
                >
                  📋 Terms of Service
                </Link>
              </div>
            </div>

            {!showDeleteConfirm ? (
              <div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn"
                  style={{
                    background: '#e53e3e',
                    color: 'white',
                    width: '100%',
                  }}
                >
                  🗑️ Request Account Deletion
                </button>
              </div>
            ) : (
              <div style={{ padding: '20px', background: '#fff5f5', border: '2px solid #e53e3e', borderRadius: '8px' }}>
                <h4 style={{ color: '#e53e3e', marginBottom: '15px' }}>⚠️ Account Deletion Request</h4>

                <div className="form-group">
                  <label>Reason for deletion (required):</label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Please tell us why you're deleting your account..."
                    rows="3"
                    style={{ width: '100%' }}
                  />
                </div>

                <p style={{ marginBottom: '15px', fontSize: '0.9em', color: '#666' }}>
                  <strong>What will be deleted:</strong> All your personal information, purchase history, QR codes, and account data will be permanently removed from our systems.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <button
                    onClick={() => requestDataDeletion('immediate')}
                    disabled={loading}
                    className="btn"
                    style={{
                      background: '#e53e3e',
                      color: 'white',
                    }}
                  >
                    {loading ? 'Processing...' : '🗑️ Delete Immediately'}
                  </button>

                  <button
                    onClick={() => requestDataDeletion('scheduled')}
                    disabled={loading}
                    className="btn"
                    style={{
                      background: '#f6ad55',
                      color: 'white',
                    }}
                  >
                    {loading ? 'Processing...' : '📅 Schedule Deletion (30 days)'}
                  </button>

                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteReason('');
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
