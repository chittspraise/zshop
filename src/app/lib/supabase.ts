import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Database } from "../../types/database.types";
import { Platform } from 'react-native';

const supabaseUrl = "https://qzfphqccgcwetislggto.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6ZnBocWNjZ2N3ZXRpc2xnZ3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MjIyNTMsImV4cCI6MjA4MzM5ODI1M30.8_o-FHRUHBO-br4DnbsdFd5otg6ZVjtmMzW9gCMeOYw";

// Use standard, reliable AsyncStorage for Supabase Auth as recommended by the official Supabase Expo Quickstart.
// This completely avoids the well-known Android hardware keystore connection deadlock bug in Expo SecureStore,
// ensuring the app always loads instantly and successfully when closed and reopened.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? (typeof window !== 'undefined' ? window.localStorage : undefined) : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
