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

        const isRegisterTrigger =
          upperMessage === "REGISTER" ||
          upperMessage === "REGISSTER" ||
          upperMessage === "REG" ||
          upperMessage === "START" ||
          upperMessage === "RESTART" ||
          upperMessage === "RESET";

        const isCancel = upperMessage === "CANCEL" || upperMessage === "STOP";

        // Check if there is an active registration session for this sender
        const { data: sessionData, error: sessionFetchError } = await supabaseAdmin
          .from("registration_sessions")
          .select("*")
          .eq("phone_number", sender)
          .maybeSingle();

        if (sessionFetchError) {
          console.error(`[whatsapp-reply-handler] Error fetching registration session for ${sender}:`, sessionFetchError);
          reply = "❌ A database error occurred while fetching your session. Please try again later.";
        } 
        // 1. Cancel active registration
        else if (isCancel) {
          await supabaseAdmin
            .from("registration_sessions")
            .delete()
            .eq("phone_number", sender);
          reply = "❌ Registration cancelled. Reply *REGISTER* anytime to register your shop.";
        }
        // 2. Start or Restart registration (even if a stuck session exists)
        else if (isRegisterTrigger) {
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
            // Upsert / reset registration session to step 1
            const { error: sessionUpsertError } = await supabaseAdmin
              .from("registration_sessions")
              .upsert({
                phone_number: sender,
                step: 1,
                first_name: null,
                surname: null,
                shop_name: null,
                address: null,
                updated_at: new Date().toISOString()
              });
            
            if (sessionUpsertError) {
              console.error(`[whatsapp-reply-handler] Error inserting registration session for ${sender}:`, sessionUpsertError);
              reply = "❌ Failed to start registration session. Please try again.";
            } else {
              reply = "👋 Welcome to eShop! Let's register your shop.\n\n*Step 1 of 5:* What is your first name?";
            }
          }
        }
        // 3. Continue in-progress registration session
        else if (sessionData) {
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
                reply = `📝 Thanks, ${message}!\n\n*Step 2 of 5:* What is your surname?`;
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
                reply = `🏢 Got it!\n\n*Step 3 of 5:* What is the name of your shop?`;
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
                reply = `📍 Awesome!\n\n*Step 4 of 5:* What is the physical address of your shop (Street, City)?`;
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
                reply = `📍 Great!\n\n*Step 5 of 5:* Please share your shop's WhatsApp Location Pin so customers can find your shop.\n*(Tap '+' or paperclip ➔ Location ➔ Send Your Current Location)*\n\n💡 *Can't send a pin?* Just reply *SKIP* and we will automatically use your physical address (*${message}*)!`;
              }
            } 
            else if (currentStep === 5) {
              let lat: number;
              let lon: number;

              if (isLocation && messageObj.location) {
                // User sent exact WhatsApp location pin
                lat = messageObj.location.latitude;
                lon = messageObj.location.longitude;
              } else {
                // User sent text, "SKIP", or is unable to send pin -> Automatically geocode their physical address!
                const addressToGeocode = (upperMessage === "SKIP" || upperMessage === "NO" || upperMessage === "NONE")
                  ? sessionData.address
                  : (message.length > 3 ? `${message}, ${sessionData.address || ''}` : sessionData.address);

                const coords = await geocodeAddress(addressToGeocode || sessionData.address || "Harare, Zimbabwe");
                lat = coords.lat;
                lon = coords.lon;
              }

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

                reply = `🎉 Congratulations! *${sessionData.shop_name}* is now officially registered and active on eShop!\n\n📍 *Address:* ${sessionData.address}\n\nYou will automatically receive WhatsApp notifications for any customer orders placed nearby.`;
              }
            }
          } catch (err) {
            console.error("Error processing registration session:", err);
            reply = "❌ An unexpected error occurred. Please reply REGISTER to restart the registration process.";
          }
        }
        // Handle Order Accept/Decline flow (supports "1", "2", or "ACCEPT <slug>", "DECLINE <slug>")
        else if (
          upperMessage === "1" ||
          upperMessage.startsWith("1 ") ||
          upperMessage === "1." ||
          upperMessage === "2" ||
          upperMessage.startsWith("2 ") ||
          upperMessage === "2." ||
          upperMessage.startsWith("ACCEPT") ||
          upperMessage.startsWith("DECLINE")
        ) {
          let action = "";
          let orderSlug = "";

          if (upperMessage === "1" || upperMessage.startsWith("1 ") || upperMessage === "1.") {
            action = "ACCEPT";
            const parts = message.split(/\s+/);
            if (parts.length > 1) {
              orderSlug = parts[1];
            }
          } else if (upperMessage === "2" || upperMessage.startsWith("2 ") || upperMessage === "2.") {
            action = "DECLINE";
            const parts = message.split(/\s+/);
            if (parts.length > 1) {
              orderSlug = parts[1];
            }
          } else if (upperMessage.startsWith("ACCEPT")) {
            action = "ACCEPT";
            const parts = message.split(/\s+/);
            orderSlug = parts[1] || "";
          } else if (upperMessage.startsWith("DECLINE")) {
            action = "DECLINE";
            const parts = message.split(/\s+/);
            orderSlug = parts[1] || "";
          }

          // If no order slug was specified (e.g. shop simply texted "1" or "2"),
          // automatically retrieve the latest pending order dispatched to this shop!
          if (!orderSlug) {
            const { data: pendingRecord, error: pendingErr } = await supabaseAdmin
              .from("shop_pending_orders")
              .select("*")
              .eq("shop_phone", sender)
              .eq("status", "pending")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (pendingErr) {
              console.error(`[whatsapp-reply-handler] Error querying pending order for ${sender}:`, pendingErr);
            } else if (pendingRecord) {
              orderSlug = pendingRecord.order_slug;
            }
          }

          if (!orderSlug) {
            reply = "You don't have any pending orders waiting for a reply right now. (Or specify the ID like: 1 order-123)";
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
              // Mark this shop's pending record as 'missed'
              await supabaseAdmin
                .from("shop_pending_orders")
                .update({ status: 'missed' })
                .eq("shop_phone", sender)
                .eq("order_slug", orderSlug);

              reply = `Sorry, order ${orderSlug} was already taken or closed (${order.status}). Thank you!`;
            } else {
              // 2. Handle Logic
              if (action === "ACCEPT") {
                // Fetch the accepting shop's details using their phone number
                const { data: acceptingShop, error: shopFetchErr } = await supabaseAdmin
                  .from("shops")
                  .select("*")
                  .eq("phone_number", sender)
                  .maybeSingle();

                if (shopFetchErr) {
                  console.error(`[whatsapp-reply-handler] Error fetching shop profile for ${sender}:`, shopFetchErr);
                }

                const shopName = acceptingShop?.shop_name || "Partner Shop";
                const shopAddress = acceptingShop?.address || "";
                const shopPhone = acceptingShop?.phone_number || sender;
                const shopOwner = acceptingShop
                  ? `${acceptingShop.name || ""} ${acceptingShop.surname || ""}`.trim()
                  : "";
                const shopLat = acceptingShop?.latitude ?? null;
                const shopLon = acceptingShop?.longitude ?? null;

                const { error: updateError } = await supabaseAdmin
                  .from("order")
                  .update({
                    status: "Ready",
                    shop_name: shopName,
                    shop_address: shopAddress,
                    shop_phone: shopPhone,
                    shop_owner_name: shopOwner,
                    shop_latitude: shopLat,
                    shop_longitude: shopLon,
                  })
                  .eq("slug", orderSlug);

                if (updateError) {
                  console.error(`[whatsapp-reply-handler] Failed to accept order ${orderSlug}:`, updateError);
                  reply = `❌ Sorry, failed to accept order in database. Please try again.`;
                } else {
                  // Mark this shop's pending record as 'accepted'
                  await supabaseAdmin
                    .from("shop_pending_orders")
                    .update({ status: 'accepted' })
                    .eq("shop_phone", sender)
                    .eq("order_slug", orderSlug);

                  // Mark other shops' pending records for this order as 'missed'
                  await supabaseAdmin
                    .from("shop_pending_orders")
                    .update({ status: 'missed' })
                    .eq("order_slug", orderSlug)
                    .neq("shop_phone", sender);

                  reply = `✅ Success! Order ${orderSlug} is yours. Please prepare it for the customer.\n\n📍 Collection point: *${shopName}*${shopAddress ? ` (${shopAddress})` : ""}`;
                }
              } else {
                // It's a DECLINE
                // Mark this shop's pending record as 'declined'
                await supabaseAdmin
                  .from("shop_pending_orders")
                  .update({ status: 'declined' })
                  .eq("shop_phone", sender)
                  .eq("order_slug", orderSlug);

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
          reply = "Send REGISTER to start or reply 1 to Accept / 2 to Decline.";
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