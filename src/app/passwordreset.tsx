import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Toast } from 'react-native-toast-notifications';
import { supabase } from './lib/supabase'; // Adjust if needed

export default function PasswordReset() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Toast.show('Please enter your email', {
        type: 'danger',
        placement: 'top',
        duration: 2000,
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'eshop://new-password', // Your app's deep link
      });

      if (error) {
        console.error('Reset password error:', error.message);
        const message =
          error.message === 'User not found'
            ? 'Email not registered'
            : error.message || 'Error sending reset link';

        Toast.show(message, {
          type: 'danger',
          placement: 'top',
          duration: 2000,
        });
      } else {
        Toast.show('Check your email for reset link', {
          type: 'success',
          placement: 'top',
          duration: 2000,
        });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      Toast.show('An unexpected error occurred. Try again.', {
        type: 'danger',
        placement: 'top',
        duration: 2000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Text style={styles.title}>Reset Your Password</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0f172a', // Premium dark slate background
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 30,
    letterSpacing: -0.5,
  },
  input: {
    width: '100%',
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1.5,
    borderRadius: 10,
    color: '#fff',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#1BC464', // Signature food-app green
    height: 48,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1BC464',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
});

