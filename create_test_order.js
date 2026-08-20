const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://qzfphqccgcwetislggto.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnBocWNjZ2N3ZXRpc2xnZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjIyNTMsImV4cCI6MjA4MzM5ODI1M30.8_o-FHRUHBO-br4DnbsdFd5otg6ZVjtmMzW9gCMeOYw";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestOrder() {
  const email = `test_customer_${Math.floor(Math.random() * 100000)}@eshop.com`;
  const password = "Password123!";

  console.log(`Step 1: Signing up a test customer (${email})...`);
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

  // We are already authenticated as the signed-up user in this client instance!
  console.log("\nStep 2: Inserting a test order...");
  const orderSlug = 'order-test-' + Math.random().toString(36).substr(2, 9);
  const { data: orderData, error: orderError } = await supabase
    .from('order')
    .insert({
      totalPrice: 15.50,
      description: "1x Organic Apples ($5.50)\n1x Fresh Milk ($10.00)",
      delivery_address: "11037 Glen View 7, Harare, Zimbabwe",
      latitude: -17.852345,
      longitude: 31.043567,
      grocery_notes: "Test order: Please verify if WhatsApp notification is received!",
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
  console.log(`\nOrder ID: ${orderData.id}`);
  console.log(`Order Slug: ${orderData.slug}`);
  console.log(`Please check if Pinkshop's WhatsApp (whatsapp:+27658932664) received this notification!`);
}

createTestOrder();
