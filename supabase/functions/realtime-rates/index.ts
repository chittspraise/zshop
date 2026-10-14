import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch real-time exchange rates from live API
    let liveRates: Record<string, number> = {};
    let fetchSuccess = false;

    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', {
        headers: { 'Accept': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          liveRates = data.rates;
          fetchSuccess = true;

          // Save / update real-time rates in Supabase exchange_rates table
          const upsertRows = [
            'USD', 'GBP', 'EUR', 'ZAR', 'NGN', 'GHS', 'KES'
          ].map((currency) => ({
            currency,
            rate: liveRates[currency] ?? 1.0,
            base_currency: 'USD',
            updated_at: new Date().toISOString(),
          }));

          await supabase.from('exchange_rates').upsert(upsertRows, { onConflict: 'currency' });
        }
      }
    } catch (err) {
      console.warn('Real-time rates fetch failed, fetching from Supabase table:', err);
    }

    // 2. If live fetch failed, retrieve latest real-time rates stored in Supabase table
    if (!fetchSuccess) {
      const { data: dbRates, error: dbErr } = await supabase
        .from('exchange_rates')
        .select('currency, rate, updated_at');

      if (!dbErr && dbRates && dbRates.length > 0) {
        for (const row of dbRates) {
          liveRates[row.currency] = Number(row.rate);
        }
      }
    }

    // Extract core supported rates
    const supportedCurrencies = ['USD', 'GBP', 'EUR', 'ZAR', 'NGN', 'GHS', 'KES'];
    const ratesResult: Record<string, number> = {};
    for (const c of supportedCurrencies) {
      if (liveRates[c] !== undefined) {
        ratesResult[c] = Number(liveRates[c]);
      }
    }

    return new Response(
      JSON.stringify({
        status: true,
        base: 'USD',
        rates: ratesResult,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to fetch real-time exchange rates' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
