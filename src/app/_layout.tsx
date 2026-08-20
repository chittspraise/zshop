import { Stack, useRouter, usePathname } from 'expo-router';
import { ToastProvider } from 'react-native-toast-notifications';
import AuthProvider from './Providers/auth-provider';
import QueryProvider from './Providers/query-provider';
import StripeProvider from './Providers/StripeProvider';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Platform, StyleSheet, Image } from 'react-native';
import { useBackHandler } from '@react-native-community/hooks';
import NotificationProvider from './Providers/notification-provider';
import { WalletProvider } from './Providers/Wallet-provider';
import * as Linking from 'expo-linking';
import { supabase } from './lib/supabase';
import FloatingCartOverlay from './floatingCartOverlay';
import { Video, ResizeMode } from 'expo-av';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [videoFinished, setVideoFinished] = useState(false);
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

  // Preload Auth background image on boot, and safety fallback timer (lets the person walk out completely)
  useEffect(() => {
    // Prefetch the remote background image so it's fully cached in memory when the video ends
    Image.prefetch('https://www.blinkco.io/wp-content/uploads/2022/01/shopping-cart-full-of-food-on-yellow-background-g-2021-09-02-09-26-59-utc-1.jpg')
      .catch(err => console.warn('Auth background prefetch failed:', err));

    const timer = setTimeout(() => {
      setVideoFinished(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" backgroundColor="#000" />
      </View>
    );
  }

  // Display Custom Cinematic Video Splash Screen
  if (!videoFinished) {
    return (
      <View style={styles.videoSplashContainer}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <Video
          source={require('../../assets/images/Order for your loved ones, let them collect in minutes. eshop Bringing care closer..mp4')}
          style={styles.videoSplash}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted={true}
          isLooping={false}
          onPlaybackStatusUpdate={(status: any) => {
            if (status.didJustFinish) {
              setVideoFinished(true);
            }
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" translucent backgroundColor="transparent" />
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
                      <Stack.Screen name="RecipientAddressScreen" options={{ headerShown: false, title: 'Recipient Address' }} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  videoSplashContainer: {
    flex: 1,
    backgroundColor: '#edd3bc', // Warm tan/peach background color matching the new intro video
  },
  videoSplash: {
    width: '100%',
    height: '100%',
  },
});
