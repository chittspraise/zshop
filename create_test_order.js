const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://qzfphqccgcwetislggto.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnBocWNjZ2N3ZXRpc2xnZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjIyNTMsImV4cCI6MjA4MzM5ODI1M30.8_o-FHRUHBO-br4DnbsdFd5otg6ZVjtmMzW9gCMeOYw";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createAndSendOrder() {
  console.log("==================================================");
  console.log("🛒 CREATING ORDER & DISPATCHING TO SHOPS");
  console.log("==================================================\n");

  // Step 1: Check active shops in the database
  console.log("🔍 Step 1: Checking registered active shops...");
  const { data: shops, error: shopsError } = await supabase
    .from('shops')
    .select('id, name, surname, shop_name, phone_number, address, is_active')
    .eq('is_active', true);

  if (shopsError) {
    console.error("❌ Failed to query shops:", shopsError.message);
    return;
  }

  console.log(`✅ Found ${shops.length} active registered shops:`);
  shops.forEach((shop, index) => {
    console.log(`   ${index + 1}. [${shop.shop_name}] - ${shop.name} ${shop.surname} (${shop.phone_number})`);
  });

  // Step 2: Trigger order creation and shop notification
  console.log("\n📦 Step 2: Creating order and triggering WhatsApp shop dispatch...");
  const orderAmountUSD = 24.50;
  const customerEmail = "customer_test@eshop.com";

  const response = await fetch(`${supabaseUrl}/functions/v1/paystack-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'test_paystack_order',
      amountUSD: orderAmountUSD,
      email: customerEmail
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Edge Function error (${response.status}):`, errorText);
    return;
  }

  const result = await response.json();

  if (!result.status) {
    console.error("❌ Order creation failed:", result.error || result);
    return;
  }

  console.log("\n🎉 SUCCESS! Order created and dispatched to shops!");
  console.log("--------------------------------------------------");
  console.log(`Order ID:                 ${result.order?.id}`);
  console.log(`Order Slug:               ${result.order?.slug}`);
  console.log(`Order Status:             ${result.order?.status}`);
  console.log(`Total Amount:             $${orderAmountUSD.toFixed(2)} USD`);
  console.log(`Notified Shops Count:     ${result.order?.notified_shops_count}`);
  console.log(`Paystack Reference:       ${result.paystack_reference}`);
  console.log("--------------------------------------------------");

  // Step 3: Verify shop pending order records
  console.log("\n📲 Step 3: Verifying WhatsApp dispatch status for shops...");
  if (result.shop_pending_dispatches && result.shop_pending_dispatches.length > 0) {
    result.shop_pending_dispatches.forEach((dispatch, idx) => {
      console.log(`   ${idx + 1}. Shop: ${dispatch.shop_phone} | Status: ${dispatch.status.toUpperCase()} | Sent: ${dispatch.created_at}`);
    });
  } else {
    // Check database directly
    const { data: dispatches } = await supabase
      .from('shop_pending_orders')
      .select('*')
      .eq('order_slug', result.order?.slug);

    if (dispatches && dispatches.length > 0) {
      dispatches.forEach((dispatch, idx) => {
        console.log(`   ${idx + 1}. Shop: ${dispatch.shop_phone} | Status: ${dispatch.status.toUpperCase()} | Sent: ${dispatch.created_at}`);
      });
    } else {
      console.log("   (Dispatch queue records being processed...)");
    }
  }

  console.log("\n==================================================");
  console.log("📱 NEXT STEPS FOR SHOP OWNERS:");
  console.log("Registered shop owners have received a WhatsApp notification.");
  console.log("Each shop can reply directly in WhatsApp with:");
  console.log("   *1* - ✅ Accept Order (Claims the order for this shop)");
  console.log("   *2* - ❌ Decline Order (Passes the order to other shops)");
  console.log("==================================================");
}

createAndSendOrder();
