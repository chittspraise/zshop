import React, { createContext, useContext } from 'react';

type PaystackContextType = {
  publicKey?: string;
};

const PaystackContext = createContext<PaystackContextType>({});

export const usePaystackContext = () => useContext(PaystackContext);

export default function PaystackProvider({
  children,
  publicKey,
}: {
  children: React.ReactNode;
  publicKey?: string;
}) {
  return (
    <PaystackContext.Provider value={{ publicKey }}>
      {children}
    </PaystackContext.Provider>
  );
}
