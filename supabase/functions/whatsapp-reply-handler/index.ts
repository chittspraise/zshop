import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Free OpenStreetMap Nominatim Geocoding helper
async function geocodeAddress(address: string) {
  const normalized = address.toLowerCase().trim();
  
  // Offline local geocoding fallback dictionary to bypass Google billing locks & inaccurate global search for local areas
  const LOCAL_GEOCODE_DB: { [key: string]: { lat: number; lon: number } } = {
    '11037 glen view 7, harare, zimbabwe': { lat: -17.852345, lon: 31.043567 },
    'glen view 7': { lat: -17.852345, lon: 31.043567 },
    'glen view': { lat: -17.852345, lon: 31.043567 },
    'harare': { lat: -17.829167, lon: 31.052222 },
    'bulawayo': { lat: -20.15, lon: 28.583333 },
    'cape town': { lat: -33.924869, lon: 18.424055 },
    'johannesburg': { lat: -26.204103, lon: 28.047305 }
  };

  if (LOCAL_GEOCODE_DB[normalized]) {
    return LOCAL_GEOCODE_DB[normalized];
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
      headers: {
        'User-Agent': 'eshop-supabase-edge-function'
      }
    });
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.error("Geocoding failed:", error);
  }
  // Fallback to Johannesburg, South Africa coordinates if geocoding fails
  return { lat: -26.2041, lon: 28.0473 };
}

// Helper function to send outbound replies to Meta
async function sendMetaReply(to: string, messageBody: string) {
  const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID');
  const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');

  if (!META_PHONE_NUMBER_ID || !META_ACCESS_TOKEN) {
    console.error("Missing META_PHONE_NUMBER_ID or META_ACCESS_TOKEN environment variables in sendMetaReply.");
    return;
  }

  // Strip prefix and plus signs
  const cleanPhone = to.replace('whatsapp:', '').replace('+', '').trim();

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`, {
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
        text: { body: messageBody }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Failed to send reply to ${cleanPhone}:`, errorText);
    } else {
      console.log(`Successfully sent reply to ${cleanPhone}`);
    }
  } catch (error) {
    console.error("Error in sendMetaReply:", error);
  }
}

// Cryptographically verify Meta webhook signatures using HMAC-SHA256
async function verifySignature(rawBody: string, signatureHeader: string, appSecret: string): Promise<boolean> {
  const signature = signatureHeader.replace("sha256=", "").trim();
  
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(appSecret);
  const bodyBytes = encoder.encode(rawBody);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    bodyBytes
  );
  
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return expectedSignature.toLowerCase() === signature.toLowerCase();
}

