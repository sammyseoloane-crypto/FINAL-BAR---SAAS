// Supabase Edge Function: process-no-shows
// Automatically marks table reservations as no-show after grace period expires
// Deploy: supabase functions deploy process-no-shows
// Schedule: Call this every 5 minutes via cron or GitHub Actions

// Deno type declarations for VS Code
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

// @ts-ignore - Deno types
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Supabase environment variables' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the database function to process no-shows
    const { data, error } = await supabase.rpc('process_reservation_status_updates');

    if (error) {
      console.error('Error processing no-shows:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('No-show processing complete:', data);

    return new Response(
      JSON.stringify({ 
        success: true,
        result: data,
        message: `Processed at ${new Date().toISOString()}`
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
