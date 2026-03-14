import { Link } from 'react-router-dom';
import './Auth.css';

function TermsOfService() {
  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '900px', padding: '40px' }}>
        <h1>Terms of Service</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          Last Updated: March 11, 2026
        </p>

        <div style={{ textAlign: 'left', lineHeight: '1.8' }}>
          <section style={{ marginBottom: '30px' }}>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using this Multi-Tenant Bar Management Platform ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use the Service.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>2. Description of Service</h2>
            <p>
              The Service provides a comprehensive bar management platform that enables:
            </p>
            <ul>
              <li>Multi-tenant bar and venue management</li>
              <li>Point of sale (POS) and payment processing via Stripe</li>
              <li>Event management and ticketing</li>
              <li>Staff task management and coordination</li>
              <li>Customer ordering and QR code verification</li>
              <li>Analytics and reporting</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>3. User Accounts and Registration</h2>
            <p>
              <strong>3.1 Account Creation:</strong> You must register for an account to use certain features of the Service. You agree to provide accurate, current, and complete information during registration.
            </p>
            <p>
              <strong>3.2 Account Security:</strong> You are responsible for safeguarding your password and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
            </p>
            <p>
              <strong>3.3 Account Types:</strong> The Service supports multiple user roles including Owner/Admin, Staff, and Customer accounts, each with different access levels and permissions.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>4. Payment Terms</h2>
            <p>
              <strong>4.1 Payment Processing:</strong> All payments are processed through Stripe. By making a purchase, you agree to Stripe's Terms of Service.
            </p>
            <p>
              <strong>4.2 Pricing:</strong> Prices for products, events, and services are set by individual venue owners and are subject to change without notice.
            </p>
            <p>
              <strong>4.3 Refunds:</strong> Refund policies are determined by individual venue owners. Please contact the venue directly for refund requests.
            </p>
            <p>
              <strong>4.4 Subscription Fees:</strong> Venue owners may be subject to subscription fees for using the platform. Fees are billed in advance on a recurring basis.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>5. User Responsibilities</h2>
            <p>
              You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree NOT to:
            </p>
            <ul>
              <li>Use the Service in any way that violates any applicable laws or regulations</li>
              <li>Impersonate or attempt to impersonate another user or person</li>
              <li>Engage in any conduct that restricts or inhibits anyone's use of the Service</li>
              <li>Use any automated system to access the Service in a manner that sends more request messages than a human can reasonably produce</li>
              <li>Introduce viruses, trojans, worms, or other malicious code</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>6. Intellectual Property Rights</h2>
            <p>
              The Service and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>7. Data Privacy and Protection</h2>
            <p>
              <strong>7.1 Privacy Policy:</strong> Your use of the Service is also governed by our <Link to="/privacy-policy">Privacy Policy</Link>, which is incorporated into these Terms by reference.
            </p>
            <p>
              <strong>7.2 POPIA Compliance:</strong> We comply with South Africa's Protection of Personal Information Act (POPIA). See our Privacy Policy for details on how we collect, use, and protect your personal information.
            </p>
            <p>
              <strong>7.3 Data Retention:</strong> We retain your personal data only for as long as necessary for the purposes set out in our Privacy Policy.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>8. QR Codes and Digital Tickets</h2>
            <p>
              <strong>8.1 QR Code Validity:</strong> QR codes generated for events and purchases are valid only for the specified event or transaction and cannot be transferred unless explicitly stated.
            </p>
            <p>
              <strong>8.2 Verification:</strong> QR codes must be presented for verification at the venue. You are responsible for maintaining the security of your QR codes.
            </p>
            <p>
              <strong>8.3 Lost or Stolen Codes:</strong> We are not responsible for lost or stolen QR codes. Contact the venue owner immediately if your code is compromised.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>10. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless the Service, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>11. Termination</h2>
            <p>
              <strong>11.1 By You:</strong> You may terminate your account at any time by contacting us or using the account deletion feature in your profile settings.
            </p>
            <p>
              <strong>11.2 By Us:</strong> We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, with or without notice, for any reason or no reason.
            </p>
            <p>
              <strong>11.3 Effect of Termination:</strong> Upon termination, your right to use the Service will immediately cease. Data deletion will be handled in accordance with our Privacy Policy and applicable laws.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of South Africa, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts of South Africa.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>13. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. Your continued use of the Service after such changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>14. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <ul>
              <li>Email: legal@barmanagement.co.za</li>
              <li>Phone: +27 (0) 11 123 4567</li>
              <li>Address: Cape Town, South Africa</li>
            </ul>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>15. Severability</h2>
            <p>
              If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed and interpreted to accomplish the objectives of such provision to the greatest extent possible under applicable law, and the remaining provisions will continue in full force and effect.
            </p>
          </section>

          <section style={{ marginBottom: '30px' }}>
            <h2>16. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and us regarding the use of the Service and supersede all prior agreements and understandings.
            </p>
          </section>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #ddd' }}>
          <Link to="/auth/login" className="auth-link">
            ← Back to Login
          </Link>
          {' | '}
          <Link to="/privacy-policy" className="auth-link">
            View Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default TermsOfService;
