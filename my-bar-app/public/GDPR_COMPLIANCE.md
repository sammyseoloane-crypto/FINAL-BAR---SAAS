# GDPR Compliance Documentation

**General Data Protection Regulation (EU) 2016/679**  
**Effective Date:** March 14, 2026  
**Last Updated:** March 14, 2026

## 1. Introduction

This document demonstrates how the Nightclub Management Platform complies with the General Data Protection Regulation (GDPR), the EU's comprehensive data protection law.

## 2. GDPR Principles

We adhere to all six GDPR principles:

### 2.1 Lawfulness, Fairness, and Transparency
- We process data lawfully based on consent, contract, or legitimate interests
- We provide clear information about data processing in our Privacy Policy
- We are transparent about how we use your data

### 2.2 Purpose Limitation
- We collect data only for specified, explicit purposes
- We do not process data for incompatible purposes
- We notify you of any new processing purposes

### 2.3 Data Minimization
- We collect only data necessary for our purposes
- We do not request excessive or irrelevant information
- We regularly review data collection practices

### 2.4 Accuracy
- We maintain accurate and up-to-date records
- We provide tools to update your information
- We correct inaccuracies promptly upon request

### 2.5 Storage Limitation
- We retain data only as long as necessary
- We delete data when no longer needed
- We have clear retention schedules

| Data Type | Retention Period |
|-----------|------------------|
| Active account data | Indefinite (while account is active) |
| Inactive accounts | 24 months |
| Deleted accounts | 30 days (recovery period) |
| Financial records | 7 years (legal requirement) |
| Backups | 90 days |
| Anonymous analytics | Indefinite |

### 2.6 Integrity and Confidentiality
- We implement appropriate security measures
- We protect data from unauthorized access, loss, or destruction
- We train staff on data protection

## 3. Legal Basis for Processing

### 3.1 Consent (Article 6(1)(a))

**When We Use Consent:**
- Marketing emails and promotional communications
- Optional analytics and tracking
- Social media profile connections
- Location-based services

**How We Obtain Consent:**
- Clear, affirmative opt-in (no pre-ticked boxes)
- Specific consent for each purpose
- Easy withdrawal mechanism
- Record of consent timestamp and method

**How to Withdraw Consent:**
- Account settings → Privacy preferences
- Unsubscribe link in emails
- Email: privacy@nightclub.app

### 3.2 Contract (Article 6(1)(b))

**Processing Necessary to Fulfill Our Contract:**
- Account creation and authentication
- Transaction processing and order fulfillment
- Table reservations and bookings
- Payment processing
- Customer support

### 3.3 Legal Obligation (Article 6(1)(c))

**Processing Required by Law:**
- Financial record retention (tax law)
- Identity verification for certain transactions
- Compliance with court orders
- Anti-money laundering checks (where applicable)

### 3.4 Legitimate Interests (Article 6(1)(f))

**Our Legitimate Business Interests:**
- Fraud prevention and security
- Internal analytics and service improvement
- Network and information security
- Business continuity and disaster recovery

**Balancing Test:**
We have assessed that these interests do not override your fundamental rights and freedoms.

## 4. Data Subject Rights

### 4.1 Right to Access (Article 15)

**What You Can Request:**
- Confirmation that we process your data
- Copy of your personal data
- Information about processing purposes
- Categories of data processed
- Recipients of data
- Retention periods
- Rights information

**How to Request:**
- Email: privacy@nightclub.app
- Subject: "GDPR Access Request"
- Include: Account email and identification

**Response Time:** 30 days (extendable by 60 days for complex requests)

**Format:** Electronic copy (JSON or CSV) or PDF report

### 4.2 Right to Rectification (Article 16)

**How to Correct Data:**
- Update account settings directly
- Contact support@nightclub.app
- Request correction via privacy@nightclub.app

**We Will:**
- Correct inaccurate data within 30 days
- Notify third parties of corrections (where applicable)
- Confirm correction to you

### 4.3 Right to Erasure ("Right to Be Forgotten") (Article 17)

**When You Can Request Deletion:**
- Data no longer necessary for original purpose
- You withdraw consent
- You object to processing
- Data was unlawfully processed
- Legal obligation requires deletion

**Exceptions (We May Retain Data):**
- Compliance with legal obligations (e.g., financial records for 7 years)
- Exercise or defense of legal claims
- Public health or archiving purposes

**How to Request Deletion:**
- Account settings → Delete account
- Email: privacy@nightclub.app
- We will confirm deletion within 30 days

### 4.4 Right to Restriction of Processing (Article 18)

**When You Can Request Restriction:**
- You contest data accuracy (restriction during verification)
- Processing is unlawful, but you oppose deletion
- We no longer need data, but you need it for legal claims
- You object to processing (restriction pending verification)

