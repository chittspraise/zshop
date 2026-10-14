import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Text as RNText } from 'react-native';
import * as Linking from 'expo-linking';
import { Toast } from 'react-native-toast-notifications';
import { supabase } from './lib/supabase';    // your AsyncStorage-backed client
import { useRouter } from 'expo-router';

export default function NewPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      // 1. Check if session was already set by RootLayout deep link handler
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setLoading(false);
        return;
      }

      // 2. Fallback to parse initial URL if opened directly
      let url = await Linking.getInitialURL();
      if (url?.includes('#')) url = url.replace('#', '?');
      if (!url) {
        setLoading(false);
        return;
      }

      const { queryParams } = Linking.parse(url);
      const at = queryParams?.access_token as string | undefined;
      const rt = queryParams?.refresh_token as string | undefined;
      if (at && rt) {
        const { error: sessErr } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
        if (sessErr) Toast.show(sessErr.message, { type: 'danger', placement: 'top' });
      }
      setLoading(false);
    })();
  }, []);

  const handleUpdate = async () => {
    setError('');
    if (!password) { setError('Enter a new password'); return; }

    setSubmitting(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (upErr) {
      setError(upErr.message);
      Toast.show(upErr.message, { type: 'danger', placement: 'top' });
    } else {
      Toast.show('Password updated!', { type: 'success', placement: 'top' });
      router.replace('/');   // ← navigate home
    }
  };

  if (loading) return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0a84ff" />
    </View>
  );

  return (
    <View style={styles.container}>
      <RNText style={styles.title}>Set New Password</RNText>
      <TextInput
        secureTextEntry
        placeholder="New password"
        placeholderTextColor="#888"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor="#888"
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      {error ? <RNText style={styles.error}>{error}</RNText> : null}
      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleUpdate}
        disabled={submitting}
      >
        {submitting 
          ? <ActivityIndicator color="#fff" /> 
          : <RNText style={styles.buttonText}>Update Password</RNText>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 20 },
  title: { fontSize: 24, color: '#fff', marginBottom: 20 },
  input: { width: '100%', padding: 12, backgroundColor: '#222', borderRadius: 6, color: '#fff', marginBottom: 12 },
  error: { color: 'red', marginBottom: 12 },
  button: { width: '100%', padding: 14, backgroundColor: 'green', borderRadius: 6, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#555' },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});
