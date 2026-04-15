// Deno type declarations for VS Code
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// @ts-ignore - Deno types
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno&no-check'
// @ts-ignore - Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=deno'
import { webhookRateLimiter, getClientIdentifier, createRateLimitResponse } from '../_shared/rateLimiter.ts'
import { trackWebhookFailure, trackPaymentFailure, trackDatabaseError } from '../_shared/monitoring.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

// Handler function
async function handleWebhook(req: Request): Promise<Response> {
  // Apply rate limiting (1000 requests per minute per IP for webhooks)
  const clientId = getClientIdentifier(req)
  const rateLimitResult = webhookRateLimiter.check(clientId)
  
  if (!rateLimitResult.allowed) {
    console.log('⚠️ Rate limit exceeded for webhook from:', clientId)
    return createRateLimitResponse(rateLimitResult, webhookRateLimiter, {})
  }
  
  console.log('✅ Webhook rate limit check passed:', clientId, 'remaining:', rateLimitResult.remaining)
  // Create clients inside the handler to avoid connection pooling and event loop issues
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })
  
  // Simple health check endpoint
  if (req.method === 'GET') {
    console.log('🏥 Health check received')
    return new Response(JSON.stringify({ 
      status: 'ok', 
      message: 'Stripe webhook endpoint is running',
      timestamp: new Date().toISOString(),
      env: {
        hasStripeKey: !!stripeSecretKey,
        hasWebhookSecret: !!webhookSecret,
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  console.log('🎣 Webhook received')
  console.log('📝 Request method:', req.method)
  console.log('📝 Request URL:', req.url)
  
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.error('❌ No signature in request')
    return new Response('No signature', { status: 400 })
  }

  if (!webhookSecret) {
    console.warn('⚠️ STRIPE_WEBHOOK_SECRET not configured - webhook validation will fail')
  }

  try {
    const body = await req.text()
    console.log('📦 Webhook body length:', body.length)
    
    // Verify webhook signature - use async version for Deno
    let event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
      console.log('✅ Webhook signature verified')
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message)
      
      // Track webhook signature failure
      await trackWebhookFailure(err, {
        eventType: 'signature_verification_failed',
        source: 'stripe',
        signatureValid: false,
        errorCode: 'SIGNATURE_VERIFICATION_FAILED',
      })
      
      throw new Error(`Webhook signature verification failed: ${err.message}`)
    }

    console.log('📧 Event type:', event.type)

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      console.log('💳 Session ID:', session.id)
      console.log('� Session mode:', session.mode)
      console.log('📋 Session metadata:', JSON.stringify(session.metadata))

      // Extract metadata
      const userId = session.metadata?.userId || session.metadata?.user_id
      const tenantId = session.metadata?.tenantId || session.metadata?.tenant_id
      const tier = session.metadata?.tier

      if (!userId || !tenantId) {
        console.error('❌ Missing userId or tenantId in metadata')
        
        // Track payment failure due to missing metadata
        await trackPaymentFailure(new Error('Missing required metadata fields'), {
          sessionId: session.id,
          errorCode: 'MISSING_METADATA',
          metadata: session.metadata,
        })
        
        throw new Error('Missing required metadata fields')
      }

      // Handle subscription upgrade/creation
      if (session.mode === 'subscription' && tier) {
        console.log('🎯 Processing subscription upgrade to tier:', tier)
        
        const { data: updateData, error: updateError } = await supabase
          .from('tenants')
          .update({
            subscription_tier: tier,
            subscription_status: 'active',
            stripe_subscription_id: session.subscription,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tenantId)
          .select()

        if (updateError) {
          console.error('❌ Error updating tenant subscription:', updateError)
          
          await trackDatabaseError(updateError, {
            operation: 'update',
            table: 'tenants',
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
            tenantId,
            tier,
          })
          
          throw updateError
        }

        console.log('✅ Tenant subscription updated:', updateData)
        console.log('🎉 Subscription upgrade complete - tenant now on:', tier)
        
        // For subscription mode, we don't need to create transactions or QR codes
        return new Response(JSON.stringify({ 
          received: true,
          subscription_updated: true,
          tier: tier 
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // Retrieve line items from the session instead of metadata
      // This avoids Stripe's 500-character metadata limit
      console.log('🔍 Fetching line items for session:', session.id)
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product']
      })
      
      console.log('🛒 Line items retrieved:', lineItems.data.length)

      if (!lineItems.data || lineItems.data.length === 0) {
        console.error('❌ No line items found in session')
        throw new Error('No line items found')
      }

      // Create transactions from line items
      const transactions = lineItems.data.flatMap((item: any) => {
        const productName = item.description || item.price?.product?.name || 'Unknown Product'
        const unitAmount = item.price?.unit_amount || 0
        const quantity = item.quantity || 1
        const unitPrice = unitAmount / 100

        // Determine transaction type from product name/description
        const isEvent = productName.toLowerCase().includes('event') ||
                       productName.toLowerCase().includes('entry')

        // Check if this is a ticket/entrance product that needs individual QR codes
        const isTicketProduct = productName.toLowerCase().includes('ticket') ||
                               productName.toLowerCase().includes('entrance')

        // For ticket/entrance products with quantity > 1, create separate transactions
        // For other products (drinks, food), create one transaction with quantity in metadata
        if (isTicketProduct && quantity > 1) {
          // Create individual transactions for each ticket
          return Array.from({ length: quantity }, (_, index) => ({
            user_id: userId,
            tenant_id: tenantId,
            amount: unitPrice, // Individual ticket price
            status: 'confirmed',
            stripe_session_id: session.id,
            stripe_payment_intent: session.payment_intent,
            type: isEvent ? 'event_entry' : 'product_purchase',
            metadata: {
              product_name: productName,
              product_type: 'entrance_fee',
              quantity: 1, // Each ticket is quantity 1
              ticket_number: index + 1,
              total_tickets: quantity,
              unit_price: unitPrice,
              stripe_price_id: item.price?.id,
            },
          }))
        } else {
          // For non-ticket products or single tickets, create one transaction
          const totalAmount = unitPrice * quantity
          return [{
            user_id: userId,
            tenant_id: tenantId,
            amount: totalAmount,
            status: 'confirmed',
            stripe_session_id: session.id,
            stripe_payment_intent: session.payment_intent,
            type: isEvent ? 'event_entry' : 'product_purchase',
            metadata: {
              product_name: productName,
              product_type: isTicketProduct ? 'entrance_fee' : 'product',
              quantity: quantity,
              unit_price: unitPrice,
              stripe_price_id: item.price?.id,
            },
          }]
        }
      })

      console.log('💾 Inserting transactions...', transactions.length)

      // Insert transactions
      const { data: createdTransactions, error } = await supabase
        .from('transactions')
        .insert(transactions)
        .select()

      if (error) {
        console.error('❌ Error creating transactions:', error)
        
        // Track database error
        await trackDatabaseError(error, {
          operation: 'insert',
          table: 'transactions',
          code: error.code,
          details: error.details,
          hint: error.hint,
          tenantId,
          userId,
        })
        
        throw error
      }

      console.log('✅ Transactions created:', createdTransactions.length)

      // Create QR codes for each transaction
      if (createdTransactions && createdTransactions.length > 0) {
        console.log('🎫 Preparing to create QR codes for transactions:', createdTransactions.length)
        console.log('📝 User ID for QR codes:', userId)
        console.log('📝 Transaction IDs:', createdTransactions.map((t: any) => t.id))
        
        // Generate unique QR codes with timestamp and random component
        // Add index to ensure uniqueness even for simultaneous generation
        const qrCodes = createdTransactions.map((transaction: any, index: number) => {
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 15)
          const uniqueId = `${timestamp}_${index}_${random}`
          return {
            transaction_id: transaction.id,
            user_id: userId,
            code: `${transaction.tenant_id}_${userId}_${transaction.id}_${uniqueId}`
          }
        })

        console.log('🎫 QR codes to insert:', JSON.stringify(qrCodes, null, 2))

        const { data: insertedQRCodes, error: qrError } = await supabase
          .from('qr_codes')
          .insert(qrCodes)
          .select()

        if (qrError) {
          console.error('❌ Error creating QR codes:', JSON.stringify(qrError, null, 2))
          console.error('❌ Error code:', qrError.code)
          console.error('❌ Error message:', qrError.message)
          console.error('❌ Error details:', qrError.details)
          console.error('❌ Error hint:', qrError.hint)
          
          // Track QR code creation error
          await trackDatabaseError(qrError, {
            operation: 'insert',
            table: 'qr_codes',
            code: qrError.code,
            details: qrError.details,
            hint: qrError.hint,
            transactionIds: createdTransactions.map((t: any) => t.id),
          })
          
          // Attempt to insert QR codes one by one to identify which one is failing
          if (qrCodes.length > 1) {
            console.log('🔄 Attempting to insert QR codes individually...')
            for (const qrCode of qrCodes) {
              const { data: individualQR, error: individualError } = await supabase
                .from('qr_codes')
                .insert([qrCode])
                .select()
              
              if (individualError) {
                console.error(`❌ Failed to insert QR for transaction ${qrCode.transaction_id}:`, individualError.message)
              } else {
                console.log(`✅ Successfully inserted QR for transaction ${qrCode.transaction_id}`)
              }
            }
          }
        } else {
          console.log('✅ QR codes created successfully:', insertedQRCodes?.length || 0)
          console.log('✅ QR code IDs:', insertedQRCodes?.map((qr: any) => qr.id))
        }
      } else {
        console.warn('⚠️ No transactions created - skipping QR code generation')
      }

      // Clear user's cart after successful payment
      console.log('🗑️ Clearing cart for user:', userId)
      const { error: cartError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)

      if (cartError) {
        console.error('❌ Error clearing cart:', cartError)
    
    // Track general webhook failure
    await trackWebhookFailure(error, {
      eventType: 'webhook_processing_failed',
      source: 'stripe',
      errorCode: error.code || 'UNKNOWN',
      errorMessage: error.message,
    })
    
      } else {
        console.log('✅ Cart cleared for user:', userId)
      }

      console.log('🎉 Payment processed successfully for session:', session.id)
    } else {
      console.log('ℹ️ Ignoring event type:', event.type)
      if (event.type === 'payment_intent.succeeded') {
        console.warn('⚠️ WARNING: Received payment_intent.succeeded')
        console.warn('⚠️ QR codes require checkout.session.completed event')
        console.warn('⚠️ Configure webhook to listen to: checkout.session.completed')
        console.warn('⚠️ Stripe Dashboard > Developers > Webhooks > Add Events')
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('💥 Webhook error:', error.message)
    console.error('Stack:', error.stack)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
}

// Start the server
Deno.serve(handleWebhook)
