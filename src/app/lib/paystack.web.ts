import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';
import {
  PaystackCheckoutOptions,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  setupPaystackPayment,
} from './paystack';

export {
  PaystackCheckoutOptions,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  setupPaystackPayment,
};

let cachedAmount: number = 0;

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

  const { authorizationUrl, reference } = await initializePaystackTransaction({
    totalAmount,
    email,
    currency,
    metadata,
  });

  const callbackUrl = Linking.createURL('payment-callback');

  try {
    const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, callbackUrl);

    if (result.type === 'cancel') {
      return false;
    }

    const isVerified = await verifyPaystackTransaction(reference);
    return isVerified;
  } catch (err) {
    // If popups are blocked on web, open in new tab and poll verification
    if (typeof window !== 'undefined') {
      window.open(authorizationUrl, '_blank');
      return await verifyPaystackTransaction(reference);
    }
    throw err;
  }
};
