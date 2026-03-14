/**
 * Validation Utilities
 * Centralized validation functions for forms and data
 */

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { isValid, message }
 */
export const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return {
      isValid: false,
      message: 'Password must be at least 6 characters long',
    };
  }

  if (password.length < 8) {
    return {
      isValid: true,
      message: 'Password is weak. Consider using at least 8 characters',
    };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const strength = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (strength >= 3) {
    return {
      isValid: true,
      message: 'Password is strong',
    };
  }

  return {
    isValid: true,
    message: 'Password is moderate. Consider adding uppercase, numbers, or special characters',
  };
};

/**
 * Validate phone number (South African format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
export const isValidPhone = (phone) => {
  // Accepts formats: 0821234567, +27821234567, 082 123 4567
  const phoneRegex = /^(\+27|0)[6-8][0-9]{8}$/;
  const cleanPhone = phone.replace(/\s/g, '');
  return phoneRegex.test(cleanPhone);
};

/**
 * Validate price/amount
 * @param {number|string} amount - Amount to validate
 * @returns {object} { isValid, message }
 */
export const validateAmount = (amount) => {
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount)) {
    return {
      isValid: false,
      message: 'Amount must be a valid number',
    };
  }

  if (numAmount < 0) {
    return {
      isValid: false,
      message: 'Amount cannot be negative',
    };
  }

  if (numAmount > 1000000) {
    return {
      isValid: false,
      message: 'Amount exceeds maximum allowed (R1,000,000)',
    };
  }

  return {
    isValid: true,
    message: 'Valid amount',
  };
};

/**
 * Validate date is not in the past
 * @param {string} dateString - Date string to validate
 * @returns {object} { isValid, message }
 */
export const validateFutureDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();

  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      message: 'Invalid date format',
    };
  }

  if (date < now) {
    return {
      isValid: false,
      message: 'Date cannot be in the past',
    };
  }

  return {
    isValid: true,
    message: 'Valid date',
  };
};

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @param {string} fieldName - Name of the field for error message
 * @returns {object} { isValid, message }
 */
export const validateRequired = (value, fieldName = 'This field') => {
  if (value === null || value === undefined || value === '') {
    return {
      isValid: false,
      message: `${fieldName} is required`,
    };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return {
      isValid: false,
      message: `${fieldName} cannot be empty`,
    };
  }

  return {
    isValid: true,
    message: 'Valid',
  };
};

/**
 * Validate tenant ID format
 * @param {string} tenantId - Tenant ID to validate
 * @returns {boolean} True if valid UUID format
 */
export const isValidUUID = (tenantId) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(tenantId);
};

/**
 * Validate form data with multiple rules
 * @param {object} formData - Form data to validate
 * @param {object} rules - Validation rules { fieldName: [rule1, rule2] }
 * @returns {object} { isValid, errors }
 */
export const validateForm = (formData, rules) => {
  const errors = {};
  let isValid = true;

  Object.keys(rules).forEach((field) => {
    const fieldRules = rules[field];
    const value = formData[field];

    fieldRules.forEach((rule) => {
      const result = rule(value, field);
      if (!result.isValid) {
        errors[field] = result.message;
        isValid = false;
      }
    });
  });

  return { isValid, errors };
};

/**
 * Format currency for display (South African Rand)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
  }).format(amount);
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format datetime for display
 * @param {string|Date} datetime - Datetime to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (datetime) => {
  return new Date(datetime).toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Sanitize input to prevent XSS
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};
