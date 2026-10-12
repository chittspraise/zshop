// Follow Deno edge runtime conventions
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
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ error: 'PAYSTACK_SECRET_KEY is not set in environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action = 'initialize', reference, totalAmount, amount, email, callback_url, currency, metadata } = body;

    // Action: Verify transaction
    if (action === 'verify') {
      const refToVerify = reference || body.trxref;
      if (!refToVerify) {
        return new Response(
          JSON.stringify({ error: 'Transaction reference is required for verification' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(refToVerify)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      });

      const verifyData = await verifyRes.json();
      return new Response(JSON.stringify(verifyData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action: Initialize transaction
    const finalAmount = totalAmount ?? amount;
    if (!finalAmount || !email) {
      return new Response(
        JSON.stringify({ error: 'Both email and amount (totalAmount) are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const initPayload: Record<string, any> = {
      email,
      amount: finalAmount,
      callback_url: callback_url || undefined,
      metadata: metadata || {},
    };

    const targetCurrency = currency || Deno.env.get('PAYSTACK_CURRENCY');
    if (targetCurrency) {
      initPayload.currency = targetCurrency;
    }

    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initPayload),
    });

    const initData = await initRes.json();

    if (!initData.status) {
      return new Response(
        JSON.stringify({ error: initData.message || 'Failed to initialize Paystack transaction' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = {
      authorization_url: initData.data.authorization_url,
      access_code: initData.data.access_code,
      reference: initData.data.reference,
      publicKey: Deno.env.get('PAYSTACK_PUBLIC_KEY') || Deno.env.get('EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY'),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
