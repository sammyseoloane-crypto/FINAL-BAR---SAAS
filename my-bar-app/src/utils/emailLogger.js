import { supabase } from '../supabaseClient'

/**
 * Email Logger Utility
 * Tracks all emails sent from the application
 */

/**
 * Log an email that was sent
 * @param {Object} emailData - Email log data
 * @param {string} emailData.emailTo - Recipient email address
 * @param {string} emailData.emailType - Type of email (signup_verification, password_reset, etc.)
 * @param {string} emailData.subject - Email subject line
 * @param {string} emailData.userId - User ID (optional, may not exist yet for signup)
 * @param {string} emailData.tenantId - Tenant ID (optional)
 * @param {string} emailData.status - Email status (default: 'sent')
 * @param {Object} emailData.metadata - Additional metadata
 * @returns {Promise<Object>} Result with data or error
 */
export const logEmail = async ({
  emailTo,
  emailType,
  subject = null,
  userId = null,
  tenantId = null,
  status = 'sent',
  metadata = {}
}) => {
  try {
    const logData = {
      email_to: emailTo,
      email_type: emailType,
      subject: subject,
      user_id: userId,
      tenant_id: tenantId,
      status: status,
      metadata: metadata,
      sent_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('email_logs')
      .insert([logData])
      .select()
      .single()

    if (error) {
      console.error('Error logging email:', error)
      return { data: null, error }
    }

    console.log(`✉️ Email logged: ${emailType} to ${emailTo}`)
    return { data, error: null }
  } catch (error) {
    console.error('Exception logging email:', error)
    return { data: null, error }
  }
}

/**
 * Log a signup verification email
 * @param {string} email - User email
 * @param {string} userId - User ID (from auth)
 * @param {string} tenantId - Tenant ID (optional for owners creating new tenant)
 * @param {string} role - User role
 */
export const logSignupVerificationEmail = async (email, userId, tenantId, role) => {
  return await logEmail({
    emailTo: email,
    emailType: 'signup_verification',
    subject: 'Verify your email - Bar SaaS',
    userId: userId,
    tenantId: tenantId,
    metadata: {
      role: role,
      signup_date: new Date().toISOString()
    }
  })
}

/**
 * Log a password reset email
 * @param {string} email - User email
 * @param {string} userId - User ID (optional)
 * @param {string} tenantId - Tenant ID (optional)
 */
export const logPasswordResetEmail = async (email, userId = null, tenantId = null) => {
  return await logEmail({
    emailTo: email,
    emailType: 'password_reset',
    subject: 'Reset your password - Bar SaaS',
    userId: userId,
    tenantId: tenantId,
    metadata: {
      reset_requested_at: new Date().toISOString()
    }
  })
}

/**
 * Log a staff invitation email
 * @param {string} email - Staff email
 * @param {string} tenantId - Tenant ID
 * @param {string} invitedBy - User ID of who sent the invitation
 */
export const logStaffInvitationEmail = async (email, tenantId, invitedBy) => {
  return await logEmail({
    emailTo: email,
    emailType: 'staff_invitation',
    subject: 'You\'re invited to join Bar SaaS',
    tenantId: tenantId,
    metadata: {
      invited_by: invitedBy,
      invitation_date: new Date().toISOString()
    }
  })
}

/**
 * Get email logs for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Email logs
 */
export const getUserEmailLogs = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching user email logs:', error)
    return { data: null, error }
  }
}

/**
 * Get email logs for a tenant
 * @param {string} tenantId - Tenant ID
 * @param {number} limit - Number of records to fetch (default: 50)
 * @returns {Promise<Object>} Email logs
 */
export const getTenantEmailLogs = async (tenantId, limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching tenant email logs:', error)
    return { data: null, error }
  }
}

/**
 * Get email statistics
 * @param {string} tenantId - Tenant ID (optional)
 * @param {string} emailType - Email type filter (optional)
 * @returns {Promise<Object>} Email statistics
 */
export const getEmailStatistics = async (tenantId = null, emailType = null) => {
  try {
    let query = supabase
      .from('email_logs')
      .select('email_type, status, sent_at')

    if (tenantId) {
      query = query.eq('tenant_id', tenantId)
    }

    if (emailType) {
      query = query.eq('email_type', emailType)
    }

    const { data, error } = await query

    if (error) throw error

    // Calculate statistics
    const stats = {
      total: data.length,
      by_type: {},
      by_status: {},
      recent_count: data.filter(log => {
        const logDate = new Date(log.sent_at)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        return logDate > dayAgo
      }).length
    }

    // Count by type
    data.forEach(log => {
      stats.by_type[log.email_type] = (stats.by_type[log.email_type] || 0) + 1
      stats.by_status[log.status] = (stats.by_status[log.status] || 0) + 1
    })

    return { data: stats, error: null }
  } catch (error) {
    console.error('Error fetching email statistics:', error)
    return { data: null, error }
  }
}

/**
 * Update email status (for tracking delivery, opens, etc.)
 * @param {string} emailLogId - Email log ID
 * @param {string} status - New status
 * @param {string} errorMessage - Error message (optional)
 */
export const updateEmailStatus = async (emailLogId, status, errorMessage = null) => {
  try {
    const updateData = {
      status: status
    }

    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    const { data, error } = await supabase
      .from('email_logs')
      .update(updateData)
      .eq('id', emailLogId)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating email status:', error)
    return { data: null, error }
  }
}
