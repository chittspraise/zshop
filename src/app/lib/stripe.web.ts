export const setupStripePaymentSheet = async (totalAmount: number) => {
  console.warn("Stripe payment sheet is not currently supported on the web platform.");
  return;
};

export const openStripeCheckout = async () => {
  console.warn("Stripe checkout is not currently supported on the web platform.");
  throw new Error("Stripe checkout is not supported on the web platform.");
};
