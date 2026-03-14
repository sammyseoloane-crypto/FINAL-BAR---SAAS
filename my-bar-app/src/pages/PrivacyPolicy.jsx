import { Link } from 'react-router-dom';
import './Auth.css';

function PrivacyPolicy() {
  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '900px', padding: '40px' }}>
        <h1>Privacy Policy</h1>
        <p style={{ color: '#666', marginBottom: '10px' }}>
          Last Updated: March 11, 2026
        </p>
        <p style={{ color: '#666', marginBottom: '30px', fontWeight: 'bold' }}>
          POPIA Compliant (South Africa - Protection of Personal Information Act, 2013)
        </p>

        <div style={{ textAlign: 'left', lineHeight: '1.8' }}>
          <section style={{ marginBottom: '30px' }}>
            <h2>1. Introduction</h2>
            <p>
              This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our Multi-Tenant Bar Management Platform ("Service"). This policy complies with South Africa's Protection of Personal Information Act (POPIA, Act 4 of 2013).
            </p>
            <p>
              <strong>Information Regulator Contact:</strong> If you have concerns about how we process your personal information, you may contact the Information Regulator (South Africa) at <a href="https://www.justice.gov.za/inforeg/" target="_blank" rel="noopener noreferrer">www.justice.gov.za/inforeg/</a>
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>2. Information We Collect</h2>

            <h3>2.1 Personal Information</h3>
            <p>We collect the following types of personal information:</p>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, phone number, password (encrypted)</li>
              <li><strong>Profile Information:</strong> Role (owner/staff/customer), tenant association, preferences</li>
              <li><strong>Payment Information:</strong> Processed by Stripe (we do not store full credit card details)</li>
              <li><strong>Transaction Data:</strong> Purchase history, QR codes, event bookings, order details</li>
              <li><strong>Location Data:</strong> Venue/bar locations (for owners), check-in locations (optional)</li>
              <li><strong>Usage Data:</strong> Login history, IP addresses, browser type, device information</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <ul>
              <li>Log files (timestamps, IP addresses, request URLs)</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Analytics data (page views, session duration, interactions)</li>
              <li>Error reports and diagnostics (via Sentry)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>3. Legal Basis for Processing (POPIA Compliance)</h2>
            <p>
              Under POPIA, we process your personal information based on the following lawful grounds:
            </p>
            <ul>
              <li><strong>Consent:</strong> You have given explicit consent for processing your personal information</li>
              <li><strong>Contract Performance:</strong> Processing is necessary to perform our service agreement with you</li>
              <li><strong>Legal Obligation:</strong> We must process your information to comply with South African laws</li>
              <li><strong>Legitimate Interest:</strong> Processing is necessary for our legitimate business interests (e.g., fraud prevention, service improvement)</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>4. How We Use Your Information</h2>
            <p>We use your personal information for the following purposes:</p>
            <ul>
              <li><strong>Service Delivery:</strong> To provide and maintain the bar management platform</li>
              <li><strong>Account Management:</strong> To create and manage your account, authenticate users</li>
              <li><strong>Payment Processing:</strong> To process transactions via Stripe</li>
              <li><strong>Communication:</strong> To send transactional emails (order confirmations, password resets, important updates)</li>
              <li><strong>Customer Support:</strong> To respond to your inquiries and provide assistance</li>
              <li><strong>Analytics:</strong> To understand usage patterns and improve the Service</li>
              <li><strong>Security:</strong> To detect and prevent fraud, abuse, and security incidents</li>
              <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>5. Data Sharing and Disclosure</h2>

            <h3>5.1 Third-Party Service Providers</h3>
            <p>We share your information with trusted third-party service providers:</p>
            <ul>
              <li><strong>Supabase:</strong> Database hosting and authentication (PostgreSQL, located in South Africa region when available)</li>
              <li><strong>Stripe:</strong> Payment processing (complies with PCI-DSS)</li>
              <li><strong>Sentry:</strong> Error monitoring and diagnostics</li>
              <li><strong>Netlify:</strong> Website hosting and deployment</li>
            </ul>

            <h3>5.2 Tenant Isolation</h3>
            <p>
              Your data is isolated by tenant. Venue owners can only access data for their own venue. Staff can only access data relevant to their assigned tasks. Row-Level Security (RLS) policies enforce this isolation at the database level.
            </p>

            <h3>5.3 Legal Requirements</h3>
            <p>
              We may disclose your information if required by law, court order, or government request, or to protect our rights, property, or safety.
            </p>

            <h3>5.4 No Sale of Personal Information</h3>
            <p>
              We do NOT sell, rent, or trade your personal information to third parties for marketing purposes.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>6. Your Rights Under POPIA</h2>
            <p>
              As a data subject under POPIA, you have the following rights:
            </p>

            <h3>6.1 Right to Access</h3>
            <p>
              You have the right to request confirmation of whether we hold your personal information and to access such information.
            </p>

            <h3>6.2 Right to Correction</h3>
            <p>
              You have the right to request correction of inaccurate or incomplete personal information. You can update most information through your profile settings.
            </p>

            <h3>6.3 Right to Deletion (Right to be Forgotten)</h3>
            <p>
              You have the right to request deletion of your personal information. You can submit a deletion request through your profile settings or by contacting us at <strong>privacy@barmanagement.co.za</strong>
            </p>

            <h3>6.4 Right to Object</h3>
            <p>
              You have the right to object to the processing of your personal information for direct marketing or other purposes.
            </p>

            <h3>6.5 Right to Restrict Processing</h3>
            <p>
              You have the right to request restriction of processing in certain circumstances.
            </p>

            <h3>6.6 Right to Data Portability</h3>
            <p>
              You have the right to receive your personal information in a structured, commonly used format and to transmit it to another controller.
            </p>

            <h3>6.7 Right to Lodge a Complaint</h3>
            <p>
              You have the right to lodge a complaint with the Information Regulator of South Africa:
            </p>
            <ul>
              <li><strong>Website:</strong> <a href="https://www.justice.gov.za/inforeg/" target="_blank" rel="noopener noreferrer">www.justice.gov.za/inforeg/</a></li>
              <li><strong>Email:</strong> inforeg@justice.gov.za</li>
              <li><strong>Phone:</strong> +27 (0) 12 406 4818</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>7. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information:
            </p>
            <ul>
              <li><strong>Encryption:</strong> Data is encrypted in transit (HTTPS/TLS) and at rest</li>
              <li><strong>Authentication:</strong> JWT-based authentication with secure password hashing</li>
              <li><strong>Access Control:</strong> Row-Level Security (RLS) policies enforce tenant isolation</li>
              <li><strong>Rate Limiting:</strong> Protection against abuse and brute-force attacks</li>
              <li><strong>Monitoring:</strong> Real-time error monitoring and security alerts</li>
              <li><strong>Backups:</strong> Regular automated backups with encryption</li>
              <li><strong>Stripe Security:</strong> Payment data handled by PCI-DSS compliant Stripe</li>
            </ul>
            <p>
              Despite these measures, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>8. Data Retention</h2>
            <p>
              We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy:
            </p>
            <ul>
              <li><strong>Active Accounts:</strong> Data retained while your account is active</li>
              <li><strong>Transaction Records:</strong> Retained for 7 years to comply with tax and accounting laws</li>
              <li><strong>Marketing Data:</strong> Retained until you withdraw consent or object to processing</li>
              <li><strong>Legal Holds:</strong> Data subject to legal proceedings retained until resolution</li>
              <li><strong>Deleted Accounts:</strong> Personal data anonymized or deleted within 90 days of account deletion request</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>9. Cookies and Tracking Technologies</h2>

            <h3>9.1 Types of Cookies We Use</h3>
            <ul>
              <li><strong>Essential Cookies:</strong> Required for authentication and session management</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the Service</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
            </ul>

            <h3>9.2 Managing Cookies</h3>
            <p>
              You can control cookie preferences through your browser settings. Note that disabling essential cookies may affect the functionality of the Service.
            </p>

            <h3>9.3 Cookie Consent</h3>
            <p>
              We display a cookie consent banner when you first visit the Service. By continuing to use the Service, you consent to our use of cookies as described in this policy.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>10. Children's Privacy</h2>
            <p>
              The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we discover that we have collected information from a child under 18, we will delete it immediately.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>11. International Data Transfers</h2>
            <p>
              Your personal information may be transferred to and processed in countries other than South Africa. We ensure that adequate safeguards are in place to protect your information in accordance with POPIA requirements, including:
            </p>
            <ul>
              <li>Ensuring recipients are subject to laws providing adequate protection</li>
              <li>Implementing contractual obligations requiring adequate protection</li>
              <li>Obtaining your consent where required</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>12. Automated Decision-Making</h2>
            <p>
              We do not use automated decision-making or profiling that produces legal effects or similarly significantly affects you without human involvement.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>13. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by:
            </p>
            <ul>
              <li>Updating the "Last Updated" date at the top of this policy</li>
              <li>Sending an email notification to registered users (for significant changes)</li>
              <li>Displaying a prominent notice on the Service</li>
            </ul>
            <p>
              Your continued use of the Service after such changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>14. Contact Information</h2>
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact:
            </p>
            <ul>
              <li><strong>Data Protection Officer:</strong> privacy@barmanagement.co.za</li>
              <li><strong>General Inquiries:</strong> support@barmanagement.co.za</li>
              <li><strong>Phone:</strong> +27 (0) 11 123 4567</li>
              <li><strong>Address:</strong> Cape Town, South Africa</li>
            </ul>
            <p style={{ marginTop: '20px' }}>
              <strong>To Exercise Your Rights:</strong>
            </p>
            <ul>
              <li>Data access requests: <Link to="/profile">Profile Settings</Link></li>
              <li>Data deletion requests: <Link to="/profile">Profile Settings → Delete Account</Link></li>
              <li>Email us at: <strong>privacy@barmanagement.co.za</strong></li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>15. POPIA Compliance Summary</h2>
            <p>
              We are committed to complying with all eight conditions for lawful processing under POPIA:
            </p>
            <ol>
              <li><strong>Accountability:</strong> We take responsibility for compliance with POPIA</li>
              <li><strong>Processing Limitation:</strong> We process information lawfully and only for specified purposes</li>
              <li><strong>Purpose Specification:</strong> Collection purposes are clearly defined and communicated</li>
              <li><strong>Further Processing Limitation:</strong> No processing beyond original purpose without consent</li>
              <li><strong>Information Quality:</strong> We ensure data is complete, accurate, and up-to-date</li>
              <li><strong>Openness:</strong> This Privacy Policy provides transparency about our practices</li>
              <li><strong>Security Safeguards:</strong> Comprehensive technical and organizational measures in place</li>
              <li><strong>Data Subject Participation:</strong> You have rights to access, correct, and delete your data</li>
            </ol>
          </section>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
          <Link to="/auth/login" className="auth-link">
            ← Back to Login
          </Link>
          {' | '}
          <Link to="/terms-of-service" className="auth-link">
            View Terms of Service →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicy;
