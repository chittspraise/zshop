import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth-provider';

type WalletContextType = {
  walletBalance: number | null;
  refreshWallet: () => Promise<void>;
  updateWalletBalance: (newBalance: number) => Promise<void>; // Add this method to update the balance
};

const WalletContext = createContext<WalletContextType>({
  walletBalance: null,
  refreshWallet: async () => {},
  updateWalletBalance: async () => {}, // Placeholder for function
});

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const { session } = useAuth();

  const fetchWalletBalance = async () => {
    try {
      // Fetch the authenticated user
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.user) {
        console.error('Error fetching user or user not logged in:', userError);
        setWalletBalance(null); // Clear balance if logged out
        return;
      }

      const userId = user.user.id;

      // Fetch wallet balance from the profile table
      const { data, error } = await supabase
        .from('profile')
        .select('wallet_balance')
        .eq('user_id', userId)
        .maybeSingle(); // Prevents throwing if missing

      if (error) {
        console.error('Error fetching wallet balance:', error);
        return;
      }

      if (data && typeof data.wallet_balance !== 'undefined') {
        setWalletBalance(data.wallet_balance);
      } else {
        setWalletBalance(null);
      }
    } catch (err) {
      console.error('Unexpected error fetching wallet balance:', err);
    }
  };

  const updateWalletBalance = async (newBalance: number) => {
    try {
      // Fetch the authenticated user
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.user) {
        console.error('Error fetching user or user not logged in:', userError);
        return;
      }

      const userId = user.user.id;

      // Update wallet balance in the profile table
      const { data, error } = await supabase
        .from('profile')
        .update({ wallet_balance: newBalance })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating wallet balance:', error);
        return;
      }

      // Successfully updated the wallet balance, now refresh it
      fetchWalletBalance();
    } catch (err) {
      console.error('Unexpected error updating wallet balance:', err);
    }
  };

  useEffect(() => {
    fetchWalletBalance();

    // Subscribe to real-time updates for the profile table
    const subscription = supabase
      .channel('wallet-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile' }, async (payload) => {
        const { data: user } = await supabase.auth.getUser();
        if (payload.new.user_id === user?.user?.id) {
          setWalletBalance(payload.new.wallet_balance); // Update wallet balance
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profile' }, async (payload) => {
        const { data: user } = await supabase.auth.getUser();
        if (payload.new.user_id === user?.user?.id) {
          setWalletBalance(payload.new.wallet_balance); // Update wallet balance
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe(); // Unsubscribe on component unmount
    };
  }, [session]); // Re-fetch balance instantly whenever session changes (logs in/out)

  return (
    <WalletContext.Provider value={{ walletBalance, refreshWallet: fetchWalletBalance, updateWalletBalance }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