**Effect of Restriction:**
- Data stored but not processed
- You will be notified before restriction is lifted

### 4.5 Right to Data Portability (Article 20)

**What You Can Receive:**
- Your data in machine-readable format (JSON, CSV)
- All data you provided to us
- Data processed by automated means based on consent or contract

**How to Request:**
- Account settings → Export data
- Email: privacy@nightclub.app
- Receive data within 30 days

**Data Included:**
- Profile information
- Transaction history
- Reservation records
- Bar tab history
- Guest list entries

### 4.6 Right to Object (Article 21)

**You Can Object To:**
- Processing based on legitimate interests
- Direct marketing (including profiling)
- Processing for scientific/historical research

**Effect of Objection:**
- We will stop processing unless we have compelling legitimate grounds
- Marketing processing stops immediately

### 4.7 Rights Related to Automated Decision-Making (Article 22)

**Our Use of Automated Decision-Making:**
- Fraud detection algorithms
- Personalized recommendations (AI-based)
- Creditworthiness assessment (for bottle service credit)

**Your Rights:**
- Request human review of automated decisions
- Express your point of view
- Contest the decision

**How We Mitigate Risks:**
- Human oversight for significant decisions
- Transparent explanation of logic
- Ability to override automated decisions

## 5. Data Processing Agreements (Article 28)

### 5.1 Our Processors

We have Data Processing Agreements (DPAs) with:

| Processor | Service | Location | DPA Status |
|-----------|---------|----------|------------|
| Supabase | Database & Auth | EU (Frankfurt) | ✓ Signed |
| Stripe | Payment Processing | US & EU | ✓ Signed |
| Netlify | Web Hosting | US & EU | ✓ Signed |
| AWS S3 | Backup Storage | EU (Ireland) | ✓ Signed |
| Sentry | Error Tracking | US | ✓ Signed |

### 5.2 DPA Requirements

All processors must:
- Process data only on our instructions
- Implement appropriate security measures
- Ensure confidentiality of personnel
- Assist with data subject rights requests
- Delete or return data upon termination
- Allow audits and inspections
- Report data breaches within 24 hours

## 6. International Data Transfers (Chapter V)

### 6.1 Transfer Mechanisms

**EU to US Transfers:**
- **EU-US Data Privacy Framework** (for certified companies)
- **Standard Contractual Clauses (SCCs)** (2021 version)

**EU to Other Countries:**
- **Standard Contractual Clauses**
- **Adequacy Decisions** (for countries with adequate protection)

### 6.2 Transfer Safeguards

We ensure:
- Appropriate contractual protections
- Encryption in transit and at rest
- Access controls to minimize exposure
- Transfer Impact Assessments (TIAs) for high-risk transfers

## 7. Data Protection by Design and Default (Article 25)

### 7.1 Technical Measures

- **Encryption**: TLS 1.3 in transit, AES-256 at rest
- **Pseudonymization**: User IDs instead of names in logs
- **Access Controls**: Role-based access (RBAC)
- **API Rate Limiting**: Prevent data scraping
- **Secure Authentication**: Password hashing (bcrypt), MFA support

### 7.2 Organizational Measures

- **Privacy by Default**: Minimal data collection by default
- **Privacy Settings**: Account settings page with granular controls
- **Data Minimization**: We don't request data we don't need
- **Training**: All staff trained on GDPR principles
- **Privacy Impact Assessments**: For new features involving personal data

## 8. Data Breach Notification (Articles 33 & 34)

### 8.1 Breach Detection

We monitor for breaches through:
- Real-time security event logging
- Failed login attempt tracking
- API anomaly detection
- Sentry error monitoring
- Regular security audits

### 8.2 Breach Response Timeline

| Time | Action |
|------|--------|
| 0-1 hour | Breach detected and incident response team notified |
| 1-6 hours | Containment and assessment of scope |
| 6-24 hours | Investigation and documentation |
| Within 72 hours | Notify supervisory authority (if required) |
| Without undue delay | Notify affected data subjects (if high risk) |

### 8.3 Notification Content

**To Supervisory Authority:**
- Nature of breach
- Categories and approximate number of affected individuals
- Categories and approximate number of affected records
- Likely consequences
- Measures taken or proposed
- Contact point (DPO)

**To Data Subjects:**
- Nature of breach in clear language
- Contact point for more information
- Likely consequences
- Measures taken to mitigate harm
- Recommendations for individuals

## 9. Data Protection Officer (Article 37-39)

### 9.1 DPO Contact Information

**Name:** [DPO Name]  
**Email:** dpo@nightclub.app  
**Phone:** [Phone Number]  
**Address:** [Business Address]

### 9.2 DPO Responsibilities

