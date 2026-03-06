import React from 'react';
import { Platform } from 'react-native';

export default function StripeProviderWrapper(props: any) {
  if (Platform.OS === 'web') {
    return <>{props.children}</>;
  }
  
  const { StripeProvider } = require('@stripe/stripe-react-native');
  return <StripeProvider {...props} />;
}
