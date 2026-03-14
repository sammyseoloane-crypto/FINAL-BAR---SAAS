import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CookieConsent.css';

function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true, // Always required
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already consented
    const cookieConsent = localStorage.getItem('cookieConsent');

    if (!cookieConsent) {
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      // Load saved preferences
      const saved = JSON.parse(cookieConsent);
      setPreferences(saved);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true,
    };
    savePreferences(allAccepted);
  };

  const handleRejectAll = () => {
    const essentialOnly = {
      essential: true,
      analytics: false,
      marketing: false,
    };
    savePreferences(essentialOnly);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  const savePreferences = (prefs) => {
    localStorage.setItem('cookieConsent', JSON.stringify(prefs));
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    setShowBanner(false);
    setShowSettings(false);

    // Trigger any analytics setup based on preferences
    if (prefs.analytics) {
      // Initialize analytics here if needed
    }
  };

  const handleToggle = (type) => {
    setPreferences(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="cookie-consent-overlay">
      <div className="cookie-consent-banner">
        {!showSettings ? (
          <>
            <div className="cookie-consent-header">
              <h3>🍪 We Value Your Privacy</h3>
              <p>
                We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic.
                By clicking &quot;Accept All&quot;, you consent to our use of cookies.
              </p>
              <p style={{ fontSize: '0.9em', marginTop: '10px' }}>
                Read our <Link to="/privacy-policy" target="_blank">Privacy Policy</Link> and <Link to="/terms-of-service" target="_blank">Terms of Service</Link> for more information.
              </p>
            </div>

            <div className="cookie-consent-actions">
              <button
                className="cookie-btn cookie-btn-accept"
                onClick={handleAcceptAll}
              >
                Accept All
              </button>
              <button
                className="cookie-btn cookie-btn-reject"
                onClick={handleRejectAll}
              >
                Reject All
              </button>
              <button
                className="cookie-btn cookie-btn-settings"
                onClick={() => setShowSettings(true)}
              >
                Cookie Settings
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-consent-header">
              <h3>Cookie Preferences</h3>
              <p>Manage your cookie preferences below. Essential cookies are always enabled.</p>
            </div>

            <div className="cookie-preferences">
              <div className="cookie-preference-item">
                <div className="cookie-preference-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.essential}
                      disabled
                    />
                    <strong>Essential Cookies</strong>
                    <span className="cookie-required-badge">Required</span>
                  </label>
                </div>
                <p className="cookie-preference-description">
                  These cookies are necessary for the website to function and cannot be disabled. They include authentication, session management, and security features.
                </p>
              </div>

              <div className="cookie-preference-item">
                <div className="cookie-preference-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={() => handleToggle('analytics')}
                    />
                    <strong>Analytics Cookies</strong>
                  </label>
                </div>
                <p className="cookie-preference-description">
                  These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This helps us improve the user experience.
                </p>
              </div>

              <div className="cookie-preference-item">
                <div className="cookie-preference-header">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={() => handleToggle('marketing')}
                    />
                    <strong>Marketing Cookies</strong>
                  </label>
                </div>
                <p className="cookie-preference-description">
                  These cookies are used to track visitors across websites to display relevant and engaging advertisements. Currently not in use.
                </p>
              </div>
            </div>

            <div className="cookie-consent-actions">
              <button
                className="cookie-btn cookie-btn-accept"
                onClick={handleSavePreferences}
              >
                Save Preferences
              </button>
              <button
                className="cookie-btn cookie-btn-secondary"
                onClick={() => setShowSettings(false)}
              >
                Back
              </button>
            </div>
          </>
        )}

        <div className="cookie-consent-footer">
          <p style={{ fontSize: '0.85em', color: '#666' }}>
            <strong>POPIA Compliance:</strong> This website complies with South Africa&apos;s Protection of Personal Information Act (POPIA).
            You have the right to access, correct, and delete your personal data at any time.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
