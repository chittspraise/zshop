import { createClient } from 'jsr:@supabase/supabase-js@2';

export const getOrCreatePaystackCustomerForSupabaseUser = async (
  req: Request
) => {
  const authHeader = req.headers.get('Authorization')!;
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error('User not found');
  }

  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw new Error(`Error fetching user: ${error.message}`);

  if (data.paystack_customer_id) {
    return data.paystack_customer_id;
  }

  const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  if (paystackSecretKey) {
    try {
      const res = await fetch('https://api.paystack.co/customer', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          metadata: {
            supabase_user_id: user.id,
          },
        }),
      });
      const result = await res.json();
      if (result.status && result.data?.customer_code) {
        await supabaseClient
          .from('users')
          .update({ paystack_customer_id: result.data.customer_code })
          .eq('id', user.id);
        return result.data.customer_code;
      }
    } catch (e) {
      console.warn('Could not register customer directly on Paystack:', e);
    }
  }

  return user.email;
};

// Legacy Stripe helper for backward compatibility
export const getOrCreateStripeCustomerForSupabaseUser = async (
  req: Request
) => {
  return await getOrCreatePaystackCustomerForSupabaseUser(req);
};
