import { supabase } from './supabase';

export type SavedCard = {
  id: string;
  user_id: string;
  authorization_code: string;
  card_type: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  bank?: string;
  channel?: string;
  is_default?: boolean;
  created_at?: string;
};

export type PaystackCheckoutOptions = {
  totalAmount?: number; // legacy subunits
  amountUSD?: number;   // USD product total e.g. 49.99
  email?: string;
  currency?: string;    // 'GBP' | 'EUR' | 'ZAR' | 'USD' | 'NGN' | 'GHS' | 'KES'
  userId?: string;
  saveCard?: boolean;
  metadata?: Record<string, any>;
};

let cachedAmount: number = 0;
let lastVerifiedReference: string | null = null;
let modalOpener: ((options: PaystackCheckoutOptions | number, email?: string) => Promise<boolean>) | null = null;

export const getLastVerifiedReference = () => lastVerifiedReference;

export const setPaystackModalOpener = (fn: typeof modalOpener) => {
  modalOpener = fn;
};

/**
 * Fetches saved reusable cards for a user from Supabase.
 */
export const fetchUserSavedCards = async (userId?: string): Promise<SavedCard[]> => {
  try {
    let targetId = userId;
    if (!targetId) {
      const { data: { user } } = await supabase.auth.getUser();
      targetId = user?.id;
    }
    if (!targetId) return [];

    const { data, error } = await supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching saved cards:', error.message);
      return [];
    }

    return (data as SavedCard[]) || [];
  } catch (err) {
    console.warn('Error querying user_cards:', err);
    return [];
  }
};

/**
 * Charges a saved card authorization token directly (1-click payment without modal).
 */
export const chargeSavedCard = async ({
  authorizationCode,
  amountUSD,
  currency = 'ZAR',
  email,
  userId,
  metadata,
}: {
  authorizationCode: string;
  amountUSD: number;
  currency?: string;
  email?: string;
  userId?: string;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; reference?: string; error?: string }> => {
  try {
    let userEmail = email;
    let targetUserId = userId;

    if (!userEmail || !targetUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      userEmail = userEmail || user?.email;
      targetUserId = targetUserId || user?.id;
    }

    if (!userEmail) {
      throw new Error('Email is required to charge saved card');
    }

    const { data, error } = await supabase.functions.invoke('paystack-checkout', {
      body: {
        action: 'charge_authorization',
        authorization_code: authorizationCode,
        amountUSD,
        currency,
        email: userEmail,
        user_id: targetUserId,
        metadata,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.success && !data?.status) {
      return { success: false, error: data?.error || 'Charge authorization failed' };
    }

    if (data?.reference) {
      lastVerifiedReference = data.reference;
    }

    return {
      success: true,
      reference: data?.reference,
    };
  } catch (err: any) {
    console.error('Error charging saved card:', err);
    return { success: false, error: err.message || 'Payment failed' };
  }
};

/**
 * Deletes a saved card from Supabase.
 */
export const deleteUserCard = async (cardId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('user_cards').delete().eq('id', cardId);
    return !error;
  } catch (e) {
    console.error('Error deleting card:', e);
    return false;
  }
};

/**
 * Fetches real-time exchange rates stored in and calculated by Supabase.
 * Zero hardcoded rates.
 */
export const fetchCurrencyRates = async (): Promise<Record<string, number>> => {
  try {
    const { data, error } = await supabase.functions.invoke('realtime-rates');
    if (!error && data?.rates && Object.keys(data.rates).length > 0) {
      return data.rates;
    }
  } catch (e) {
    console.warn('realtime-rates function error, trying database table:', e);
  }

  try {
    const { data: dbRows, error: dbErr } = await supabase
      .from('exchange_rates')
      .select('currency, rate');

    if (!dbErr && dbRows && dbRows.length > 0) {
      const dbRates: Record<string, number> = { USD: 1.0 };
      for (const row of dbRows) {
        dbRates[row.currency] = Number(row.rate);
      }
      return dbRates;
    }
  } catch (err) {
    console.warn('Error fetching from exchange_rates table:', err);
  }

  try {
    const { data } = await supabase.functions.invoke('paystack-checkout', {
      body: { action: 'rates' },
    });
    if (data?.rates) return data.rates;
  } catch (err) {
    console.warn('Error fetching rates from paystack-checkout:', err);
  }

  return { USD: 1.0 };
};

/**
 * Initializes a transaction with Paystack via the Supabase Edge Function.
 */
export const initializePaystackTransaction = async ({
  totalAmount,
  amountUSD,
  email,
  currency = 'ZAR',
  userId,
  saveCard = true,
  metadata,
}: PaystackCheckoutOptions) => {
  let userEmail = email;
  let targetUserId = userId;

  if (!userEmail || !targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    userEmail = userEmail || user?.email;
    targetUserId = targetUserId || user?.id;
  }

  if (!userEmail) {
    throw new Error('User email is required for Paystack checkout');
  }

  const { data, error } = await supabase.functions.invoke('paystack-checkout', {
    body: {
      action: 'initialize',
      amountUSD,
      totalAmount,
      email: userEmail,
      currency,
      user_id: targetUserId,
      save_card: saveCard,
      metadata,
      callback_url: 'https://standard.paystack.co/close',
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to initialize Paystack transaction');
  }

  if (!data?.authorization_url || !data?.reference) {
    throw new Error(data?.error || data?.message || 'Invalid response from Paystack checkout service');
  }

  return {
    authorizationUrl: data.authorization_url as string,
    reference: data.reference as string,
    accessCode: data.access_code as string,
    publicKey: data.publicKey as string | undefined,
    amountUSD: data.amountUSD as number | undefined,
    convertedAmount: data.convertedAmount as number | undefined,
    currency: data.currency as string | undefined,
    chargedCurrency: data.chargedCurrency as string | undefined,
    exchangeRate: data.exchangeRate as number | undefined,
  };
};

/**
 * Verifies a transaction status on the backend using the transaction reference.
 */
export const verifyPaystackTransaction = async (reference: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.functions.invoke('paystack-checkout', {
      body: {
        action: 'verify',
        reference,
        user_id: user?.id,
      },
    });

    if (error) {
      console.error('Paystack verification error:', error);
      return false;
    }

    if (data?.data?.status === 'success') {
      lastVerifiedReference = reference;
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error verifying Paystack transaction:', err);
    return false;
  }
};

/**
 * Pre-sets payment amount (drop-in replacement for setupStripePaymentSheet).
 */
export const setupPaystackPayment = async (totalAmount: number) => {
  cachedAmount = totalAmount;
  return true;
};

/**
 * Opens Paystack checkout in a native, in-app modal (no browser redirection).
 */
export const openPaystackCheckout = async (
  amountOrOptions?: number | PaystackCheckoutOptions,
  optionalEmail?: string
): Promise<boolean> => {
  if (modalOpener) {
    return await modalOpener(amountOrOptions ?? cachedAmount, optionalEmail);
  }

  console.warn('PaystackProvider not mounted yet.');
  return false;
};
