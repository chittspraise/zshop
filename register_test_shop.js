const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://qzfphqccgcwetislggto.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnBocWNjZ2N3ZXRpc2xnZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjIyNTMsImV4cCI6MjA4MzM5ODI1M30.8_o-FHRUHBO-br4DnbsdFd5otg6ZVjtmMzW9gCMeOYw";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function registerShopAndOrder() {
  const targetPhone = "whatsapp:+263658932664";

  console.log(`Checking if shop already exists for ${targetPhone}...`);
  const { data: existingShop, error: fetchError } = await supabase
    .from('shops')
    .select('*')
    .eq('phone_number', targetPhone)
    .maybeSingle();

  if (fetchError) {
    console.error("Error checking shop:", fetchError.message);
    return;
  }

  if (existingShop) {
    console.log("Shop already registered:", existingShop);
  } else {
    console.log("Inserting test shop...");
    const { data: newShop, error: insertError } = await supabase
      .from('shops')
      .insert({
        name: "Test User",
        surname: "Tester",
        shop_name: "My Test Shop",
        address: "11037 Glen View 7, Harare, Zimbabwe",
        phone_number: targetPhone,
        latitude: -17.852345,
        longitude: 31.043567,
        is_active: true
      })
      .select('*')
      .single();

    if (insertError) {
      console.error("Failed to insert shop (might be blocked by RLS policies):", insertError.message);
      console.log("\nIf this is blocked by RLS, we can instead register by sending 'REGISTER' to the WhatsApp bot!");
      return;
    }
    console.log("Successfully registered shop:", newShop);
  }

  // Now create a test order to trigger the WhatsApp notification!
  console.log("\nCreating a test order to trigger the WhatsApp notification...");
  const email = `test_customer_${Math.floor(Math.random() * 100000)}@eshop.com`;
  const password = "Password123!";

  console.log(`Signing up a temporary test customer (${email})...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error("Sign up failed:", signUpError.message);
    return;
  }

  const user = signUpData.user;
  console.log(`Successfully signed up user with ID: ${user.id}`);

  console.log("Inserting a test order within 50km of the shop...");
  const orderSlug = 'order-test-' + Math.random().toString(36).substr(2, 9);
  const { data: orderData, error: orderError } = await supabase
    .from('order')
    .insert({
      totalPrice: 15.50,
      description: "1x Organic Apples ($5.50)\n1x Fresh Milk ($10.00)",
      delivery_address: "11037 Glen View 7, Harare, Zimbabwe",
      latitude: -17.852345,
      longitude: 31.043567,
      grocery_notes: "Test order to verify if WhatsApp notification is received!",
      slug: orderSlug,
      user: user.id,
      status: 'Received',
      refunded_amount: 0
    })
    .select('*')
    .single();

  if (orderError) {
    console.error("Failed to create test order:", orderError);
    return;
  }

  console.log("🎉 SUCCESS! Test Order Created:", JSON.stringify(orderData, null, 2));
  console.log(`Order ID: ${orderData.id}`);
  console.log(`Order Slug: ${orderData.slug}`);
  console.log(`\nPlease check if your WhatsApp (${targetPhone}) received the order notification!`);
}

registerShopAndOrder();