- Monitor GDPR compliance
- Advise on data protection obligations
- Conduct Data Protection Impact Assessments (DPIAs)
- Serve as contact point for supervisory authorities
- Handle data subject rights requests
- Train staff on data protection

### 9.3 DPO Independence

Our DPO:
- Reports directly to highest management level
- Does not receive instructions regarding compliance tasks
- Cannot be dismissed for performing DPO duties
- Has necessary resources and expertise

## 10. Data Protection Impact Assessments (Article 35)

### 10.1 When We Conduct DPIAs

- New technologies or processing methods
- Large-scale processing of special category data
- Systematic monitoring of public areas
- Automated decision-making with legal effects
- Processing that presents high risk to rights and freedoms

### 10.2 DPIA Process

1. **Describe Processing**: Purpose, data, and recipients
2. **Assess Necessity**: Justify need for processing
3. **Identify Risks**: Risks to data subjects
4. **Mitigate Risks**: Safeguards and measures
5. **Consult DPO**: Review and recommendations
6. **Document**: Record DPIA findings
7. **Review**: Reassess when circumstances change

## 11. Records of Processing Activities (Article 30)

We maintain records of:
- **Purpose of Processing**: Why we process data
- **Categories of Data Subjects**: Who we process data about
- **Categories of Data**: What types of data
- **Recipients**: Who receives data
- **Transfers**: International transfers
- **Retention**: How long we keep data
- **Security**: Technical and organizational measures

## 12. Supervisory Authority

### 12.1 Lead Supervisory Authority

Our lead supervisory authority is determined by our main establishment in the EU.

**Contact:** [Your Lead Supervisory Authority]  
**Website:** [Authority Website]  
**Email:** [Authority Email]

### 12.2 Cooperation

We commit to:
- Cooperate with supervisory authority requests
- Respond to inquiries within legal timeframes
- Implement corrective measures if required
- Participate in investigations

### 12.3 Lodging a Complaint

You have the right to lodge a complaint with:
- Our lead supervisory authority
- Your local data protection authority
- The authority in the place where the alleged infringement occurred

**Find your local authority:** https://edpb.europa.eu/about-edpb/board/members_en

## 13. Consent Management

### 13.1 How We Obtain Consent

- **Clear and Plain Language**: No legal jargon
- **Specific**: Separate consent for each purpose
- **Informed**: Explain what you're consenting to
- **Freely Given**: No forced acceptance (service not conditional on consent for non-essential processing)
- **Affirmative Action**: Opt-in only (no pre-ticked boxes)

### 13.2 Consent Records

We record:
- Who consented
- When consent was given
- What was consented to
- How consent was obtained
- Whether consent has been withdrawn

### 13.3 Withdrawal of Consent

- **Easy as Giving Consent**: Same process, same channel
- **No Penalty**: No negative consequences for withdrawal
- **Immediate Effect**: Processing stops immediately
- **Account Settings**: Manage consent preferences
- **Email Unsubscribe**: One-click unsubscribe for marketing

## 14. Special Category Data (Article 9)

### 14.1 What We Do NOT Collect

We do not collect special category data unless absolutely necessary:
- Racial or ethnic origin
- Political opinions
- Religious or philosophical beliefs
- Trade union membership
- Genetic data
- Biometric data (for unique identification)
- Health data
- Sex life or sexual orientation

### 14.2 Exception: Age Verification

- We may verify age for alcohol service (le requirement)
- Based on explicit consent or legal obligation
- Minimal data collected (yes/no verification)

## 15. Children's Data (Article 8)

- Our Service is not directed at children under 16
- We do not knowingly collect data from children under 16
- Parental consent required for users under 16 (if applicable)
- We delete children's data immediately upon discovery

## 16. Compliance Monitoring

### 16.1 Regular Audits

- **Annual GDPR Compliance Audit**: Full review of practices
- **Quarterly DPO Review**: Check for policy adherence
- **Monthly Security Review**: Assess technical measures
- **Continuous Monitoring**: Automated compliance checks

### 16.2 Training

- **Onboarding**: All new staff trained on GDPR
- **Annual Refresher**: Yearly training for all employees
- **Role-Specific**: Additional training for staff handling personal data
- **Incident Response**: Training on breach procedures

### 16.3 Documentation

We maintain:
- Records of processing activities
- DPIAs for high-risk processing
- Consent records
- Data subject rights request logs
- Breach incident reports
- Training records
- Vendor DPA agreements

## 17. Updates to GDPR Compliance

- We review this document annually
- Material changes communicated to users
- Updates published at: https://nightclub.app/gdpr-compliance
- Contact DPO for questions: dpo@nightclub.app

---

**Last Updated:** March 14, 2026  
**Next Review:** March 14, 2027

**Contact:**  
Data Protection Officer  
Email: dpo@nightclub.app  
Website: https://nightclub.app
