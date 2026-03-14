// Deno type declarations for VS Code
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=deno'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface ValidateRequest {
  qr_code: string
  location_id?: string
}

interface ScanResult {
  is_valid: boolean
  status: 'success' | 'invalid' | 'already_used' | 'expired' | 'unauthorized'
  message: string
  transaction?: {
    id: string
    amount: number
    user_email: string
    product_name?: string
    event_name?: string
    created_at: string
  }
  scan_details?: {
    scanned_at?: string
    scanned_by?: string
    scan_count: number
  }
  fraud_detected?: boolean
}

async function handleValidation(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        message: 'QR validation endpoint is running',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing Authorization header',
          status: 'unauthorized'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Create Supabase client with user's token for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    })

    // Verify user is authenticated and has staff/admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError)
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed',
          status: 'unauthorized'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401 
        }
      )
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('❌ Profile lookup failed:', profileError)
      return new Response(
        JSON.stringify({ 
          error: 'User profile not found',
          status: 'unauthorized'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    // Only staff, admin, and owner can validate QR codes
    if (!['staff', 'admin', 'owner'].includes(profile.role)) {
      console.warn('⚠️ Unauthorized role attempting QR validation:', profile.role)
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions. Staff access required.',
          status: 'unauthorized'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      )
    }

    // Parse request body
    const body: ValidateRequest = await req.json()
    
    if (!body.qr_code) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing qr_code parameter',
          status: 'invalid'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('🔍 Validating QR code:', body.qr_code.substring(0, 20) + '...')

    // Get client IP address from request
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Call the validate_qr_code function
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_qr_code', {
        p_qr_code: body.qr_code,
        p_scanned_by: user.id,
        p_location_id: body.location_id || null,
        p_ip_address: clientIP,
        p_user_agent: userAgent
      })

    if (validationError) {
      console.error('❌ Validation error:', validationError)
      return new Response(
        JSON.stringify({ 
          error: validationError.message,
          status: 'invalid'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    if (!validationResult || validationResult.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'QR code not found',
          status: 'invalid',
          is_valid: false
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      )
    }

    const result = validationResult[0]
    console.log('✅ Validation result:', result.status)

    // If validation successful, fetch transaction details
    let transactionDetails = null
    if (result.is_valid && result.transaction_id) {
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select(`
          id,
          amount,
          created_at,
          type,
          users:user_id (
            email
          ),
          products:product_id (
            name
          ),
          events:event_id (
            name
          )
        `)
        .eq('id', result.transaction_id)
        .single()

      if (!txError && transaction) {
        transactionDetails = {
          id: transaction.id,
          amount: transaction.amount,
          user_email: transaction.users?.email || 'Unknown',
          product_name: transaction.products?.name,
          event_name: transaction.events?.name,
          created_at: transaction.created_at
        }
      }
    }

    // Build response
    const response: ScanResult = {
      is_valid: result.is_valid,
      status: result.status,
      message: result.message,
      fraud_detected: result.fraud_detected
    }

    if (transactionDetails) {
      response.transaction = transactionDetails
    }

    // Add scan details for debugging
    if (result.qr_code_id) {
      const { data: qrCode } = await supabase
        .from('qr_codes')
        .select('scanned_at, used_by, scan_count')
        .eq('id', result.qr_code_id)
        .single()

      if (qrCode) {
        response.scan_details = {
          scanned_at: qrCode.scanned_at,
          scanned_by: qrCode.used_by,
          scan_count: qrCode.scan_count || 0
        }
      }
    }

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.is_valid ? 200 : 400
      }
    )

  } catch (error: any) {
    console.error('💥 Error in QR validation:', error.message)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        status: 'error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}

// Start the server
Deno.serve(handleValidation)
