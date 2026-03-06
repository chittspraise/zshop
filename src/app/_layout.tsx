import { Stack, useRouter, usePathname } from 'expo-router';
import { ToastProvider } from 'react-native-toast-notifications';
import AuthProvider from './Providers/auth-provider';
import QueryProvider from './Providers/query-provider';
import StripeProvider from './Providers/StripeProvider';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Platform, SafeAreaView, StyleSheet } from 'react-native';
import { useBackHandler } from '@react-native-community/hooks';
import NotificationProvider from './Providers/notification-provider';
import { WalletProvider } from './Providers/Wallet-provider';
import * as Linking from 'expo-linking';
import { supabase } from './lib/supabase';
import FloatingCartOverlay from './floatingCartOverlay';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  useBackHandler(() => false);

  useEffect(() => {
    let didRestore = false;

    const handleDeepLink = async ({ url }: { url: string }) => {
      const link = url.includes('#') ? url.replace('#', '?') : url;
      const { path, queryParams = {} } = Linking.parse(link);

      const at = queryParams?.access_token as string | undefined;
      const rt = queryParams?.refresh_token as string | undefined;

      if (at && rt) {
        const { error: sessionErr } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        if (sessionErr) console.error('Session restore error', sessionErr.message);
      }

      if (!didRestore) {
        setLoading(false);
        didRestore = true;
      }

      if (path === 'new-password') {
        router.push({
          pathname: '/new-password',
          params: queryParams && Object.keys(queryParams).length ? queryParams : undefined,
        });
      }
    };

    (async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        await handleDeepLink({ url });
      } else if (pathname !== '/new-password') {
        setLoading(false);
      }
    })();

    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, [router, pathname]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" backgroundColor="#000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#000" />
      <SafeAreaView style={styles.safeArea}>
        <ToastProvider>
          <AuthProvider>
            <WalletProvider>
              <QueryProvider>
                <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}>
                  <NotificationProvider>
                    <View style={{ flex: 1 }}>
                      <Stack
                        screenOptions={{
                          contentStyle: { backgroundColor: '#f5f5f5' },
                          headerStyle: { backgroundColor: '#f5f5f5' },
                          headerTitleStyle: { color: '#000' },
                          headerTintColor: '#000',
                        }}
                      >
                        <Stack.Screen name="(shop)" options={{ headerShown: false, title: 'Shop' }} />
                        <Stack.Screen name="passwordreset" options={{ headerShown: false, title: 'Password Reset' }} />
                        <Stack.Screen name="new-password" options={{ headerShown: false, title: 'New Password' }} />
                        <Stack.Screen name="auth" options={{ headerShown: false, title: 'Auth' }} />
                        <Stack.Screen name="product" options={{ headerShown: false, title: 'New Password' }} />
                        <Stack.Screen name="categories" options={{ headerShown: false, title: 'categories' }} />
                        <Stack.Screen name="cart" options={{ headerShown: false, title: 'cart' }} />
                        <Stack.Screen name="Deliveryaddress" options={{ headerShown: false, title: 'My Address' }} />
                      </Stack>

                      {/* Floating cart overlay rendered here */}
                      <FloatingCartOverlay />
                    </View>
                  </NotificationProvider>
                </StripeProvider>
              </QueryProvider>
            </WalletProvider>
          </AuthProvider>
        </ToastProvider>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
