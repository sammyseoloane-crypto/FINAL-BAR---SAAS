import { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './OnboardingWizard.css';

/**
 * Onboarding Wizard for New Bar Owners
 * Multi-step setup process to get new tenants started
 */
const OnboardingWizard = ({ onComplete }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    // Step 1: Tenant Information
    tenantName: '',
    businessType: 'bar',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    phone: '',

    // Step 2: Business Hours
    monday: { open: '09:00', close: '23:00', closed: false },
    tuesday: { open: '09:00', close: '23:00', closed: false },
    wednesday: { open: '09:00', close: '23:00', closed: false },
    thursday: { open: '09:00', close: '23:00', closed: false },
    friday: { open: '09:00', close: '02:00', closed: false },
    saturday: { open: '09:00', close: '02:00', closed: false },
    sunday: { open: '12:00', close: '22:00', closed: false },

    // Step 3: Initial Products
    productsToAdd: [],

    // Step 4: Staff
    staffToAdd: [],
  });

  const totalSteps = 5;

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateHours = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }    }));
  };

  const handleNext = async () => {
    setError('');

    // Validate current step
    if (currentStep === 1) {
      if (!formData.tenantName || !formData.city || !formData.phone) {
        setError('Please fill in all required fields');
        return;
      }
    }

    if (currentStep === totalSteps) {
      await handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get user's tenant
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.tenant_id) {
        throw new Error('No tenant found');
      }

      // Update tenant information
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          name: formData.tenantName,
          settings: {
            businessType: formData.businessType,
            address: formData.address,
            city: formData.city,
            province: formData.province,
            postalCode: formData.postalCode,
            phone: formData.phone,
            businessHours: {
              monday: formData.monday,
              tuesday: formData.tuesday,
              wednesday: formData.wednesday,
              thursday: formData.thursday,
              friday: formData.friday,
              saturday: formData.saturday,
              sunday: formData.sunday,
            },
            onboardingCompleted: true,
            onboardingCompletedAt: new Date().toISOString(),
          },
        })
        .eq('id', profile.tenant_id);

      if (tenantError) {
        throw tenantError;
      }

      // Add initial products if any
      if (formData.productsToAdd.length > 0) {
        const products = formData.productsToAdd.map(product => ({
          tenant_id: profile.tenant_id,
          name: product.name,
          price: parseFloat(product.price),
          category: product.category || 'Other',
          in_stock: true,
        }));

        const { error: productsError } = await supabase
          .from('products')
          .insert(products);

        if (productsError) {
          console.error('Error adding products:', productsError);
        }
      }

      // Complete onboarding
      if (onComplete) {
        onComplete();
      } else {
        navigate('/owner/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      productsToAdd: [...prev.productsToAdd, { name: '', price: '', category: 'Beverage' }],
    }));
  };

  const updateProduct = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      productsToAdd: prev.productsToAdd.map((product, i) =>
        i === index ? { ...product, [field]: value } : product,
      ),
    }));
  };

  const removeProduct = (index) => {
    setFormData(prev => ({
      ...prev,
      productsToAdd: prev.productsToAdd.filter((_, i) => i !== index),
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="wizard-step">
            <h2>🏢 Tell us about your business</h2>
            <p className="step-description">
              Let&apos;s start with the basics. This information will be displayed on customer-facing pages.
            </p>

            <div className="form-group">
              <label>Business Name *</label>
              <input
                type="text"
                value={formData.tenantName}
                onChange={(e) => updateField('tenantName', e.target.value)}
                placeholder="e.g., The Rusty Nail Bar"
                required
              />
            </div>

            <div className="form-group">
              <label>Business Type</label>
              <select
                value={formData.businessType}
                onChange={(e) => updateField('businessType', e.target.value)}
              >
                <option value="bar">Bar</option>
                <option value="pub">Pub</option>
                <option value="restaurant">Restaurant & Bar</option>
                <option value="nightclub">Nightclub</option>
                <option value="lounge">Lounge</option>
              </select>
            </div>

            <div className="form-group">
              <label>Street Address *</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="123 Main Street"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="Johannesburg"
                  required
                />
              </div>

              <div className="form-group">
                <label>Province</label>
                <select
                  value={formData.province}
                  onChange={(e) => updateField('province', e.target.value)}
                >
                  <option value="">Select province</option>
                  <option value="Gauteng">Gauteng</option>
                  <option value="Western Cape">Western Cape</option>
                  <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                  <option value="Eastern Cape">Eastern Cape</option>
                  <option value="Free State">Free State</option>
                  <option value="Limpopo">Limpopo</option>
                  <option value="Mpumalanga">Mpumalanga</option>
                  <option value="Northern Cape">Northern Cape</option>
                  <option value="North West">North West</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Postal Code</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  placeholder="2000"
                />
              </div>

              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+27 11 123 4567"
                  required
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="wizard-step">
            <h2>🕒 Business Hours</h2>
            <p className="step-description">
              Set your operating hours. Customers will see these times when browsing your menu.
            </p>

            <div className="business-hours">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                <div key={day} className="hours-row">
                  <div className="day-name">
                    {day.charAt(0).toUpperCase() + day.slice(1)}
                  </div>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData[day].closed}
                      onChange={(e) => updateHours(day, 'closed', e.target.checked)}
                    />
                    <span>Closed</span>
                  </label>

                  {!formData[day].closed && (
                    <>
                      <input
                        type="time"
                        value={formData[day].open}
                        onChange={(e) => updateHours(day, 'open', e.target.value)}
                      />
                      <span className="time-separator">to</span>
                      <input
                        type="time"
                        value={formData[day].close}
                        onChange={(e) => updateHours(day, 'close', e.target.value)}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="wizard-step">
            <h2>🍺 Add Your Products</h2>
            <p className="step-description">
              Add some products to get started. You can always add more later from your dashboard.
            </p>

            <div className="products-list">
              {formData.productsToAdd.map((product, index) => (
                <div key={index} className="product-row">
                  <input
                    type="text"
                    placeholder="Product name"
                    value={product.name}
                    onChange={(e) => updateProduct(index, 'name', e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="Price (R)"
                    value={product.price}
                    onChange={(e) => updateProduct(index, 'price', e.target.value)}
                    min="0"
                    step="0.01"
                  />
                  <select
                    value={product.category}
                    onChange={(e) => updateProduct(index, 'category', e.target.value)}
                  >
                    <option value="Beverage">Beverage</option>
                    <option value="Beer">Beer</option>
                    <option value="Wine">Wine</option>
                    <option value="Spirits">Spirits</option>
                    <option value="Cocktail">Cocktail</option>
                    <option value="Food">Food</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Other">Other</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeProduct(index)}
                    className="btn-remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addProduct} className="btn-add-product">
              + Add Product
            </button>

            {formData.productsToAdd.length === 0 && (
              <p className="hint">You can skip this step and add products later.</p>
            )}
          </div>
        );

      case 4:
        return (
          <div className="wizard-step">
            <h2>✅ Review & Confirm</h2>
            <p className="step-description">
              Please review your information before completing setup.
            </p>

            <div className="review-section">
              <h3>Business Information</h3>
              <div className="review-item">
                <strong>Name:</strong> {formData.tenantName}
              </div>
              <div className="review-item">
                <strong>Type:</strong> {formData.businessType}
              </div>
              <div className="review-item">
                <strong>Address:</strong> {formData.address}, {formData.city}
                {formData.province && `, ${formData.province}`}
              </div>
              <div className="review-item">
                <strong>Phone:</strong> {formData.phone}
              </div>
            </div>

            <div className="review-section">
              <h3>Products</h3>
              {formData.productsToAdd.length > 0 ? (
                <ul>
                  {formData.productsToAdd.map((product, index) => (
                    <li key={index}>
                      {product.name} - R{product.price} ({product.category})
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No products added yet.</p>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="wizard-step wizard-complete">
            <div className="success-icon">🎉</div>
            <h2>All Set!</h2>
            <p className="step-description">
              Your bar is now set up and ready to go. You can start managing products, staff, and orders.
            </p>

            <div className="next-steps">
              <h3>Next Steps:</h3>
              <ul>
                <li>✅ Add more products to your menu</li>
                <li>✅ Invite staff members to join</li>
                <li>✅ Configure payment settings</li>
                <li>✅ Customize your customer-facing pages</li>
                <li>✅ Generate QR codes for table ordering</li>
              </ul>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-wizard">
      <div className="wizard-container">
        <div className="wizard-header">
          <h1>Welcome to Your Bar Management Platform</h1>
          <div className="progress-bar">
            <div className="progress-steps">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => (
                <div
                  key={step}
                  className={`progress-step ${step <= currentStep ? 'active' : ''} ${step < currentStep ? 'completed' : ''}`}
                >
                  <div className="step-number">{step}</div>
                  <div className="step-label">
                    {step === 1 && 'Business Info'}
                    {step === 2 && 'Hours'}
                    {step === 3 && 'Products'}
                    {step === 4 && 'Review'}
                    {step === 5 && 'Complete'}
                  </div>
                </div>
              ))}
            </div>
            <div className="progress-fill" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
          </div>
        </div>

        <div className="wizard-content">
          {renderStep()}
        </div>

        {error && (
          <div className="wizard-error">
            ⚠️ {error}
          </div>
        )}

        <div className="wizard-footer">
          {currentStep > 1 && currentStep < 5 && (
            <button
              type="button"
              onClick={handleBack}
              className="btn-secondary"
              disabled={loading}
            >
              ← Back
            </button>
          )}

          <div className="footer-spacer" />

          {currentStep < 5 && (
            <button
              type="button"
              onClick={handleNext}
              className="btn-primary"
              disabled={loading}
            >
              {currentStep === 4 ? 'Complete Setup' : 'Next →'}
            </button>
          )}

          {currentStep === 5 && (
            <button
              type="button"
              onClick={() => navigate('/owner/dashboard')}
              className="btn-primary"
            >
              Go to Dashboard →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

OnboardingWizard.propTypes = {
  onComplete: PropTypes.func,
};

export default OnboardingWizard;
