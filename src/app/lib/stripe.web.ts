/**
 * Deprecated: The payment gateway has been migrated to Paystack.
 * This file is retained as a compatibility bridge.
 */
import { setupPaystackPayment, openPaystackCheckout } from './paystack.web';

export const setupStripePaymentSheet = async (totalAmount: number) => {
  return setupPaystackPayment(totalAmount);
};

export const openStripeCheckout = async () => {
  return openPaystackCheckout();
};
