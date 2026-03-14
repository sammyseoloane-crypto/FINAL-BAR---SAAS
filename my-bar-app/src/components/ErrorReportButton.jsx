import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { trackSecurityIssue } from '../utils/monitoring';
import * as Sentry from '@sentry/react';
import './ErrorReportButton.css';

/**
 * Error Report Button Component
 * Floating button that allows users to report bugs and issues
 */
const ErrorReportButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    type: 'bug',
    severity: 'medium',
    title: '',
    description: '',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
    screenshot: null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get user profile for tenant info
      let tenantId = null;
      let userRole = null;
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tenant_id, role')
          .eq('user_id', user.id)
          .single();

        tenantId = profile?.tenant_id;
        userRole = profile?.role;
      }

      // Prepare issue data
      const issueData = {
        user_id: user?.id || null,
        user_email: user?.email || 'anonymous',
        tenant_id: tenantId,
        type: formData.type,
        severity: formData.severity,
        title: formData.title,
        description: formData.description,
        steps_to_reproduce: formData.stepsToReproduce,
        expected_behavior: formData.expectedBehavior,
        actual_behavior: formData.actualBehavior,
        status: 'open',
        metadata: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          userRole: userRole,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        },
      };

      // Save to database (support_tickets table)
      const { error: dbError } = await supabase
        .from('support_tickets')
        .insert([issueData]);

      if (dbError) {
        throw dbError;
      }

      // Send to Sentry
      Sentry.captureMessage(`User Reported Issue: ${formData.title}`, {
        level: formData.severity === 'critical' ? 'error' : 'warning',
        tags: {
          category: 'user_report',
          issueType: formData.type,
          severity: formData.severity,
        },
        contexts: {
          report: issueData,
        },
      });

      // Track as security issue if it's a security concern
      if (formData.type === 'security') {
        trackSecurityIssue(`User reported security issue: ${formData.title}`, {
          issueType: 'user_reported_security',
          severity: formData.severity,
          userId: user?.id,
        });
      }

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setFormData({
          type: 'bug',
          severity: 'medium',
          title: '',
          description: '',
          stepsToReproduce: '',
          expectedBehavior: '',
          actualBehavior: '',
          screenshot: null,
        });
      }, 3000);
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again or contact support@yourbarapp.com');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      {/* Floating Button */}
      <button
        className="error-report-fab"
        onClick={() => setIsOpen(true)}
        title="Report an issue"
      >
        🐛
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="error-report-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="error-report-modal" onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              <div className="report-success">
                <div className="success-icon">✅</div>
                <h2>Thank You!</h2>
                <p>Your report has been submitted. Our team will review it shortly.</p>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h2>🐛 Report an Issue</h2>
                  <button
                    className="modal-close"
                    onClick={() => setIsOpen(false)}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="report-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Issue Type *</label>
                      <select
                        value={formData.type}
                        onChange={(e) => updateField('type', e.target.value)}
                        required
                      >
                        <option value="bug">Bug / Error</option>
                        <option value="feature">Feature Request</option>
                        <option value="performance">Performance Issue</option>
                        <option value="usability">Usability Problem</option>
                        <option value="security">Security Concern</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Severity *</label>
                      <select
                        value={formData.severity}
                        onChange={(e) => updateField('severity', e.target.value)}
                        required
                      >
                        <option value="low">Low - Minor inconvenience</option>
                        <option value="medium">Medium - Affects workflow</option>
                        <option value="high">High - Blocks important features</option>
                        <option value="critical">Critical - System unusable</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder="Brief description of the issue"
                      required
                      maxLength={200}
                    />
                  </div>

                  <div className="form-group">
                    <label>Description *</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder="Provide details about the issue..."
                      required
                      rows={4}
                    />
                  </div>

                  {formData.type === 'bug' && (
                    <>
                      <div className="form-group">
                        <label>Steps to Reproduce</label>
                        <textarea
                          value={formData.stepsToReproduce}
                          onChange={(e) => updateField('stepsToReproduce', e.target.value)}
                          placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                          rows={3}
                        />
                      </div>

                      <div className="form-group">
                        <label>Expected Behavior</label>
                        <input
                          type="text"
                          value={formData.expectedBehavior}
                          onChange={(e) => updateField('expectedBehavior', e.target.value)}
                          placeholder="What should have happened?"
                        />
                      </div>

                      <div className="form-group">
                        <label>Actual Behavior</label>
                        <input
                          type="text"
                          value={formData.actualBehavior}
                          onChange={(e) => updateField('actualBehavior', e.target.value)}
                          placeholder="What actually happened?"
                        />
                      </div>
                    </>
                  )}

                  <div className="form-footer">
                    <p className="privacy-note">
                      📊 We automatically collect browser info and page URL to help diagnose issues.
                    </p>

                    <button
                      type="submit"
                      className="btn-submit"
                      disabled={loading}
                    >
                      {loading ? 'Submitting...' : 'Submit Report'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ErrorReportButton;
