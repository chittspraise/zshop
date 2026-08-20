const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://qzfphqccgcwetislggto.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnBocWNjZ2N3ZXRpc2xnZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjIyNTMsImV4cCI6MjA4MzM5ODI1M30.8_o-FHRUHBO-br4DnbsdFd5otg6ZVjtmMzW9gCMeOYw";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProfiles() {
  console.log("Fetching user profiles...");
  const { data: profiles, error } = await supabase
    .from('profile')
    .select('user_id, first_name, last_name, phone_number, email, wallet_balance')
    .order('user_id', { ascending: false });

  if (error) {
    console.error("Error fetching profiles:", error.message);
    return;
  }

  console.log(`Found ${profiles.length} profiles:`);
  profiles.forEach((p, idx) => {
    console.log(`\n--- Profile #${idx + 1} ---`);
    console.log(`User ID: ${p.user_id}`);
    console.log(`Name: ${p.first_name} ${p.last_name}`);
    console.log(`Email: ${p.email}`);
    console.log(`Phone: ${p.phone_number}`);
    console.log(`Wallet Balance: $${p.wallet_balance || 0}`);
  });
}

checkProfiles();
