// Deno edge function for Stripe checkout - handles both subscription and cart checkouts
// @ts-ignore
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=deno'

// Deno type declarations for local TypeScript
declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void
  env: {
    get(key: string): string | undefined
  }
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

  try {
    console.log('🚀 Create checkout called')
    console.log('📝 Request method:', req.method)
    console.log('📝 Request URL:', req.url)
    
    // Get auth header - check both Authorization and apikey
    const authHeader = req.headers.get('Authorization') || req.headers.get('apikey')
    console.log('🔑 Auth header present:', !!authHeader)
    console.log('🔑 Auth header value:', authHeader ? `${authHeader.substring(0, 20)}...` : 'NONE')
    console.log('🔑 All headers:', Object.fromEntries(req.headers.entries()))
    
    // Initialize Stripe inside the request handler
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
    console.log('🔑 Stripe key loaded:', stripeKey ? `${stripeKey.substring(0, 12)}...` : 'MISSING!')
    
    if (!stripeKey) {
      console.error('❌ Stripe key not configured')
      return new Response(
        JSON.stringify({ error: 'Stripe is not configured. Required: STRIPE_SECRET_KEY' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })
    
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
    
    // Create Supabase client - use anon key with the auth header for proper JWT validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    
    console.log('🔍 Environment check:')
    console.log('  SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING')
    console.log('  SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING')
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing required environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing environment variables' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
    
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )
    
    // Get the authenticated user - use the token directly
    console.log('🔍 Getting user...')
    console.log('🔍 Token length:', authHeader.replace('Bearer ', '').length)
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    console.log('🔍 Auth result:')
    console.log('  User:', user ? user.email : 'null')
    console.log('  Error:', userError ? JSON.stringify(userError) : 'null')

    if (userError) {
      console.error('❌ Error getting user:', userError.message)
      console.error('❌ User error status:', userError.status)
      console.error('❌ User error name:', userError.name)
      console.error('❌ User error details:', JSON.stringify(userError, null, 2))
      console.error('❌ Token used:', token.substring(0, 50) + '...')
      return new Response(
        JSON.stringify({ 
          code: 401,
          message: 'Authentication failed',
          error: userError.message,
          status: userError.status,
          name: userError.name,
          hint: 'Check that you are logged in and the token is valid',
          details: userError
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    if (!user) {
      console.error('❌ No user found')
      return new Response(
        JSON.stringify({ 
          code: 401,
          message: 'No user found',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }

    console.log('✅ User found:', user.email)
    
    // Create admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user's tenant from profile to ensure proper isolation
    console.log('🔍 Querying profile for user:', user.id)
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('❌ Error querying profile:', profileError)
      return new Response(
        JSON.stringify({ error: `Profile error: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!userProfile || !userProfile.tenant_id) {
      console.error('❌ No tenant found for user')
      return new Response(
        JSON.stringify({ error: 'No tenant found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Found tenant:', userProfile.tenant_id)
    console.log('✅ User role:', userProfile.role)

    const payload = await req.json()
    const { priceId, tier, cartItems, totalAmount, userId, tenantId } = payload
    
    // SECURITY: Enforce tenant isolation - reject if payload tenant doesn't match user's tenant
    if (tenantId && tenantId !== userProfile.tenant_id) {
      console.error('❌ Tenant mismatch - user tenant:', userProfile.tenant_id, 'payload tenant:', tenantId)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Tenant mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // SECURITY: Ensure userId matches authenticated user
    if (userId && userId !== user.id) {
      console.error('❌ User ID mismatch - authenticated:', user.id, 'payload:', userId)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User ID mismatch' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Determine checkout type: subscription or cart
    const isSubscription = !!priceId
    const isCart = !!cartItems
    
    console.log('💰 Checkout type:', isSubscription ? 'Subscription' : 'Cart')
    console.log('💰 Payload:', isSubscription ? { priceId, tier } : { cartItems: cartItems?.length, totalAmount })

    // Validate required fields based on checkout type
    if (isSubscription && !priceId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: priceId for subscription checkout' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (isCart && (!cartItems || cartItems.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Cart is empty. Please add items before checkout.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // SECURITY: For cart checkout, validate that all items belong to user's tenant
    if (isCart && cartItems && cartItems.length > 0) {
      const itemsWithWrongTenant = cartItems.filter((item: any) => 
        item.tenant_id && item.tenant_id !== userProfile.tenant_id
      )
      
      if (itemsWithWrongTenant.length > 0) {
        console.error('❌ Cart contains items from other tenants:', itemsWithWrongTenant)
        return new Response(
          JSON.stringify({ error: 'Cart contains unauthorized items' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('✅ All cart items validated for tenant:', userProfile.tenant_id)
    }

    // For subscription checkout, check/create customer in subscriptions table
    let customerId: string | undefined

    if (isSubscription) {
      // Check if customer already exists
      const { data: existingSubscription } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('tenant_id', userProfile.tenant_id)
        .single()

      customerId = existingSubscription?.stripe_customer_id

      // Create customer if doesn't exist
      if (!customerId) {
        console.log('🆕 Creating new Stripe customer...')
        try {
          const customer = await stripe.customers.create({
            email: user.email,
            metadata: {
              user_id: user.id,
              tenant_id: userProfile.tenant_id,
            },
          })
          customerId = customer.id
          console.log('✅ Stripe customer created:', customerId)

          // Update subscription with customer ID
          await supabaseAdmin
            .from('subscriptions')
            .update({ stripe_customer_id: customerId })
            .eq('tenant_id', userProfile.tenant_id)
          
          console.log('✅ Updated subscription with customer ID')
        } catch (stripeError) {
          console.error('❌ Stripe API error:', stripeError)
          const errorMessage = stripeError instanceof Error ? stripeError.message : 'Failed to create Stripe customer'
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } else {
        console.log('✅ Using existing Stripe customer:', customerId)
      }
    }

    // Create checkout session
    console.log('🛒 Creating Stripe checkout session...')
    try {
      let sessionConfig: any
      
      if (isSubscription) {
        // Subscription checkout
        sessionConfig = {
          customer: customerId,
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          mode: 'subscription',
          success_url: `${req.headers.get('origin')}/dashboard?success=true`,
          cancel_url: `${req.headers.get('origin')}/pricing?canceled=true`,
          metadata: {
            user_id: user.id,
            tenant_id: userProfile.tenant_id,
            tier: tier,
          },
        }
      } else {
        // Cart checkout
        const lineItems = cartItems.map((item: any) => ({
          price_data: {
            currency: 'zar', // South African Rand
            product_data: {
              name: item.name,
              description: item.type === 'event' 
                ? `Event Entry - ${item.date ? new Date(item.date).toLocaleDateString() : ''}` 
                : `${item.productType || 'Product'}`,
            },
            unit_amount: Math.round(item.price * 100), // Convert to cents
          },
          quantity: item.quantity,
        }))
        
        // Create a minimal metadata object (Stripe limit: 500 chars per value)
        // Store full cart data in database instead
        const cartSummary = cartItems.map((item: any) => ({
          id: item.id,
          qty: item.quantity,
          price: item.price
        }))
        
        sessionConfig = {
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: `${req.headers.get('origin')}/customer/orders?session_id={CHECKOUT_SESSION_ID}&success=true`,
          cancel_url: `${req.headers.get('origin')}/customer/orders?canceled=true`,
          metadata: {
            userId: user.id,
            tenantId: userProfile.tenant_id,
            userRole: userProfile.role,
            itemCount: cartItems.length.toString(),
            totalAmount: totalAmount?.toString() || '0',
          },
        }
      }
      
      const session = await stripe.checkout.sessions.create(sessionConfig)
      
      console.log('✅ Checkout session created:', session.id)
      console.log('   Type:', isSubscription ? 'Subscription' : 'Cart')
      console.log('   Amount:', isSubscription ? `Tier: ${tier}` : `R${(totalAmount || 0).toFixed(2)}`)

      return new Response(
        JSON.stringify({ 
          url: session.url,
          sessionId: session.id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } catch (stripeError) {
      console.error('❌ Stripe checkout error:', stripeError)
      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Stripe error'
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }
  } catch (error) {
    console.error('❌ Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
