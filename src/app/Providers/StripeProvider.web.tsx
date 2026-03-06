import React from 'react';

export default function StripeProviderWrapper({ children, publishableKey }: { children: React.ReactNode, publishableKey?: string }) {
  // On web, we skip rendering the native StripeProvider.
  // A web-specific implementation would go here if web payments were needed.
  return <>{children}</>;
}
