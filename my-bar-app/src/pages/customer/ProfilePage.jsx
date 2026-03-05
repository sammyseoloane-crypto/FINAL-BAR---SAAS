import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/DashboardLayout'
import '../owner/Pages.css'

export default function ProfilePage() {
  const { user, userProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  })
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || ''
      })
    }
  }, [userProfile])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    })
  }

  const updateProfile = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone
        })
        .eq('id', user.id)

      if (error) throw error

      alert('Profile updated successfully!')
    } catch (error) {
      alert('Error updating profile: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (e) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match!')
      return
    }

    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      alert('Password updated successfully!')
      setPasswordData({ newPassword: '', confirmPassword: '' })
    } catch (error) {
      alert('Error updating password: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

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
                    style={{ background: '#f7fafc', cursor: 'not-allowed', textTransform: 'capitalize' }}
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
                <div style={{ fontSize: '2em', color: '#667eea', marginBottom: '5px' }}>
                  {userProfile?.created_at ? 
                    Math.floor((new Date() - new Date(userProfile.created_at)) / (1000 * 60 * 60 * 24)) 
                    : 0}
                </div>
                <div style={{ color: '#666' }}>Days as Member</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', color: '#667eea', marginBottom: '5px' }}>
                  {new Date(userProfile?.created_at || Date.now()).toLocaleDateString('en-ZA', { 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </div>
                <div style={{ color: '#666' }}>Member Since</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2em', color: '#667eea', marginBottom: '5px' }}>
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
      </div>
    </DashboardLayout>
  )
}
