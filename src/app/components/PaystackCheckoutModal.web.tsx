import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { PaystackModalProps } from './PaystackCheckoutModal';

export default function PaystackCheckoutModalWeb({
  visible,
  authorizationUrl,
  reference,
  amountDisplay,
  currency = 'ZAR',
  amountUSD,
  onSuccess,
  onCancel,
}: PaystackModalProps) {
  useEffect(() => {
    if (!visible) return;

    // Listen to messages from Paystack iframe if any
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'successful' || data?.status === 'success') {
          onSuccess(data?.reference || reference || '');
        } else if (data?.event === 'cancelled') {
          onCancel();
        }
      } catch {
        // Ignore unparseable messages from other extensions/scripts
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [visible, reference, onSuccess, onCancel]);

  if (!visible || !authorizationUrl) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.webBackdrop}>
        <View style={styles.webContainer}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
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

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => onSuccess(reference || '')}
            >
              <Text style={styles.doneButtonText}>I've Paid</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.iframeWrapper}>
            <iframe
              src={authorizationUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Paystack Checkout"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  webContainer: {
    width: '100%',
    maxWidth: 520,
    height: '90%',
    maxHeight: 740,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    height: 58,
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
  doneButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#10b981',
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#ffffff',
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
  iframeWrapper: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
