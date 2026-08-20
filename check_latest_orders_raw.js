const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const poolerUrlPath = 'C:\\Users\\Proudchitts\\Desktop\\eshop\\eshop\\supabase\\.temp\\pooler-url';
  if (!fs.existsSync(poolerUrlPath)) {
    console.error('Pooler URL file not found.');
    return;
  }
  const rawUrl = fs.readFileSync(poolerUrlPath, 'utf8').trim();
  
  // Parse and decode individual connection parameters safely
  const parsed = new URL(rawUrl);
  const clientConfig = {
    host: parsed.hostname,
    port: parsed.port || 5432,
    database: parsed.pathname.split('/')[1],
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: { rejectUnauthorized: false } // Required for Supabase production
  };

  const client = new Client(clientConfig);
  await client.connect();

  try {
    console.log('--- LATEST 5 ORDERS IN DATABASE ---');
    const ordersRes = await client.query(`
      SELECT id, created_at, "totalPrice", delivery_address, latitude, longitude, notified_shops_count, status, slug 
      FROM public."order" 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    ordersRes.rows.forEach((o, i) => {
      console.log(`\nOrder #${i+1}:`);
      console.log(`  ID: ${o.id}`);
      console.log(`  Slug: ${o.slug}`);
      console.log(`  Created At: ${o.created_at}`);
      console.log(`  Price: $${o.totalPrice}`);
      console.log(`  Address: ${o.delivery_address}`);
      console.log(`  Coordinates: Lat=${o.latitude}, Lon=${o.longitude}`);
      console.log(`  Notified Shops: ${o.notified_shops_count}`);
      console.log(`  Status: ${o.status}`);
    });

    console.log('\n--- PG_NET HTTP REQUEST LOGS ---');
    const netRes = await client.query(`
      SELECT id, url, method, status, error_msg, created_at 
      FROM net.http_request_queue 
      ORDER BY created_at DESC 
      LIMIT 5
    `).catch(err => {
      return { rows: [{ error: 'Could not query net.http_request_queue: ' + err.message }] };
    });

    netRes.rows.forEach((r, i) => {
      if (r.error) {
        console.log(r.error);
        return;
      }
      console.log(`\nRequest #${i+1}:`);
      console.log(`  ID: ${r.id}`);
      console.log(`  URL: ${r.url}`);
      console.log(`  Method: ${r.method}`);
      console.log(`  Status Code: ${r.status}`);
      console.log(`  Error Message: ${r.error_msg}`);
      console.log(`  Created At: ${r.created_at}`);
    });

  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    await client.end();
  }
}

run();
