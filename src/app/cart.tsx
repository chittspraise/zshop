import React, { useState } from 'react';
import {
  View,
  Text,
  Platform,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCartStore } from './cart-store';
import { createOrder, createOrderItem } from './api/api';
import { openStripeCheckout, setupStripePaymentSheet } from './lib/stripe';
import { useWallet } from './Providers/Wallet-provider';
import { useNavigation } from 'expo-router';
import { supabase } from './lib/supabase';

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
        <Text style={styles.itemPrice}>R{item.price.toFixed(2)}</Text>
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

  const navigation = useNavigation();
  const { mutateAsync: createSupabaseOrder } = createOrder();
  const { mutateAsync: createSupabaseOrderItem } = createOrderItem();
  const { walletBalance, updateWalletBalance } = useWallet();

  const [walletToggle, setWalletToggle] = useState(false);

  const handleCheckout = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Error: User not logged in');
      return;
    }

    const totalPrice = parseFloat(getTotalPrice());

    const submitOrder = async () => {
      await createSupabaseOrder(
        { totalPrice },
        {
          onSuccess: async (data) => {
            await createSupabaseOrderItem({
              insertData: items.map(item => ({
                orderId: data.id,
                productId: item.id,
                quantity: item.quantity,
              })),
            });
            alert('Order created successfully');
            resetCart();
          },
        }
      );
    };

    try {
      // TEMPORARY BYPASS: Skip Stripe and proceed as if payment went through
      console.log('Bypassing Stripe payment flow...');
      if (walletToggle) {
        if ((walletBalance ?? 0) >= totalPrice) {
          await updateWalletBalance((walletBalance ?? 0) - totalPrice);
        } else {
          // Empty wallet if partially paying, pretending the rest was covered by card
          await updateWalletBalance(0);
        }
      }
      
      await submitOrder();
    } catch (error) {
      console.error(error);
      alert('Error: An error occurred during checkout.');
    }
  };

  return (
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

      <TouchableOpacity onPress={() => navigation.navigate('Deliveryaddress' as never)}>
        <Text style={{ color: 'red', marginBottom: 10 }}>
          Please make sure your Address is correct or set it here
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.totalText}>Total: R{getTotalPrice()}</Text>

        <View style={styles.walletToggleContainer}>
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

            const { data: profileData, error: profileError } = await supabase
              .from('profile')
              .select('address')
              .eq('user_id', user.id)
              .maybeSingle();

            if (profileError) {
              console.error('Error fetching profile:', profileError);
              alert('Error: Could not fetch profile information.');
              return;
            }

            if (!profileData || !profileData.address) {
              navigation.navigate('Deliveryaddress' as never);
              return;
            }

            handleCheckout();
          }}
          style={styles.checkoutButton}
        >
          <Text style={styles.checkoutButtonText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


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
  walletToggleContainer: {
    marginVertical: 10,
    alignItems: 'center',
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
});
