import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Platform,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  SafeAreaView,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useCartStore } from './cart-store';
import { createOrder, createOrderItem } from './api/api';
import { openStripeCheckout, setupStripePaymentSheet } from './lib/stripe';
import { useWallet } from './Providers/Wallet-provider';
import { useNavigation, useRouter } from 'expo-router';
import { supabase } from './lib/supabase';
import { useToast } from 'react-native-toast-notifications';
import { Alert } from 'react-native';

type CartItemType = {
  id: number;
  title: string;
  heroImage: string;
  price: number;
  quantity: number;
};

type CartItemProps = {
  item: CartItemType;
  onRemove: (id: number) => void;
  onIncrement: (id: number) => void;
  onDecrement: (id: number) => void;
};

const CartItem = ({
  item,
  onDecrement,
  onIncrement,
  onRemove,
}: CartItemProps) => {
  return (
    <View style={styles.cartItem}>
      <Image source={{ uri: item.heroImage }} style={styles.itemImage} />
      <View style={styles.itemDetails}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            onPress={() => onDecrement(item.id)}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.itemQuantity}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => onIncrement(item.id)}
            style={styles.quantityButton}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => onRemove(item.id)}
        style={styles.removeButton}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function Cart() {
  const {
    items,
    removeItem,
    incrementItem,
    decrementItem,
    getTotalPrice,
    resetCart,
  } = useCartStore();

  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const { mutateAsync: createSupabaseOrder } = createOrder();
  const { mutateAsync: createSupabaseOrderItem } = createOrderItem();
  const { walletBalance, updateWalletBalance } = useWallet();

  const [walletToggle, setWalletToggle] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState<{
    recipientAddress: string;
    latitude: number;
    longitude: number;
    verified: boolean;
  } | null>(null);
  const [groceryNotes, setGroceryNotes] = useState('');

  // Load recipient address on focus
  useEffect(() => {
    const loadAddress = async () => {
      try {
        const stored = await AsyncStorage.getItem('recipient_address');
        if (stored) {
          setRecipientAddress(JSON.parse(stored));
        } else {
          setRecipientAddress(null);
        }
      } catch (e) {
        console.error('Error loading recipient address in cart:', e);
      }
    };
    loadAddress();
    const unsubscribe = navigation.addListener('focus', loadAddress);
    return unsubscribe;
  }, [navigation]);

  const handleCheckout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.show('Error: User not logged in', { type: 'danger', placement: 'top' });
      return;
    }

    let finalAddress = '';
    let finalLat: number | undefined = undefined;
    let finalLng: number | undefined = undefined;

    if (recipientAddress) {
      finalAddress = recipientAddress.recipientAddress;
      finalLat = recipientAddress.latitude;
      finalLng = recipientAddress.longitude;
    } else {
      // Fetch full profile info for order dispatch fallback
      const { data: profileData, error: profileError } = await supabase
        .from('profile')
        .select('address, latitude, longitude')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profileData || !profileData.address) {
        toast.show('Error: Delivery address is missing or invalid.', {
          type: 'danger',
          placement: 'top',
        });
        return;
      }
      finalAddress = profileData.address;
      finalLat = profileData.latitude ?? undefined;
      finalLng = profileData.longitude ?? undefined;
    }

    const totalPrice = parseFloat(getTotalPrice());
    const description = items
      .map(item => `${item.quantity}x ${item.title} ($${(item.price * item.quantity).toFixed(2)})`)
      .join('\n');

    const submitOrder = async () => {
      await createSupabaseOrder(
        {
          totalPrice,
          description,
          delivery_address: finalAddress,
          latitude: finalLat,
          longitude: finalLng,
          grocery_notes: groceryNotes,
        },
        {
          onSuccess: async (data) => {
            await createSupabaseOrderItem({
              insertData: items.map(item => ({
                orderId: data.id,
                productId: item.id,
                quantity: item.quantity,
              })),
            });

            // Log wallet transaction if wallet was used
            if (walletToggle) {
              const walletPaidAmount = (walletBalance ?? 0) >= totalPrice ? totalPrice : (walletBalance ?? 0);
              await (supabase as any).from('wallet_transactions').insert({
                user_id: user.id,
                amount: -walletPaidAmount,
                type: 'payment',
                description: `Payment for order: ${data.slug}`
              });
            }

            toast.show('🎉 Payment successful! Your order has been placed.', {
              type: 'success',
              placement: 'top',
              duration: 3000,
            });
            resetCart();
            router.replace('/');
          },
        }
      );
    };

    try {
      if (walletToggle) {
        if ((walletBalance ?? 0) >= totalPrice) {
          // Covered entirely by wallet, no Stripe needed
          await updateWalletBalance((walletBalance ?? 0) - totalPrice);
        } else {
          // Covered partially by wallet, remaining covered by Stripe
          const remainingAmount = totalPrice - (walletBalance ?? 0);
          await setupStripePaymentSheet(Math.round(remainingAmount * 100));
          const success = await openStripeCheckout();
          if (!success) return;
          await updateWalletBalance(0);
        }
      } else {
        // Covered entirely by Stripe card
        await setupStripePaymentSheet(Math.round(totalPrice * 100));
        const success = await openStripeCheckout();
        if (!success) return;
      }
      
      await submitOrder();
    } catch (error: any) {
      console.error(error);
      toast.show(error.message || 'Error: An error occurred during checkout.', {
        type: 'danger',
        placement: 'top',
      });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.container}>
        <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />

        <FlatList
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <CartItem
              item={item}
              onRemove={removeItem}
              onIncrement={incrementItem}
              onDecrement={decrementItem}
            />
          )}
          contentContainerStyle={styles.cartList}
        />

        {recipientAddress ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('RecipientAddressScreen' as never)}
            style={styles.recipientCard}
          >
            <View style={styles.recipientCardHeader}>
              <Text style={styles.recipientCardTitle}>Deliver to Recipient</Text>
              <Text style={styles.recipientCardChange}>Change</Text>
            </View>
            <Text style={styles.recipientCardAddress} numberOfLines={2}>
              {recipientAddress.recipientAddress}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.navigate('RecipientAddressScreen' as never)}
            style={styles.recipientCardEmpty}
          >
            <Text style={styles.recipientCardEmptyText}>
              ⚠️ Set Recipient Delivery Address
            </Text>
          </TouchableOpacity>
        )}

        {/* Grocery List Note Field */}
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>Grocery List Note</Text>
          <View style={styles.notesWrapper}>
            <TextInput
              style={styles.notesInput}
              placeholder="Write any other items or custom instructions here..."
              placeholderTextColor="#94a3b8"
              value={groceryNotes}
              onChangeText={setGroceryNotes}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.totalText}>Total: ${getTotalPrice()}</Text>

          <View style={walletToggleContainerStyle.walletToggleContainer}>
            <TouchableOpacity
              style={styles.walletToggleButton}
              onPress={() => setWalletToggle(!walletToggle)}
            >
              <Text
                style={[
                  styles.walletToggleButtonText,
                  walletToggle && styles.walletToggleButtonTextActive,
                ]}
              >
                Wallet Payment: {walletToggle ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Error', 'User not logged in');
                return;
              }

              if (!recipientAddress) {
                // Fallback to check profile address
                const { data: profileData, error: profileError } = await supabase
                  .from('profile')
                  .select('address')
                  .eq('user_id', user.id)
                  .maybeSingle();

                if (profileError) {
                  console.error('Error fetching profile:', profileError);
                }

                if (!profileData || !profileData.address) {
                  Alert.alert(
                    'Address Required',
                    'Please select a delivery address for the recipient first.',
                    [
                      {
                        text: 'Select Address',
                        onPress: () => navigation.navigate('RecipientAddressScreen' as never),
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                  return;
                }
              }

              handleCheckout();
            }}
            style={styles.checkoutButton}
          >
            <Text style={styles.checkoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Separate container style to bypass style duplicate rule if any
const walletToggleContainerStyle = {
  walletToggleContainer: {
    marginVertical: 10,
    alignItems: 'center' as const,
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  cartList: {
    paddingVertical: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    color: '#888',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  removeButton: {
    padding: 8,
    backgroundColor: '#ff5252',
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  checkoutButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#ddd',
    marginHorizontal: 5,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  walletToggleButton: {
    padding: 10,
    backgroundColor: '#ccc',
    borderRadius: 5,
  },
  walletToggleButtonText: {
    fontSize: 16,
  },
  walletToggleButtonTextActive: {
    color: 'green',
  },
  recipientCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#1BC464',
    marginBottom: 16,
  },
  recipientCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recipientCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1BC464',
    letterSpacing: 0.5,
  },
  recipientCardChange: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1BC464',
  },
  recipientCardAddress: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 18,
  },
  recipientCardEmpty: {
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#feb2b2',
    alignItems: 'center',
    marginBottom: 16,
  },
  recipientCardEmptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c53030',
  },
  notesContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesWrapper: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notesInput: {
    fontSize: 13,
    color: '#1e293b',
    height: 48,
    textAlignVertical: 'top',
  },
});
