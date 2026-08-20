import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    if (payload.type === 'INSERT' && payload.table === 'order') {
      const newOrder = payload.record;

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: shops, error: shopsError } = await supabaseAdmin
        .from('shops')
        .select('*')
        .eq('is_active', true);

      if (shopsError || !shops) return new Response("Error", { status: 500 });

      // Notify all active registered shops (removing the 50km distance restriction)
      const nearbyShops = shops;

      // --- LOGIC CHANGE: Save how many shops we are asking ---
      await supabaseAdmin
        .from('order')
        .update({ notified_shops_count: nearbyShops.length })
        .eq('id', newOrder.id);

      const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID');
      const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');

      if (!META_PHONE_NUMBER_ID || !META_ACCESS_TOKEN) {
        console.error("Missing META_PHONE_NUMBER_ID or META_ACCESS_TOKEN environment variables.");
        return new Response("Missing Meta API configuration", { status: 500 });
      }
      
      const productList = newOrder.description || "Order items (check app)";
      const groceryNotesPart = newOrder.grocery_notes ? `\n📝 *Grocery List Note:* ${newOrder.grocery_notes}` : '';
      const messageBody = `📦 *New Order Available!*\n\n*Order ID:* ${newOrder.slug}\n*Total:* $${newOrder.totalPrice}\n*Address:* ${newOrder.delivery_address || 'N/A'}${groceryNotesPart}\n\n*Items:*\n${productList}\n\n--- \n✅ Reply *ACCEPT ${newOrder.slug}* to take this order\n❌ Reply *DECLINE ${newOrder.slug}* if you are busy`;

      for (const shop of nearbyShops) {
        if (shop.phone_number) {
          const cleanPhone = shop.phone_number.replace('whatsapp:', '').replace('+', '').trim();
          
          const response = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: cleanPhone,
              type: "text",
              text: {
                preview_url: false,
                body: messageBody
              }
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send WhatsApp message to ${shop.phone_number}:`, errorText);
          } else {
            console.log(`Successfully sent WhatsApp message to ${shop.phone_number}`);
          }
        }
      }
    }
    return new Response("Success", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Error", { status: 500 });
  }
})