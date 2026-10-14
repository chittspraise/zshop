import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import PaystackCheckoutModal from '../components/PaystackCheckoutModal';
import {
  PaystackCheckoutOptions,
  verifyPaystackTransaction,
  setPaystackModalOpener,
  getLastVerifiedReference,
  fetchCurrencyRates,
} from '../lib/paystack';

type PaystackContextType = {
  publicKey?: string;
  openPaystackCheckout: (
    amountOrOptions?: number | PaystackCheckoutOptions,
    optionalEmail?: string
  ) => Promise<boolean>;
  rates: Record<string, number>;
  selectedCurrency: string;
  setSelectedCurrency: (currency: string) => void;
  getConvertedAmount: (amountUSD: number, targetCurrency?: string) => number;
};

const PaystackContext = createContext<PaystackContextType>({
  openPaystackCheckout: async () => false,
  rates: { USD: 1.0 },
  selectedCurrency: 'ZAR',
  setSelectedCurrency: () => {},
  getConvertedAmount: (a) => a,
});

export const usePaystackContext = () => useContext(PaystackContext);
export const usePaystack = () => useContext(PaystackContext);

export default function PaystackProvider({
  children,
  publicKey,
}: {
  children: React.ReactNode;
  publicKey?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | undefined>();
  const [reference, setReference] = useState<string | undefined>();
  const [amountDisplay, setAmountDisplay] = useState<number | string | undefined>();
  const [activeCurrency, setActiveCurrency] = useState<string>('ZAR');
  const [amountUSD, setAmountUSD] = useState<number | undefined>();

  const [selectedCurrency, setSelectedCurrency] = useState<string>('ZAR');
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1.0 });

  const resolverRef = useRef<((success: boolean) => void) | null>(null);

  // Fetch real-time exchange rates from Supabase on load
  useEffect(() => {
    fetchCurrencyRates()
      .then((liveRates) => {
        if (liveRates && Object.keys(liveRates).length > 0) {
          setRates(liveRates);
        }
      })
      .catch((err) => console.warn('Could not fetch real-time rates in provider:', err));
  }, []);

  const getConvertedAmount = (usd: number, targetCurrency?: string): number => {
    const curr = (targetCurrency || selectedCurrency).toUpperCase();
    const rate = Number(rates[curr]) || 1.0;
    return Math.round(usd * rate * 100) / 100;
  };

  const handleOpenCheckout = async (
    amountOrOptions?: number | PaystackCheckoutOptions,
    optionalEmail?: string
  ): Promise<boolean> => {
    return new Promise(async (resolve) => {
      try {
        let inputAmountUSD: number | undefined;
        let directSubunits: number | undefined;
        let email = optionalEmail;
        let currency = selectedCurrency;
        let metadata: Record<string, any> | undefined;

        if (typeof amountOrOptions === 'number') {
          inputAmountUSD = amountOrOptions;
        } else if (typeof amountOrOptions === 'object' && amountOrOptions !== null) {
          if (amountOrOptions.amountUSD !== undefined) {
            inputAmountUSD = amountOrOptions.amountUSD;
          } else if (amountOrOptions.totalAmount !== undefined) {
            inputAmountUSD = amountOrOptions.totalAmount > 1000
              ? amountOrOptions.totalAmount / 100
              : amountOrOptions.totalAmount;
          }
          email = amountOrOptions.email ?? email;
          currency = amountOrOptions.currency ?? currency;
          metadata = amountOrOptions.metadata;
        }

        if (!email) {
          const { data: { user } } = await supabase.auth.getUser();
          email = user?.email;
        }

        if (!email) {
          console.error('User email required for Paystack');
          resolve(false);
          return;
        }

        // Initialize with backend currency conversion
        const { data, error } = await supabase.functions.invoke('paystack-checkout', {
          body: {
            action: 'initialize',
            amountUSD: inputAmountUSD,
            totalAmount: directSubunits,
            email,
            currency,
            metadata,
            callback_url: 'https://standard.paystack.co/close',
          },
        });

        if (error || !data?.authorization_url || !data?.reference) {
          console.error('Failed to initialize Paystack transaction:', error || data?.error);
          resolve(false);
          return;
        }

        resolverRef.current = resolve;
        setAuthUrl(data.authorization_url);
        setReference(data.reference);
        setAmountDisplay(data.convertedAmount ?? data.amountUSD);
        setActiveCurrency(data.currency || currency);
        setAmountUSD(data.amountUSD);
        setModalVisible(true);
      } catch (err) {
        console.error('Error starting Paystack in-app checkout:', err);
        resolve(false);
      }
    });
  };

  useEffect(() => {
    setPaystackModalOpener(handleOpenCheckout);
  }, [rates, selectedCurrency]);

  const handleSuccess = async (ref: string) => {
    setModalVisible(false);
    const targetRef = ref || reference;
    if (!targetRef) {
      if (resolverRef.current) resolverRef.current(false);
      return;
    }

    const verified = await verifyPaystackTransaction(targetRef);
    if (resolverRef.current) {
      resolverRef.current(verified);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  return (
    <PaystackContext.Provider
      value={{
        publicKey,
        openPaystackCheckout: handleOpenCheckout,
        rates,
        selectedCurrency,
        setSelectedCurrency,
        getConvertedAmount,
      }}
    >
      {children}

      {/* Native In-App Paystack Modal */}
      <PaystackCheckoutModal
        visible={modalVisible}
        authorizationUrl={authUrl}
        reference={reference}
        amountDisplay={amountDisplay}
        currency={activeCurrency}
        amountUSD={amountUSD}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </PaystackContext.Provider>
  );
}