Deno.serve(async (req) => {
  // 1. Webhook Verification GET handshakes
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === Deno.env.get('META_VERIFY_TOKEN')) {
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // 2. Signature verification for POST requests
  const signatureHeader = req.headers.get('X-Hub-Signature-256');
  const appSecret = Deno.env.get('META_APP_SECRET');
  
  let rawBody = "";
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("Failed to read request body:", err);
    return new Response("Bad Request", { status: 400 });
  }

  if (appSecret) {
    if (!signatureHeader) {
      console.error("Signature verification failed: Missing X-Hub-Signature-256 header.");
      return new Response("Unauthorized: Missing Signature", { status: 401 });
    }
    
    const isValid = await verifySignature(rawBody, signatureHeader, appSecret);
    if (!isValid) {
      console.error("Signature verification failed: Hashes do not match.");
      return new Response("Unauthorized: Invalid Signature", { status: 401 });
    }
  } else {
    console.warn("WARNING: META_APP_SECRET environment variable is not set. Webhook signature verification is skipped!");
  }

  try {
    // Parse the validated request body
    const body = JSON.parse(rawBody);

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const messageObj = value?.messages?.[0];

      if (messageObj) {
        const isLocation = messageObj.type === "location";
        const rawMessage = isLocation ? "" : (messageObj.text?.body || "");
        const message = rawMessage.trim();
        const upperMessage = message.toUpperCase();
        
        // Reconstruct sender in "whatsapp:+<number>" format to maintain DB compatibility
        const sender = `whatsapp:+${messageObj.from}`; 

        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        let reply = "";

        // Check if there is an active registration session for this sender
        const { data: sessionData, error: sessionFetchError } = await supabaseAdmin
          .from("registration_sessions")
          .select("*")
          .eq("phone_number", sender)
          .maybeSingle();

        if (sessionFetchError) {
          console.error(`[whatsapp-reply-handler] Error fetching registration session for ${sender}:`, sessionFetchError);
          reply = "❌ A database error occurred while fetching your session. Please try again later.";
        } else if (sessionData) {
          const currentStep = sessionData.step || 1;

          try {
            if (currentStep === 1) {
              // User replied with first name, ask for surname (Step 2)
              const { error: updateError } = await supabaseAdmin
                .from("registration_sessions")
                .update({ first_name: message, step: 2, updated_at: new Date().toISOString() })
                .eq("phone_number", sender);
              
              if (updateError) {
                console.error(`[whatsapp-reply-handler] Error updating session to step 2 for ${sender}:`, updateError);
                reply = "❌ Failed to save your first name. Please try again.";
              } else {
                reply = `📝 Thanks, ${message}! What is your surname?`;
              }
            } 
            else if (currentStep === 2) {
              // User replied with surname, ask for shop name (Step 3)
              const { error: updateError } = await supabaseAdmin
                .from("registration_sessions")
                .update({ surname: message, step: 3, updated_at: new Date().toISOString() })
                .eq("phone_number", sender);
              
              if (updateError) {
                console.error(`[whatsapp-reply-handler] Error updating session to step 3 for ${sender}:`, updateError);
                reply = "❌ Failed to save your surname. Please try again.";
              } else {
                reply = `🏢 Got it! What is the name of your shop?`;
              }
            } 
            else if (currentStep === 3) {
              // User replied with shop name, ask for physical address (Step 4)
              const { error: updateError } = await supabaseAdmin
                .from("registration_sessions")
                .update({ shop_name: message, step: 4, updated_at: new Date().toISOString() })
                .eq("phone_number", sender);
              
              if (updateError) {
                console.error(`[whatsapp-reply-handler] Error updating session to step 4 for ${sender}:`, updateError);
                reply = "❌ Failed to save your shop name. Please try again.";
              } else {
                reply = `📍 Awesome! What is the physical address of your shop (Street, City)?`;
              }
            } 
            else if (currentStep === 4) {
              // User replied with address. Ask for Location Pin (Step 5)
              const { error: updateError } = await supabaseAdmin
                .from("registration_sessions")
                .update({ address: message, step: 5, updated_at: new Date().toISOString() })
                .eq("phone_number", sender);
              
              if (updateError) {
                console.error(`[whatsapp-reply-handler] Error updating session to step 5 for ${sender}:`, updateError);
                reply = "❌ Failed to save your address. Please try again.";
              } else {
                reply = `📍 Great! Now, please share your exact shop location pin on WhatsApp so we can get your precise GPS coordinates.\n\n*(To do this, tap the attachment '+' or paperclip button, select 'Location', and tap 'Send Your Current Location')*`;
              }
            } 
            else if (currentStep === 5) {
              // User shared location pin. Final Step!
              if (isLocation && messageObj.location) {
                const lat = messageObj.location.latitude;
                const lon = messageObj.location.longitude;

                // Create the active shop record
                const { error: shopInsertError } = await supabaseAdmin
                  .from("shops")
                  .insert({
                    name: sessionData.first_name,
                    surname: sessionData.surname,
                    shop_name: sessionData.shop_name,
                    address: sessionData.address,
                    phone_number: sender,
                    latitude: lat,
                    longitude: lon,
                    is_active: true
                  });

                if (shopInsertError) {
                  console.error("[whatsapp-reply-handler] Shop registration insert failed:", shopInsertError);
                  reply = "❌ Sorry, an error occurred while saving your shop details. Please reply REGISTER to try again.";
                } else {
                  // Clear registration session
                  const { error: deleteError } = await supabaseAdmin
                    .from("registration_sessions")
                    .delete()
                    .eq("phone_number", sender);

                  if (deleteError) {
                    console.error(`[whatsapp-reply-handler] Warning: Failed to delete registration session for ${sender}:`, deleteError);
                  }

                  reply = `🎉 Congratulations! *${sessionData.shop_name}* is now officially registered and active!\n\nYou will automatically receive WhatsApp notifications for any customer orders placed on eShop.`;
                }
              } else {
                reply = `📍 Please share your location pin on WhatsApp so we can get your precise GPS coordinates.\n\n*(To do this, tap the attachment '+' or paperclip button, select 'Location', and tap 'Send Your Current Location')*`;
              }
            }
          } catch (err) {
            console.error("Error processing registration session:", err);
            reply = "❌ An unexpected error occurred. Please reply REGISTER to restart the registration process.";
          }
        } 
        // Handle start of new registration
        else if (upperMessage === "REGISTER") {
          // Check if the shop is already registered in 'shops' table
          const { data: existingShop, error: shopFetchError } = await supabaseAdmin
            .from("shops")
            .select("*")
            .eq("phone_number", sender)
            .maybeSingle();

          if (shopFetchError) {
            console.error(`[whatsapp-reply-handler] Error checking existing shop for ${sender}:`, shopFetchError);
            reply = "❌ A database error occurred. Please try again later.";
          } else if (existingShop) {
            reply = `✨ Your shop, *${existingShop.shop_name}*, is already registered and active on eShop!`;
          } else {
            // Create new registration session
            const { error: sessionInsertError } = await supabaseAdmin
              .from("registration_sessions")
              .insert({
                phone_number: sender,
                step: 1
              });
            
            if (sessionInsertError) {
              console.error(`[whatsapp-reply-handler] Error inserting registration session for ${sender}:`, sessionInsertError);
              reply = "❌ Failed to start registration session. Please try again.";
            } else {
              reply = "👋 Welcome to eShop! Let's register your shop. What is your first name?";
            }
          }
        }
        // Handle Order Accept/Decline flow
        else if (upperMessage.startsWith("ACCEPT") || upperMessage.startsWith("DECLINE")) {
          const parts = message.split(/\s+/); 
          const action = parts[0].toUpperCase();
          const orderSlug = parts[1];

          if (!orderSlug) {
            reply = "Please include the Order ID (e.g., ACCEPT order-123)";
          } else {
            // 1. Fetch the current state of the order
            const { data: order, error: fetchError } = await supabaseAdmin
              .from("order")
              .select("*")
              .eq("slug", orderSlug)
              .single();

            if (fetchError || !order) {
              console.error(`[whatsapp-reply-handler] Order fetch failed for slug ${orderSlug}:`, fetchError);
              reply = `Order ${orderSlug} not found.`;
            } else if (order.status !== 'Received') {
              reply = `Sorry, order ${orderSlug} is already ${order.status}.`;
            } else {
              // 2. Handle Logic
              if (action === "ACCEPT") {
                const { error: updateError } = await supabaseAdmin
                  .from("order")
                  .update({ status: 'Ready' })
                  .eq("slug", orderSlug);

                if (updateError) {
                  console.error(`[whatsapp-reply-handler] Failed to accept order ${orderSlug}:`, updateError);
                  reply = `❌ Sorry, failed to accept order in database. Please try again.`;
                } else {
                  reply = `✅ Success! Order ${orderSlug} is yours. Please prepare it for the customer.`;
                }
              } else {
                // It's a DECLINE
                const newDeclineCount = (order.declined_shops_count || 0) + 1;
                const totalNotified = order.notified_shops_count || 1;

                if (newDeclineCount >= totalNotified) {
                  // Everyone said NO, mark order as Declined and issue a wallet refund
                  const refundAmount = order.totalPrice;

                  // 1. Update order status and refunded_amount
                  const { error: orderUpdateError } = await supabaseAdmin
                    .from("order")
                    .update({
                      status: 'Declined',
                      declined_shops_count: newDeclineCount,
                      refunded_amount: refundAmount
                    })
                    .eq("slug", orderSlug);

                  if (orderUpdateError) {
                    console.error(`[whatsapp-reply-handler] Failed to decline order ${orderSlug} and update status:`, orderUpdateError);
                    reply = `❌ Sorry, failed to decline the order in database. Please try again.`;
                  } else {
                    // 2. Fetch the customer's wallet profile
                    const { data: profile, error: profileError } = await supabaseAdmin
                      .from("profile")
                      .select("wallet_balance")
                      .eq("user_id", order.user)
                      .maybeSingle();

                    // Calculate new balance
                    const currentBalance = (!profileError && profile) ? (profile.wallet_balance || 0) : 0;
                    const newBalance = currentBalance + refundAmount;

                    let balanceUpdateSuccess = true;
                    // 3. Credit the refund securely without using ON CONFLICT specifier
                    if (!profileError && profile) {
                      const { error: walletUpdateError } = await supabaseAdmin
                        .from("profile")
                        .update({ wallet_balance: newBalance })
                        .eq("user_id", order.user);
                      if (walletUpdateError) {
                        console.error(`[whatsapp-reply-handler] Failed to update user wallet balance:`, walletUpdateError);
                        balanceUpdateSuccess = false;
                      }
                    } else {
                      const { error: walletInsertError } = await supabaseAdmin
                        .from("profile")
                        .insert({
                          user_id: order.user,
                          wallet_balance: newBalance
                        });
                      if (walletInsertError) {
                        console.error(`[whatsapp-reply-handler] Failed to insert user wallet balance:`, walletInsertError);
                        balanceUpdateSuccess = false;
                      }
                    }

                    // 4. Log the refund transaction securely
                    if (balanceUpdateSuccess) {
                      const { error: txError } = await supabaseAdmin
                        .from("wallet_transactions")
                        .insert({
                          user_id: order.user,
                          amount: refundAmount,
                          type: 'refund',
                          description: `Refund for order: ${orderSlug}`
                        });
                      if (txError) {
                        console.error(`[whatsapp-reply-handler] Error logging refund to wallet_transactions:`, txError);
                      }
                    }

                    reply = `Order ${orderSlug} has been declined. No other shops are available.`;
                  }
                } else {
                  // Just one person said NO, keep searching
                  const { error: orderUpdateError } = await supabaseAdmin
                    .from("order")
                    .update({ declined_shops_count: newDeclineCount })
                    .eq("slug", orderSlug);

                  if (orderUpdateError) {
                    console.error(`[whatsapp-reply-handler] Failed to update decline count on order ${orderSlug}:`, orderUpdateError);
                    reply = `❌ Sorry, failed to register your decline. Please try again.`;
                  } else {
                    reply = `Thanks for letting us know. We will ask other nearby shops to take this order.`;
                  }
                }
              }
            }
          }
        } 
        else {
          reply = "Send REGISTER to start or reply ACCEPT [OrderID]/DECLINE [OrderID].";
        }

        // Send reply if any was set
        if (reply) {
          await sendMetaReply(sender, reply);
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    console.error("Error in reply handler webhook:", err);
    return new Response("Error", { status: 500 });
  }
});