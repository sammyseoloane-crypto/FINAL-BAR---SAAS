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

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

// Handler function
async function handleWebhook(req: Request): Promise<Response> {
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
      throw new Error(`Webhook signature verification failed: ${err.message}`)
    }

    console.log('📧 Event type:', event.type)

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      console.log('💳 Session ID:', session.id)
      console.log('📋 Session metadata:', JSON.stringify(session.metadata))

      // Extract metadata
      const userId = session.metadata?.userId
      const tenantId = session.metadata?.tenantId
      const cartDataStr = session.metadata?.cartData

      if (!userId || !tenantId) {
        console.error('❌ Missing userId or tenantId in metadata')
        throw new Error('Missing required metadata fields')
      }

      if (!cartDataStr) {
        console.error('❌ No cart data in metadata')
        throw new Error('No cart data found')
      }

      const cartData = JSON.parse(cartDataStr)
      console.log('🛒 Cart items:', cartData.length)

      // Create transactions in database
      const transactions = cartData.map((item: any) => {
        const baseTransaction = {
          user_id: userId,
          tenant_id: tenantId,
          amount: item.price * item.quantity,
          status: 'confirmed', // Mark as confirmed since payment succeeded
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        }

        if (item.type === 'event') {
          return {
            ...baseTransaction,
            type: 'event_entry',
            metadata: {
              event_id: item.id,
              event_name: item.name,
              event_date: item.date,
              quantity: item.quantity,
            },
          }
        } else {
          return {
            ...baseTransaction,
            product_id: item.id,
            type: 'product_purchase',
            metadata: {
              product_name: item.name,
              product_type: item.productType,
              quantity: item.quantity,
            },
          }
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
        throw error
      }

      console.log('✅ Transactions created:', createdTransactions.length)

      // Create QR codes for each transaction
      if (createdTransactions && createdTransactions.length > 0) {
        console.log('🎫 Preparing to create QR codes for transactions:', createdTransactions.length)
        console.log('📝 User ID for QR codes:', userId)
        console.log('📝 Transaction IDs:', createdTransactions.map((t: any) => t.id))
        
        // Generate unique QR codes with timestamp and random component
        const qrCodes = createdTransactions.map((transaction: any) => {
          const timestamp = Date.now()
          const random = Math.random().toString(36).substring(2, 15)
          return {
            transaction_id: transaction.id,
            user_id: userId,
            code: `${transaction.tenant_id}_${userId}_${transaction.id}_${timestamp}_${random}`
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
