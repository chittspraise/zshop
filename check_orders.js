const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://qzfphqccgcwetislggto.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnBocWNjZ2N3ZXRpc2xnZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjIyNTMsImV4cCI6MjA4MzM5ODI1M30.8_o-FHRUHBO-br4DnbsdFd5otg6ZVjtmMzW9gCMeOYw";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLatestOrders() {
  console.log("Fetching latest 5 orders...");
  const { data: orders, error } = await supabase
    .from('order')
    .select('id, created_at, totalPrice, delivery_address, latitude, longitude, notified_shops_count, status, slug')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching orders:", error.message);
    return;
  }

  console.log("Latest orders found:");
  orders.forEach((o, index) => {
    console.log(`\n--- Order #${index + 1} ---`);
    console.log(`ID: ${o.id}`);
    console.log(`Slug: ${o.slug}`);
    console.log(`Created At: ${o.created_at}`);
    console.log(`Total Price: $${o.totalPrice}`);
    console.log(`Address: ${o.delivery_address}`);
    console.log(`Coords: Lat=${o.latitude}, Lon=${o.longitude}`);
    console.log(`Notified Shops Count: ${o.notified_shops_count}`);
    console.log(`Status: ${o.status}`);
  });
}

checkLatestOrders();
