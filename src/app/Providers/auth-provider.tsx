import { Session } from '@supabase/supabase-js';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';

type AuthData = {
  session: Session | null;
  mounting: boolean;
  user: any;
};

const AuthContext = createContext<AuthData>({
  session: null,
  mounting: true,
  user: null,
});

export default function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<{
    avatar_url: string;
    created_at: string | null;
    email: string;
    expo_notification_token: string | null;
    id: string;
    stripe_customer_id: string | null;
    type: string | null;
  } | null>(null);
  const [mounting, setMounting] = useState(true);

  useEffect(() => {
    const handleUserAndProfile = async (session: Session | null) => {
      try {
        setSession(session);

        if (session) {
          // 1. Fetch users row
          const { data: userRecord, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (userError) {
            console.error('Error fetching user record:', userError);
          } else if (userRecord) {
            setUser(userRecord);
          }

          // 2. Fetch and ensure profile row exists
          const { data: profileRecord, error: profileError } = await supabase
            .from('profile')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (profileError) {
            console.error('Error fetching profile record:', profileError);
          } else if (!profileRecord) {
            console.log('No profile found. Creating default authenticated profile row...');
            // Since they are signed in and authenticated, RLS will allow this insert!
            const { error: insertError } = await supabase
              .from('profile')
              .insert({
                user_id: session.user.id,
                email: session.user.email,
                first_name: session.user.user_metadata?.first_name || 'User',
                last_name: session.user.user_metadata?.last_name || '',
                phone_number: session.user.user_metadata?.phone_number || '',
                wallet_balance: 100.00, // Starter balance
              });

            if (insertError) {
              console.error('Error creating default profile:', insertError);
            }
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Unexpected error in handleUserAndProfile:', err);
      } finally {
        setMounting(false); // ⚡ Always guarantee mounting is set to false!
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleUserAndProfile(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, mounting, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);