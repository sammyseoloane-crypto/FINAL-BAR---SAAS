// Supabase Edge Function for handling data deletion requests (POPIA/GDPR compliance)
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=deno'
import { apiRateLimiter, getClientIdentifier, createRateLimitResponse } from '../_shared/rateLimiter.ts'

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Apply rate limiting (100 requests per minute per IP)
  const clientId = getClientIdentifier(req)
  const rateLimitResult = apiRateLimiter.check(clientId)
  
  if (!rateLimitResult.allowed) {
    console.log('⚠️ Rate limit exceeded for client:', clientId)
    return createRateLimitResponse(rateLimitResult, apiRateLimiter, corsHeaders)
  }

  try {
    console.log('🗑️ Data deletion request received')
    console.log('📝 Request method:', req.method)

    // Get auth header
    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey')
    
    if (!authHeader) {
      console.error('❌ No Authorization header')
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get authenticated user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('❌ Authentication failed:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    console.log('✅ User authenticated:', user.email)

    const payload = await req.json()
    const { requestType, reason } = payload

    // Log the deletion request for audit purposes
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert([{
        user_id: user.id,
        action: 'data_deletion_request',
        details: {
          request_type: requestType,
          reason: reason,
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      }])

    if (logError) {
      console.warn('⚠️ Failed to log deletion request:', logError.message)
    }

    // Process deletion based on request type
    if (requestType === 'immediate') {
      // Immediate deletion (user wants data deleted now)
      console.log('🗑️ Processing immediate deletion for user:', user.id)

      // Delete user's data in order (respect foreign key constraints)
      const tables = [
        'qr_codes',
        'transactions',
        'customer_loyalty',
        'reward_redemptions',
        'task_comments',
        'task_history',
        'tasks',
        'offline_queue',
        'device_sync_status',
        'audit_logs',
        'login_history',
        'password_reset_tokens',
        'two_factor_settings',
        'profiles',
      ]

      const deletionResults = []
      
      for (const table of tables) {
        try {
          const { error: deleteError, count } = await supabase
            .from(table)
            .delete()
            .eq('user_id', user.id)

          if (deleteError) {
            console.error(`❌ Error deleting from ${table}:`, deleteError.message)
            deletionResults.push({ table, success: false, error: deleteError.message })
          } else {
            console.log(`✅ Deleted from ${table}: ${count || 0} records`)
            deletionResults.push({ table, success: true, count: count || 0 })
          }
        } catch (error: any) {
          console.error(`❌ Exception deleting from ${table}:`, error.message)
          deletionResults.push({ table, success: false, error: error.message })
        }
      }

      // Delete user account from auth
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id)

      if (authDeleteError) {
        console.error('❌ Failed to delete user from auth:', authDeleteError.message)
        return new Response(
          JSON.stringify({
            error: 'Failed to delete user account',
            details: authDeleteError.message,
            deletionResults,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      console.log('✅ User account deleted successfully')

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Your data and account have been permanently deleted',
          deletionResults,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else if (requestType === 'scheduled') {
      // Scheduled deletion (30-day grace period)
      console.log('📅 Scheduling deletion for user:', user.id)

      // Mark user for deletion (you could add a deletion_scheduled_at field to profiles)
      const deletionDate = new Date()
      deletionDate.setDate(deletionDate.getDate() + 30) // 30 days from now

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          deletion_scheduled_at: deletionDate.toISOString(),
          account_status: 'pending_deletion',
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('❌ Failed to schedule deletion:', updateError.message)
        return new Response(
          JSON.stringify({ error: 'Failed to schedule deletion' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Your account is scheduled for deletion on ${deletionDate.toLocaleDateString()}. You can cancel this request before then by logging in.`,
          deletionDate: deletionDate.toISOString(),
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid request type. Must be "immediate" or "scheduled"' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }
  } catch (error: any) {
    console.error('❌ Error processing deletion request:', error.message)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
