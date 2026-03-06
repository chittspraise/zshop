import { Platform } from 'react-native';
import { supabase } from './supabase';

const fetchStripekeys = async (totalAmount: number) => {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: {
      totalAmount,
    },
  });

  if (error) throw new Error(error.message);

  return data;
};

export const setupStripePaymentSheet = async (totalAmount: number) => {
  if (Platform.OS === 'web') {
    console.warn("Stripe payment sheet is not currently supported on the web platform.");
    return;
  }

  const { initPaymentSheet } = require('@stripe/stripe-react-native');

  // Fetch paymentIntent and publishable key from server
  const { paymentIntent, publicKey, ephemeralKey, customer } =
    await fetchStripekeys(totalAmount);

  if (!paymentIntent || !publicKey) {
    throw new Error('Failed to fetch Stripe keys');
  }

  await initPaymentSheet({
    merchantDisplayName: 'Chitts',
    paymentIntentClientSecret: paymentIntent,
    customerId: customer,
    customerEphemeralKeySecret: ephemeralKey,
    billingDetailsCollectionConfiguration: {
      name: 'always',
      phone: 'always',
      email: 'always',
    },
  });
};

export const openStripeCheckout = async () => {
  if (Platform.OS === 'web') {
    console.warn("Stripe checkout is not currently supported on the web platform.");
    return false;
  }

  const { presentPaymentSheet } = require('@stripe/stripe-react-native');
  const { error } = await presentPaymentSheet();

  if (error) {
    throw new Error(error.message);
  }

  return true;
};