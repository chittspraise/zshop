import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

// Complete any pending auth session if redirected back to web/app
WebBrowser.maybeCompleteAuthSession();

export type PaystackCheckoutOptions = {
  totalAmount: number; // in subunits (e.g. cents/kobo, 100 subunits = 1 currency unit)
  email?: string;
  currency?: string;
  metadata?: Record<string, any>;
};

let cachedAmount: number = 0;

/**
 * Initializes a transaction with Paystack via the Supabase Edge Function.
 */
export const initializePaystackTransaction = async ({
  totalAmount,
  email,
  currency,
  metadata,
}: PaystackCheckoutOptions) => {
  let userEmail = email;

  if (!userEmail) {
    const { data: { user } } = await supabase.auth.getUser();
    userEmail = user?.email;
  }

  if (!userEmail) {
    throw new Error('User email is required for Paystack checkout');
  }

  // Create deep link redirect callback
  const callbackUrl = Linking.createURL('payment-callback');

  const { data, error } = await supabase.functions.invoke('paystack-checkout', {
    body: {
      action: 'initialize',
      totalAmount,
      email: userEmail,
      callback_url: callbackUrl,
      currency,
      metadata,
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
  };
};

/**
 * Verifies a transaction status on the backend using the transaction reference.
 */
export const verifyPaystackTransaction = async (reference: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('paystack-checkout', {
      body: {
        action: 'verify',
        reference,
      },
    });

    if (error) {
      console.error('Paystack verification error:', error);
      return false;
    }

    if (data?.data?.status === 'success' || data?.status === 'success' || data?.status === true) {
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
 * Opens Paystack checkout in a secure, native in-app browser sheet.
 * Can be called with either:
 * - openPaystackCheckout({ totalAmount: 5000, email: 'user@test.com' })
 * - openPaystackCheckout(5000, 'user@test.com')
 * - openPaystackCheckout() (uses cachedAmount from setupPaystackPayment)
 */
export const openPaystackCheckout = async (
  amountOrOptions?: number | PaystackCheckoutOptions,
  optionalEmail?: string
): Promise<boolean> => {
  let totalAmount = cachedAmount;
  let email = optionalEmail;
  let currency: string | undefined;
  let metadata: Record<string, any> | undefined;

  if (typeof amountOrOptions === 'number') {
    totalAmount = amountOrOptions;
  } else if (typeof amountOrOptions === 'object' && amountOrOptions !== null) {
    totalAmount = amountOrOptions.totalAmount ?? cachedAmount;
    email = amountOrOptions.email ?? email;
    currency = amountOrOptions.currency;
    metadata = amountOrOptions.metadata;
  }

  if (!totalAmount || totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  // 1. Initialize transaction with Paystack backend
  const { authorizationUrl, reference } = await initializePaystackTransaction({
    totalAmount,
    email,
    currency,
    metadata,
  });

  const callbackUrl = Linking.createURL('payment-callback');

  // 2. Open Paystack hosted checkout in system browser modal
  const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, callbackUrl);

  // 3. User explicitly canceled the checkout sheet
  if (result.type === 'cancel') {
    return false;
  }

  // 4. Verify transaction with Paystack on backend
  const isVerified = await verifyPaystackTransaction(reference);

  if (!isVerified) {
    // If the browser was dismissed without completing payment
    if (result.type === 'dismiss') {
      return false;
    }
    throw new Error('Paystack payment verification failed. Please try again.');
  }

  return true;
};
