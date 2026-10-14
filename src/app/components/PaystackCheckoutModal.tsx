import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';

export type PaystackModalProps = {
  visible: boolean;
  authorizationUrl?: string;
  reference?: string;
  amountDisplay?: number | string;
  currency?: string;
  amountUSD?: number;
  onSuccess: (reference: string) => void;
  onCancel: () => void;
};

export default function PaystackCheckoutModal({
  visible,
  authorizationUrl,
  reference,
  amountDisplay,
  currency = 'ZAR',
  amountUSD,
  onSuccess,
  onCancel,
}: PaystackModalProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!visible || !authorizationUrl) {
    return null;
  }

  const handleClose = () => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to cancel this transaction?',
      [
        { text: 'No, Keep Paying', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: onCancel,
        },
      ]
    );
  };

  const checkUrlForCompletion = (url: string) => {
    if (!url) return false;

    // Detect Paystack redirect/completion indicators
    const isCallback =
      url.includes('payment-callback') ||
      url.includes('standard.paystack.co/close') ||
      url.includes('checkout.paystack.com/close') ||
      url.includes('close=1') ||
      url.includes('trxref=') ||
      url.includes('reference=');

    if (isCallback) {
      // Try to parse reference from URL query params
      try {
        const urlObj = new URL(url);
        const refFromUrl =
          urlObj.searchParams.get('reference') ||
          urlObj.searchParams.get('trxref') ||
          reference ||
          '';

        onSuccess(refFromUrl);
        return true;
      } catch {
        onSuccess(reference || '');
        return true;
      }
    }
    return false;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Native In-App Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeButtonText}>✕ Cancel</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerBadge}>🔒 Secured by Paystack</Text>
            {amountDisplay !== undefined && (
              <Text style={styles.headerAmount}>
                Paying: {currency} {typeof amountDisplay === 'number' ? amountDisplay.toFixed(2) : amountDisplay}
                {amountUSD !== undefined ? ` ($${amountUSD.toFixed(2)} USD)` : ''}
              </Text>
            )}
          </View>

          <View style={{ width: 60 }} />
        </View>

        {/* In-App Native WebView */}
        <View style={styles.webviewContainer}>
          <WebView
            source={{ uri: authorizationUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#0ba4db" />
                <Text style={styles.loadingText}>Connecting to Paystack...</Text>
              </View>
            )}
            onNavigationStateChange={(navState) => {
              checkUrlForCompletion(navState.url);
            }}
            onShouldStartLoadWithRequest={(request) => {
              if (checkUrlForCompletion(request.url)) {
                return false;
              }
              return true;
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1e293b',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  headerBadge: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerAmount: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
});
