import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import './PageHeader.css';

export default function PageHeader({ minimal = false }) {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const handleHomeClick = () => {
    navigate('/dashboard');
  };

  return (
    <div className="page-header-nav">
      <div className="page-header-left">
        {!minimal && <h2 className="page-header-brand">🍺 Bar SaaS</h2>}
        {userProfile?.tenant_name && (
          <span className="page-header-company">🏢 {userProfile.tenant_name}</span>
        )}
      </div>
      <div className="page-header-right">
        <button onClick={handleHomeClick} className="btn-page-home">
          🏠 Home
        </button>
        <button onClick={handleSignOut} className="btn-page-signout">
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}
