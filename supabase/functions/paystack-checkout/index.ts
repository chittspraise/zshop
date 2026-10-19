import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

async function getRealtimeExchangeRates(supabase: any): Promise<Record<string, number>> {
  let rates: Record<string, number> = { USD: 1.0 };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.rates) {
        rates = data.rates;

        const upsertRows = ['USD', 'GBP', 'EUR', 'ZAR', 'NGN', 'GHS', 'KES'].map(curr => ({
          currency: curr,
          rate: Number(rates[curr]) || 1.0,
          base_currency: 'USD',
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('exchange_rates').upsert(upsertRows, { onConflict: 'currency' });
        return rates;
      }
    }
  } catch (err) {
    console.warn('Live rates fetch error, checking Supabase exchange_rates table:', err);
  }

  try {
    const { data: dbRates, error } = await supabase
      .from('exchange_rates')
      .select('currency, rate');

    if (!error && dbRates && dbRates.length > 0) {
      for (const row of dbRates) {
        rates[row.currency] = Number(row.rate);
      }
    }
  } catch (dbErr) {
    console.error('Error querying exchange_rates table in Supabase:', dbErr);
  }

  return rates;
}

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const {
      action = 'initialize',
      reference,
      totalAmount,
      amount,
      amountUSD,
      totalAmountUSD,
      email,
      callback_url,
      currency,
      user_id,
      authorization_code,
      save_card = true,
      metadata = {},
    } = body;

    // Action 1: Real-time Rates
    if (action === 'rates') {
      const rates = await getRealtimeExchangeRates(supabase);
      const supportedCurrencies = ['USD', 'GBP', 'EUR', 'ZAR', 'NGN', 'GHS', 'KES'];
      const filteredRates: Record<string, number> = {};
      for (const c of supportedCurrencies) {
        if (rates[c] !== undefined) filteredRates[c] = Number(rates[c]);
      }

      return new Response(
        JSON.stringify({ status: true, base: 'USD', rates: filteredRates }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action 2: Verify transaction & Save Reusable Card
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

      // If transaction succeeded and has reusable card authorization, save card for user!
      if (verifyData?.status && verifyData?.data?.status === 'success') {
        const auth = verifyData.data.authorization;
        const targetUserId = user_id || verifyData.data.metadata?.user_id;

        if (targetUserId && auth && auth.authorization_code && (auth.reusable ?? true)) {
          try {
            await supabase.from('user_cards').upsert({
              user_id: targetUserId,
              authorization_code: auth.authorization_code,
              card_type: auth.card_type || auth.brand,
              last4: auth.last4,
              exp_month: auth.exp_month,
              exp_year: auth.exp_year,
              bank: auth.bank,
              channel: auth.channel || 'card',
              reusable: true,
              country_code: auth.country_code,
              account_name: auth.account_name,
            }, { onConflict: 'user_id,authorization_code' });
            console.log(`Saved card authorization ${auth.authorization_code} for user ${targetUserId}`);
          } catch (saveErr) {
            console.warn('Failed to save user card to database:', saveErr);
          }
        }
      }

      return new Response(JSON.stringify(verifyData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action 3: 1-Click Payment with Saved Card (charge_authorization)
    if (action === 'charge_authorization') {
      if (!authorization_code || !email) {
        return new Response(
          JSON.stringify({ error: 'authorization_code and email are required to charge saved card' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rates = await getRealtimeExchangeRates(supabase);
      const merchantCurrency = Deno.env.get('PAYSTACK_CURRENCY') || 'ZAR';
      const targetCurrency = (currency || merchantCurrency).toUpperCase();

      const inputUSD = typeof amountUSD === 'number'
        ? amountUSD
        : (typeof totalAmountUSD === 'number' ? totalAmountUSD : null);

      let finalAmountInSubunits: number;
      let convertedAmountDisplay: number;
      let exchangeRateUsed: number;

      if (inputUSD !== null && inputUSD > 0) {
        exchangeRateUsed = Number(rates[targetCurrency]) || 1.0;
        convertedAmountDisplay = Math.round(inputUSD * exchangeRateUsed * 100) / 100;
        finalAmountInSubunits = Math.round(convertedAmountDisplay * 100);
      } else {
        finalAmountInSubunits = Math.round(totalAmount ?? amount ?? 0);
        exchangeRateUsed = 1.0;
        convertedAmountDisplay = finalAmountInSubunits / 100;
      }

      let chargePayload: Record<string, any> = {
        authorization_code,
        email,
        amount: finalAmountInSubunits,
        currency: targetCurrency,
        metadata: {
          ...metadata,
          user_id,
          original_usd_amount: inputUSD ?? (finalAmountInSubunits / 100),
          selected_currency: targetCurrency,
          selected_amount: convertedAmountDisplay,
          exchange_rate: exchangeRateUsed,
          charged_via: 'saved_card_1_click',
        },
      };

      let chargeRes = await fetch('https://api.paystack.co/transaction/charge_authorization', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chargePayload),
      });

      let chargeData = await chargeRes.json();

      // If target currency isn't supported directly by merchant acquiring channel, charge in merchant currency (ZAR)
      if (!chargeData.status && targetCurrency !== merchantCurrency) {
        console.log(`Charge authorization in ${targetCurrency} rejected (${chargeData.message}). Settling in ${merchantCurrency}...`);
        const merchantRate = Number(rates[merchantCurrency]) || 1.0;
        const baseUSD = inputUSD ?? (finalAmountInSubunits / 100);
        const merchantAmount = Math.round(baseUSD * merchantRate * 100) / 100;
        const merchantSubunits = Math.round(merchantAmount * 100);

        chargePayload = {
          authorization_code,
          email,
          amount: merchantSubunits,
          currency: merchantCurrency,
          metadata: {
            ...metadata,
            user_id,
            original_usd_amount: baseUSD,
            selected_currency: targetCurrency,
            selected_amount: convertedAmountDisplay,
            charged_currency: merchantCurrency,
            charged_amount: merchantAmount,
            exchange_rate_to_selected: exchangeRateUsed,
            exchange_rate_to_merchant: merchantRate,
            charged_via: 'saved_card_1_click',
          },
        };

        chargeRes = await fetch('https://api.paystack.co/transaction/charge_authorization', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chargePayload),
        });

        chargeData = await chargeRes.json();
      }

      if (!chargeData.status) {
        return new Response(
          JSON.stringify({ error: chargeData.message || 'Failed to charge saved card' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const isSuccessful = chargeData.data?.status === 'success';

      return new Response(
        JSON.stringify({
          status: true,
          success: isSuccessful,
          reference: chargeData.data?.reference,
          amountUSD: inputUSD,
          convertedAmount: convertedAmountDisplay,
          currency: targetCurrency,
          data: chargeData.data,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action 3.4: Diagnose Meta WhatsApp Cloud API credentials & delivery
    if (action === 'diagnose_meta') {
      const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID');
      const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
      const targetPhone = body.target_phone || '27658932664';

      let metaPhoneDetails = null;
      let metaPhoneError = null;

      if (META_PHONE_NUMBER_ID && META_ACCESS_TOKEN) {
        try {
          const phoneRes = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,code_verification_status,quality_rating`, {
            headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
          });
          metaPhoneDetails = await phoneRes.json();
        } catch (e) {
          metaPhoneError = String(e);
        }
      }

      let sendTestResult = null;
      if (META_PHONE_NUMBER_ID && META_ACCESS_TOKEN && targetPhone) {
        const cleanPhone = String(targetPhone).replace('whatsapp:', '').replace('+', '').trim();
        const useTemplate = body.use_template === true;
        const msgPayload = useTemplate ? {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "template",
          template: {
            name: "hello_world",
            language: { code: "en_US" }
          }
        } : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: {
            preview_url: false,
            body: "🧪 *eShop WhatsApp Diagnostic*\n\nIf you see this message, Meta WhatsApp Cloud API is properly connected to your number! Reply *REGISTER* to start shop registration."
          }
        };

        try {
          const sendRes = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(msgPayload)
          });
          const sendBody = await sendRes.json();
          sendTestResult = {
            mode: useTemplate ? 'template (hello_world)' : 'text (session)',
            status_code: sendRes.status,
            ok: sendRes.ok,
            response: sendBody
          };
        } catch (e) {
          sendTestResult = { error: String(e) };
        }
      }

      return new Response(JSON.stringify({
        has_phone_number_id: !!META_PHONE_NUMBER_ID,
        phone_number_id: META_PHONE_NUMBER_ID ? `${META_PHONE_NUMBER_ID.slice(0, 4)}...${META_PHONE_NUMBER_ID.slice(-4)}` : null,
        has_access_token: !!META_ACCESS_TOKEN,
        meta_phone_details: metaPhoneDetails,
        meta_phone_error: metaPhoneError,
        send_test_result: sendTestResult
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Action 3.5: Test Paystack Order Creation & Shop Dispatch
    if (action === 'test_paystack_order') {
      const emailToUse = email || 'test_buyer@eshop.com';
      const usdAmount = typeof amountUSD === 'number' && amountUSD > 0 ? amountUSD : 15.0;
      const rates = await getRealtimeExchangeRates(supabase);
      const merchantCurrency = Deno.env.get('PAYSTACK_CURRENCY') || 'ZAR';
      const merchantRate = Number(rates[merchantCurrency]) || 16.46;
      const amountSubunits = Math.round(usdAmount * merchantRate * 100);

      const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailToUse,
          amount: amountSubunits,
          currency: merchantCurrency,
          callback_url: 'https://standard.paystack.co/close',
        }),
      });

      const paystackData = await paystackRes.json();
      if (!paystackData.status) {
        return new Response(JSON.stringify({ error: paystackData.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const ref = paystackData.data.reference;

      // Find or create a user ID
      let orderUserId = user_id;
      if (!orderUserId) {
        const { data: userList } = await supabase.from('users').select('id').limit(1);
        if (userList && userList.length > 0) {
          orderUserId = userList[0].id;
        } else {
          const { data: authList } = await supabase.auth.admin.listUsers();
          if (authList?.users && authList.users.length > 0) {
            orderUserId = authList.users[0].id;
            await supabase.from('users').upsert({
              id: orderUserId,
              email: authList.users[0].email || 'test@eshop.com',
              avatar_url: '',
              type: 'USER',
            });
          } else {
            const { data: newUser } = await supabase.auth.admin.createUser({
              email: 'customer_test_paystack@eshop.com',
              password: 'Password123!',
              email_confirm: true,
            });
            if (newUser?.user) {
              orderUserId = newUser.user.id;
              await supabase.from('users').upsert({
                id: orderUserId,
                email: 'customer_test_paystack@eshop.com',
                avatar_url: '',
                type: 'USER',
              });
            }
          }
        }
      }

      const orderSlug = 'order-paystack-' + Math.random().toString(36).substr(2, 8);
      const newOrderPayload = {
        totalPrice: usdAmount,
        description: '2x Fresh Apples ($6.00)\n1x Brown Bread ($4.50)\n1x Cooking Oil ($4.50)',
        delivery_address: '11037 Glen View 7, Harare, Zimbabwe',
        latitude: -17.852345,
        longitude: 31.043567,
        grocery_notes: 'Paystack checkout test for registered shops',
        slug: orderSlug,
        user: orderUserId,
        status: 'Received',
        payment_gateway: 'paystack',
        payment_reference: ref,
        refunded_amount: 0,
      };

      const { data: insertedOrder, error: orderErr } = await supabase
        .from('order')
        .insert(newOrderPayload)
        .select('*')
        .single();

      if (orderErr) {
        return new Response(JSON.stringify({ error: orderErr.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Wait for the on_order_created DB trigger and send-whatsapp-order Edge Function to complete dispatch
      await new Promise((resolve) => setTimeout(resolve, 3500));

      const { data: pendingDispatches } = await supabase
        .from('shop_pending_orders')
        .select('*')
        .eq('order_slug', orderSlug);

      const { data: refreshedOrder } = await supabase
        .from('order')
        .select('id, slug, status, notified_shops_count, shop_name, shop_phone')
        .eq('id', insertedOrder.id)
        .single();

      return new Response(JSON.stringify({
        status: true,
        paystack_reference: ref,
        paystack_access_code: paystackData.data.access_code,
        authorization_url: paystackData.data.authorization_url,
        order: refreshedOrder || insertedOrder,
        shop_pending_dispatches: pendingDispatches || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action 4: Standard In-App Initialize
    const inputUSD = typeof amountUSD === 'number'
      ? amountUSD
      : (typeof totalAmountUSD === 'number' ? totalAmountUSD : null);

    const rates = await getRealtimeExchangeRates(supabase);
    const merchantCurrency = Deno.env.get('PAYSTACK_CURRENCY') || 'ZAR';
    const targetCurrency = (currency || merchantCurrency).toUpperCase();

    let finalAmountInSubunits: number;
    let convertedAmountDisplay: number;
    let exchangeRateUsed: number;
    let chargedCurrency: string = targetCurrency;

    if (inputUSD !== null && inputUSD > 0) {
      exchangeRateUsed = Number(rates[targetCurrency]) || 1.0;
      convertedAmountDisplay = Math.round(inputUSD * exchangeRateUsed * 100) / 100;
      finalAmountInSubunits = Math.round(convertedAmountDisplay * 100);
    } else {
      finalAmountInSubunits = Math.round(totalAmount ?? amount ?? 0);
      exchangeRateUsed = 1.0;
      convertedAmountDisplay = finalAmountInSubunits / 100;
    }

    if (!finalAmountInSubunits || finalAmountInSubunits <= 0 || !email) {
      return new Response(
        JSON.stringify({ error: 'Valid amount and user email are required for checkout' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let initPayload: Record<string, any> = {
      email,
      amount: finalAmountInSubunits,
      currency: targetCurrency,
      callback_url: callback_url || undefined,
      metadata: {
        ...metadata,
        user_id,
        save_card,
        original_usd_amount: inputUSD ?? (finalAmountInSubunits / 100),
        selected_currency: targetCurrency,
        selected_amount: convertedAmountDisplay,
        exchange_rate: exchangeRateUsed,
      },
    };

    let initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initPayload),
    });

    let initData = await initRes.json();

    if (!initData.status && targetCurrency !== merchantCurrency) {
      console.log(`Paystack rejected ${targetCurrency} directly (${initData.message}). Settling in ${merchantCurrency}...`);
      chargedCurrency = merchantCurrency;
      const merchantRate = Number(rates[merchantCurrency]) || 1.0;
      const baseUSD = inputUSD ?? (finalAmountInSubunits / 100);
      const merchantAmount = Math.round(baseUSD * merchantRate * 100) / 100;
      const merchantSubunits = Math.round(merchantAmount * 100);

      initPayload = {
        email,
        amount: merchantSubunits,
        currency: merchantCurrency,
        callback_url: callback_url || undefined,
        metadata: {
          ...metadata,
          user_id,
          save_card,
          original_usd_amount: baseUSD,
          selected_currency: targetCurrency,
          selected_amount: convertedAmountDisplay,
          charged_currency: merchantCurrency,
          charged_amount: merchantAmount,
          exchange_rate_to_selected: exchangeRateUsed,
          exchange_rate_to_merchant: merchantRate,
        },
      };

      initRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(initPayload),
      });

      initData = await initRes.json();
    }

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
      amountUSD: inputUSD,
      convertedAmount: convertedAmountDisplay,
      currency: targetCurrency,
      chargedCurrency: chargedCurrency,
      exchangeRate: exchangeRateUsed,
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
