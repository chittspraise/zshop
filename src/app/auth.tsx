import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import * as zod from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from './lib/supabase';
import { Toast } from 'react-native-toast-notifications';
import { useAuth } from './Providers/auth-provider';
import { Link, Redirect } from 'expo-router';

type CartItemType = {
  id: number;
  title: string;
  heroImage: string;
  price: number;
  quantity: number;
};

const SUPABASE_URL = 'https://glgofbepunfskmhmuyld.supabase.co'; // existing url config

const signInSchema = zod.object({
  email: zod.string().email({ message: 'Invalid email address' }),
  password: zod.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

const signUpSchema = signInSchema.extend({
  first_name: zod.string().min(1, { message: 'First name is required' }),
  last_name: zod.string().min(1, { message: 'Last name is required' }),
  phone_number: zod.string().min(10, { message: 'Phone number must be at least 10 characters' }),
});

type SignInData = zod.infer<typeof signInSchema>;
type SignUpData = zod.infer<typeof signUpSchema>;

export default function Auth() {
  const { session } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false); 
  const [redirect, setRedirect] = useState(false);

  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(isSignUp ? signUpSchema : signInSchema),
    defaultValues: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      phone_number: '',
    },
  });

  useEffect(() => {
    if (session) {
      setRedirect(true);
    }
  }, [session]);

  if (redirect) {
    return <Redirect href="/" />;
  }

  const signIn = async (data: SignInData) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      alert(error.message);
    } else {
      Toast.show('Signed in successfully', {
        type: 'success',
        placement: 'top',
        duration: 1500,
      });
    }
  };

  const createProfile = async (userId: string, data: SignUpData) => {
    const { error } = await supabase
      .from('profile')
      .insert({
        user_id: userId,
        first_name: data.first_name,
        last_name: data.last_name,
        phone_number: data.phone_number,
        email: data.email,
      });

    if (error) {
      if (error.message.includes('row-level security') || error.code === '42501') {
        console.log('Profile creation deferred until first sign in.');
      } else {
        alert(`Error creating profile: ${error.message}`);
      }
    } else {
      Toast.show('Profile created successfully', {
        type: 'success',
        placement: 'top',
        duration: 1500,
      });
    }
  };

  const signUp = async (data: SignUpData) => {
    const { data: signUpResponse, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number,
        }
      }
    });

    if (error) {
      alert(error.message);
    } else if (signUpResponse.user?.id) {
      await createProfile(signUpResponse.user.id, data);
      Toast.show('Account created! Please sign in to verify your profile.', {
        type: 'success',
        placement: 'top',
        duration: 3000,
      });
    } else {
      alert('User creation succeeded but user ID not returned.');
    }
  };

  return (
    <ImageBackground
      source={{
        uri: 'https://www.blinkco.io/wp-content/uploads/2022/01/shopping-cart-full-of-food-on-yellow-background-g-2021-09-02-09-26-59-utc-1.jpg',
      }}
      style={styles.backgroundImage}
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardContainer}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.cardContainer}>
              <Text style={styles.title}>Welcome</Text>
              <Text style={styles.subtitle}>
                {isSignUp ? 'Please create an account' : 'Please authenticate to continue'}
              </Text>

              <Controller
                control={control}
                name="email"
                render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                  <View style={styles.fieldWrapper}>
                    <TextInput
                      placeholder="Email"
                      style={styles.input}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholderTextColor="#aaa"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    {error && <Text style={styles.error}>{error.message}</Text>}
                  </View>
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                  <View style={styles.fieldWrapper}>
                    <TextInput
                      placeholder="Password"
                      style={styles.input}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      secureTextEntry
                      placeholderTextColor="#aaa"
                      autoCapitalize="none"
                    />
                    {error && <Text style={styles.error}>{error.message}</Text>}
                  </View>
                )}
              />

              {isSignUp && (
                <>
                  <Controller
                    control={control}
                    name="first_name"
                    render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                      <View style={styles.fieldWrapper}>
                        <TextInput
                          placeholder="First Name"
                          style={styles.input}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholderTextColor="#aaa"
                        />
                        {error && <Text style={styles.error}>{error.message}</Text>}
                      </View>
                    )}
                  />

                  <Controller
                    control={control}
                    name="last_name"
                    render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                      <View style={styles.fieldWrapper}>
                        <TextInput
                          placeholder="Last Name"
                          style={styles.input}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholderTextColor="#aaa"
                        />
                        {error && <Text style={styles.error}>{error.message}</Text>}
                      </View>
                    )}
                  />

                  <Controller
                    control={control}
                    name="phone_number"
                    render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
                      <View style={styles.fieldWrapper}>
                        <TextInput
                          placeholder="Phone Number"
                          style={styles.input}
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                          placeholderTextColor="#aaa"
                          keyboardType="phone-pad"
                        />
                        {error && <Text style={styles.error}>{error.message}</Text>}
                      </View>
                    )}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.button, formState.isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit(isSignUp ? signUp : signIn)}
                disabled={formState.isSubmitting}
              >
                <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.toggleButton]}
                onPress={() => setIsSignUp((prev) => !prev)}
              >
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Already have an account? Sign In' : 'Don’t have an account? Sign Up'}
                </Text>
              </TouchableOpacity>

              <Link href="/passwordreset" asChild>
                <TouchableOpacity style={styles.forgotButton}>
                  <Text style={styles.forgotButtonText}>Forgot your password?</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Slate grey dark overlay
  },
  safeContainer: {
    flex: 1,
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
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 440, // Web viewport safety limits
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#cbd5e1',
    marginBottom: 28,
    textAlign: 'center',
  },
  fieldWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  input: {
    width: '100%',
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    fontSize: 15,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  button: {
    backgroundColor: '#1BC464', // Signature food-app green
    height: 48,
    borderRadius: 10,
    marginTop: 10,
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
    opacity: 0.7,
  },
  toggleButton: {
    backgroundColor: 'transparent',
    borderColor: '#fff',
    borderWidth: 1.5,
    marginTop: 12,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  error: {
    color: '#f87171', // Bright soft red error
    fontSize: 12,
    marginTop: 4,
    alignSelf: 'flex-start',
    marginLeft: '2%',
    fontWeight: '600',
  },
  forgotButton: {
    marginTop: 18,
    padding: 6,
  },
  forgotButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    textDecorationLine: 'underline',
  },
});