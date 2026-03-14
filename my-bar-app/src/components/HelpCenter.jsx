import { useState } from 'react';
import { Link } from 'react-router-dom';
import './HelpCenter.css';

/**
 * Help Center Component
 * Knowledge base with FAQs, tutorials, and documentation
 */
const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  const categories = [
    { id: 'all', name: 'All Topics', icon: '📚' },
    { id: 'getting-started', name: 'Getting Started', icon: '🚀' },
    { id: 'products', name: 'Products & Menu', icon: '🍺' },
    { id: 'orders', name: 'Orders & QR Codes', icon: '📱' },
    { id: 'payments', name: 'Payments', icon: '💳' },
    { id: 'staff', name: 'Staff Management', icon: '👥' },
    { id: 'settings', name: 'Settings', icon: '⚙️' },
    { id: 'troubleshooting', name: 'Troubleshooting', icon: '🔧' },
  ];

  const faqs = [
    {
      id: 1,
      category: 'getting-started',
      question: 'How do I set up my bar for the first time?',
      answer: 'After registering, you\'ll be guided through our onboarding wizard. It will help you set up your business information, add products, and configure your settings. You can also access the wizard anytime from Settings > Onboarding.',
    },
    {
      id: 2,
      category: 'getting-started',
      question: 'What information do I need to provide?',
      answer: 'You\'ll need your business name, address, contact details, operating hours, and initial product list. All information can be updated later from your dashboard.',
    },
    {
      id: 3,
      category: 'products',
      question: 'How do I add products to my menu?',
      answer: 'Go to Dashboard > Products > Add Product. Fill in the product name, price, category, and stock status. You can also bulk import products using CSV files from the Products page.',
    },
    {
      id: 4,
      category: 'products',
      question: 'Can I organize products into categories?',
      answer: 'Yes! You can assign categories like Beer, Wine, Spirits, Cocktails, Food, and Snacks to your products. This helps customers browse your menu more easily.',
    },
    {
      id: 5,
      category: 'products',
      question: 'How do I mark a product as out of stock?',
      answer: 'In the Products page, find the product and toggle the "In Stock" switch. Out-of-stock items will be shown as unavailable to customers but remain in your system.',
    },
    {
      id: 6,
      category: 'orders',
      question: 'How does QR code ordering work?',
      answer: 'Customers scan a QR code at their table, browse your menu, add items to cart, and pay via Stripe. Once payment is confirmed, you receive the order instantly and a QR code for the customer to show staff.',
    },
    {
      id: 7,
      category: 'orders',
      question: 'How do I generate QR codes for tables?',
      answer: 'Go to Dashboard > QR Codes > Generate. You can create QR codes for specific tables, events, or general use. Each code links directly to your menu.',
    },
    {
      id: 8,
      category: 'orders',
      question: 'How do I verify a customer\'s order?',
      answer: 'Ask the customer to show their QR code. Use the QR Scanner in your dashboard to scan it. Valid codes will show green with order details; invalid codes show red.',
    },
    {
      id: 9,
      category: 'payments',
      question: 'How do I get paid?',
      answer: 'All payments are processed through Stripe. Funds are deposited directly to your bank account according to your Stripe payout schedule (typically 2-7 business days).',
    },
    {
      id: 10,
      category: 'payments',
      question: 'What payment methods are accepted?',
      answer: 'We support all major credit and debit cards via Stripe, including Visa, Mastercard, and American Express. Customers can also use digital wallets like Apple Pay and Google Pay.',
    },
    {
      id: 11,
      category: 'payments',
      question: 'Are there any transaction fees?',
      answer: 'Stripe charges standard processing fees (typically 2.9% + R2 per transaction in South Africa). There are no additional fees from our platform.',
    },
    {
      id: 12,
      category: 'payments',
      question: 'How do I handle refunds?',
      answer: 'Go to Dashboard > Transactions, find the transaction, and click "Issue Refund". Refunds are processed through Stripe and typically appear in the customer\'s account within 5-10 business days.',
    },
    {
      id: 13,
      category: 'staff',
      question: 'How do I add staff members?',
      answer: 'Go to Dashboard > Staff > Invite Staff. Enter their email address and select their role (Staff or Manager). They\'ll receive an invitation email to create their account.',
    },
    {
      id: 14,
      category: 'staff',
      question: 'What\'s the difference between Staff and Manager roles?',
      answer: 'Staff can view orders, scan QR codes, and mark orders as fulfilled. Managers have additional access to view analytics, manage products, and view transactions. Owners have full access to all features.',
    },
    {
      id: 15,
      category: 'settings',
      question: 'How do I change my business hours?',
      answer: 'Go to Settings > Business Information. You can set different hours for each day of the week and mark days when you\'re closed.',
    },
    {
      id: 16,
      category: 'settings',
      question: 'Can I customize my customer-facing menu?',
      answer: 'Yes! Go to Settings > Appearance to customize your brand colors, logo, and menu layout. Changes take effect immediately for new customer sessions.',
    },
    {
      id: 17,
      category: 'troubleshooting',
      question: 'Customers can\'t see my products',
      answer: 'Check that: 1) Products are marked as "In Stock", 2) Your business hours include the current time, 3) Products have valid prices set. Also ensure your account is active in Settings.',
    },
    {
      id: 18,
      category: 'troubleshooting',
      question: 'QR codes aren\'t working',
      answer: 'Ensure: 1) QR codes were generated from your dashboard, 2) The QR code hasn\'t expired, 3) You\'re scanning with the mobile app or dashboard scanner. Test codes using the "Test QR Code" feature.',
    },
    {
      id: 19,
      category: 'troubleshooting',
      question: 'I\'m not receiving payment notifications',
      answer: 'Check: 1) Your email settings in Settings > Notifications, 2) Spam/junk folder, 3) Stripe webhook is configured correctly. Contact support if issues persist.',
    },
    {
      id: 20,
      category: 'troubleshooting',
      question: 'How do I report a bug or technical issue?',
      answer: 'Click the "Report Issue" button at the bottom of any page, or contact support@yourbarapp.com with details about the problem, including screenshots if possible.',
    },
  ];

  const tutorials = [
    {
      id: 1,
      category: 'getting-started',
      title: 'Complete Setup Guide',
      description: 'Step-by-step guide to setting up your bar from scratch',
      duration: '10 min',
      steps: [
        'Complete onboarding wizard',
        'Add your products and prices',
        'Generate QR codes for tables',
        'Configure payment settings',
        'Invite staff members',
        'Test with a sample order',
      ],
    },
    {
      id: 2,
      category: 'products',
      title: 'Managing Your Menu',
      description: 'Learn how to add, edit, and organize your products',
      duration: '5 min',
      steps: [
        'Navigate to Products page',
        'Click "Add Product" button',
        'Fill in product details (name, price, category)',
        'Upload product image (optional)',
        'Set stock status and save',
        'Use categories to organize items',
      ],
    },
    {
      id: 3,
      category: 'orders',
      title: 'Processing Orders',
      description: 'How to receive and fulfill customer orders',
      duration: '7 min',
      steps: [
        'Monitor real-time order notifications',
        'View order details in dashboard',
        'Prepare the order items',
        'Verify customer QR code with scanner',
        'Mark order as fulfilled',
        'Handle any customer issues',
      ],
    },
    {
      id: 4,
      category: 'payments',
      title: 'Payment Setup & Stripe Integration',
      description: 'Connect your Stripe account and start accepting payments',
      duration: '8 min',
      steps: [
        'Go to Settings > Payments',
        'Click "Connect Stripe Account"',
        'Complete Stripe onboarding',
        'Add bank account details',
        'Test payment with dummy card',
        'Monitor payouts in Stripe dashboard',
      ],
    },
  ];

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredTutorials = tutorials.filter(tutorial => {
    const matchesCategory = selectedCategory === 'all' || tutorial.category === selectedCategory;
    const matchesSearch = !searchQuery ||
      tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  return (
    <div className="help-center">
      <div className="help-header">
        <h1>📚 Help Center</h1>
        <p>Find answers to common questions and learn how to use the platform</p>
      </div>

      <div className="help-search">
        <input
          type="text"
          placeholder="Search for answers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="help-categories">
        {categories.map(category => (
          <button
            key={category.id}
            className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category.id)}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-name">{category.name}</span>
          </button>
        ))}
      </div>

      <div className="help-content">
        {/* Quick Links */}
        <div className="quick-links">
          <h2>Quick Links</h2>
          <div className="links-grid">
            <Link to="/owner/dashboard" className="quick-link-card">
              <span className="link-icon">🏠</span>
              <span className="link-title">Dashboard</span>
            </Link>
            <Link to="/owner/products" className="quick-link-card">
              <span className="link-icon">🍺</span>
              <span className="link-title">Manage Products</span>
            </Link>
            <Link to="/owner/staff" className="quick-link-card">
              <span className="link-icon">👥</span>
              <span className="link-title">Staff</span>
            </Link>
            <a href="mailto:support@yourbarapp.com" className="quick-link-card">
              <span className="link-icon">📧</span>
              <span className="link-title">Contact Support</span>
            </a>
          </div>
        </div>

        {/* Tutorials */}
        {filteredTutorials.length > 0 && (
          <div className="tutorials-section">
            <h2>📖 Tutorials</h2>
            <div className="tutorials-grid">
              {filteredTutorials.map(tutorial => (
                <div key={tutorial.id} className="tutorial-card">
                  <h3>{tutorial.title}</h3>
                  <p className="tutorial-description">{tutorial.description}</p>
                  <span className="tutorial-duration">⏱️ {tutorial.duration}</span>
                  <ol className="tutorial-steps">
                    {tutorial.steps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQs */}
        <div className="faqs-section">
          <h2>❓ Frequently Asked Questions</h2>
          {filteredFAQs.length === 0 ? (
            <p className="no-results">No results found. Try a different search term or category.</p>
          ) : (
            <div className="faqs-list">
              {filteredFAQs.map(faq => (
                <div
                  key={faq.id}
                  className={`faq-item ${expandedFAQ === faq.id ? 'expanded' : ''}`}
                  onClick={() => toggleFAQ(faq.id)}
                >
                  <div className="faq-question">
                    <span>{faq.question}</span>
                    <span className="faq-toggle">
                      {expandedFAQ === faq.id ? '−' : '+'}
                    </span>
                  </div>
                  {expandedFAQ === faq.id && (
                    <div className="faq-answer">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact Support */}
        <div className="support-contact">
          <h2>Still need help?</h2>
          <p>Can&apos;t find what you&apos;re looking for? Our support team is here to help.</p>
          <div className="contact-options">
            <a href="mailto:support@yourbarapp.com" className="contact-btn">
              📧 Email Support
            </a>
            <Link to="/support" className="contact-btn">
              💬 Submit Ticket
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
