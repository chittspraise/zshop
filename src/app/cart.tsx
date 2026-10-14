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
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useCartStore } from './cart-store';
import { createOrder, createOrderItem } from './api/api';
import {
  getLastVerifiedReference,
  fetchUserSavedCards,
  chargeSavedCard,
  deleteUserCard,
  SavedCard,
} from './lib/paystack';
import { usePaystack } from './Providers/PaystackProvider';
import { useWallet } from './Providers/Wallet-provider';
import { useNavigation, useRouter } from 'expo-router';
import { supabase } from './lib/supabase';
import { useToast } from 'react-native-toast-notifications';

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

const CURRENCIES = [
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'ZAR', symbol: 'R', label: 'ZAR (R)' },
  { code: 'NGN', symbol: '₦', label: 'NGN (₦)' },
  { code: 'GHS', symbol: 'GH₵', label: 'GHS (GH₵)' },
  { code: 'KES', symbol: 'KSh', label: 'KES (KSh)' },
];

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
  const {
    openPaystackCheckout,
    selectedCurrency,
    setSelectedCurrency,
    getConvertedAmount,
  } = usePaystack();

  const [walletToggle, setWalletToggle] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>('new');
  const [saveCardToggle, setSaveCardToggle] = useState(true);

  const [recipientAddress, setRecipientAddress] = useState<{
    recipientAddress: string;
    latitude: number;
    longitude: number;
    verified: boolean;
  } | null>(null);
  const [groceryNotes, setGroceryNotes] = useState('');

  // Load recipient address & saved cards on focus
  const loadUserData = async () => {
    try {
      const stored = await AsyncStorage.getItem('recipient_address');
      if (stored) {
        setRecipientAddress(JSON.parse(stored));
      } else {
        setRecipientAddress(null);
      }

      // Fetch user saved cards from Supabase
      const cards = await fetchUserSavedCards();
      setSavedCards(cards);
      if (cards.length > 0 && selectedCardId === 'new') {
        setSelectedCardId(cards[0].id);
      }
    } catch (e) {
      console.error('Error loading data in cart:', e);
    }
  };

  useEffect(() => {
    loadUserData();
    const unsubscribe = navigation.addListener('focus', loadUserData);
    return unsubscribe;
  }, [navigation]);

  const totalPriceUSD = parseFloat(getTotalPrice()) || 0;
  const convertedTotal = getConvertedAmount(totalPriceUSD, selectedCurrency);

  const handleDeleteCard = (card: SavedCard) => {
    Alert.alert(
      'Remove Card?',
      `Are you sure you want to remove your ${card.card_type?.toUpperCase() || 'Card'} ending in ${card.last4}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteUserCard(card.id);
            if (success) {
              const updated = savedCards.filter((c) => c.id !== card.id);
              setSavedCards(updated);
              if (selectedCardId === card.id) {
                setSelectedCardId(updated.length > 0 ? updated[0].id : 'new');
              }
              toast.show('Card removed successfully', { type: 'success', placement: 'top' });
            }
          },
        },
      ]
    );
  };

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

    const description = items
      .map(item => `${item.quantity}x ${item.title} ($${(item.price * item.quantity).toFixed(2)})`)
      .join('\n');

    const submitOrder = async (overrideRef?: string) => {
      const paymentReference = overrideRef || getLastVerifiedReference() || undefined;
      await createSupabaseOrder(
        {
          totalPrice: totalPriceUSD,
          description,
          delivery_address: finalAddress,
          latitude: finalLat,
          longitude: finalLng,
          grocery_notes: groceryNotes,
          payment_reference: paymentReference,
          payment_gateway: 'paystack',
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

            if (walletToggle) {
              const walletPaidAmount = (walletBalance ?? 0) >= totalPriceUSD ? totalPriceUSD : (walletBalance ?? 0);
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
      setIsProcessing(true);

      const targetCard = savedCards.find((c) => c.id === selectedCardId);

      if (walletToggle) {
        if ((walletBalance ?? 0) >= totalPriceUSD) {
          // Covered entirely by wallet, no Paystack needed
          await updateWalletBalance((walletBalance ?? 0) - totalPriceUSD);
          await submitOrder();
          return;
        } else {
          // Covered partially by wallet, remaining charged by Paystack
          const remainingUSD = totalPriceUSD - (walletBalance ?? 0);

          if (targetCard && selectedCardId !== 'new') {
            // 1-Click Pay with Saved Card
            const chargeResult = await chargeSavedCard({
              authorizationCode: targetCard.authorization_code,
              amountUSD: remainingUSD,
              currency: selectedCurrency,
              email: user.email,
              userId: user.id,
            });

            if (!chargeResult.success) {
              toast.show(`Payment failed: ${chargeResult.error || 'Card declined'}`, {
                type: 'danger',
                placement: 'top',
              });
              setIsProcessing(false);
              return;
            }

            await updateWalletBalance(0);
            await submitOrder(chargeResult.reference);
            return;
          } else {
            // In-App Modal for New Card
            const success = await openPaystackCheckout({
              amountUSD: remainingUSD,
              currency: selectedCurrency,
              email: user.email,
              userId: user.id,
              saveCard: saveCardToggle,
            });

            if (!success) {
              setIsProcessing(false);
              return;
            }

            await updateWalletBalance(0);
            await submitOrder();
            return;
          }
        }
      } else {
        // Covered entirely by Paystack
        if (targetCard && selectedCardId !== 'new') {
          // 1-Click Pay with Saved Card
          const chargeResult = await chargeSavedCard({
            authorizationCode: targetCard.authorization_code,
            amountUSD: totalPriceUSD,
            currency: selectedCurrency,
            email: user.email,
            userId: user.id,
          });

          if (!chargeResult.success) {
            toast.show(`Payment failed: ${chargeResult.error || 'Card declined'}`, {
              type: 'danger',
              placement: 'top',
            });
            setIsProcessing(false);
            return;
          }

          await submitOrder(chargeResult.reference);
          return;
        } else {
          // In-App Modal for New Card
          const success = await openPaystackCheckout({
            amountUSD: totalPriceUSD,
            currency: selectedCurrency,
            email: user.email,
            userId: user.id,
            saveCard: saveCardToggle,
          });

          if (!success) {
            setIsProcessing(false);
            return;
          }

          await submitOrder();
          return;
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.show(error.message || 'Error: An error occurred during checkout.', {
        type: 'danger',
        placement: 'top',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const activeSavedCard = savedCards.find((c) => c.id === selectedCardId);

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
              <Text style={styles.recipientCardTitle}>Recipient Address</Text>
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
              ⚠️ Set Recipient Address
            </Text>
          </TouchableOpacity>
        )}

        {/* Currency Selector */}
        <View style={styles.currencySection}>
          <View style={styles.currencyHeaderRow}>
            <Text style={styles.currencyLabel}>Payment Currency</Text>
            <Text style={styles.currencySubLabel}>Real-time Supabase Rate</Text>
          </View>
          <View style={styles.currencyPills}>
            {CURRENCIES.map((c) => {
              const isSelected = selectedCurrency === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.currencyPill, isSelected && styles.currencyPillActive]}
                  onPress={() => setSelectedCurrency(c.code)}
                >
                  <Text style={[styles.currencyPillText, isSelected && styles.currencyPillTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Saved Cards Section */}
        {savedCards.length > 0 && (
          <View style={styles.savedCardsSection}>
            <View style={styles.savedCardsHeaderRow}>
              <Text style={styles.savedCardsLabel}>Saved Payment Cards</Text>
              <Text style={styles.savedCardsSubLabel}>⚡ 1-Click Checkout</Text>
            </View>

            {savedCards.map((card) => {
              const isSelected = selectedCardId === card.id;
              const brand = card.card_type?.toUpperCase() || 'CARD';
              return (
                <View
                  key={card.id}
                  style={[styles.cardItemRow, isSelected && styles.cardItemRowActive]}
                >
                  <TouchableOpacity
                    style={styles.cardItemSelectable}
                    onPress={() => setSelectedCardId(card.id)}
                  >
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioInnerCircle} />}
                    </View>
                    <View style={styles.cardDetails}>
                      <Text style={styles.cardBrandText}>
                        💳 {brand} •••• {card.last4}
                      </Text>
                      <Text style={styles.cardExpiryText}>
                        Expires {card.exp_month}/{card.exp_year}
                        {card.bank ? ` • ${card.bank}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteCardButton}
                    onPress={() => handleDeleteCard(card)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteCardButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Option to use a new card */}
            <TouchableOpacity
              style={[styles.newCardOption, selectedCardId === 'new' && styles.newCardOptionActive]}
              onPress={() => setSelectedCardId('new')}
            >
              <View style={[styles.radioCircle, selectedCardId === 'new' && styles.radioCircleActive]}>
                {selectedCardId === 'new' && <View style={styles.radioInnerCircle} />}
              </View>
              <Text style={styles.newCardOptionText}>+ Use a different card or method</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Save Card Toggle for New Cards */}
        {selectedCardId === 'new' && (
          <TouchableOpacity
            style={styles.saveCardToggleContainer}
            onPress={() => setSaveCardToggle(!saveCardToggle)}
          >
            <View style={[styles.checkbox, saveCardToggle && styles.checkboxActive]}>
              {saveCardToggle && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.saveCardToggleText}>
              Save card for fast 1-click payments next time
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
          {/* Price Breakdown */}
          <View style={styles.priceContainer}>
            <Text style={styles.totalTextUSD}>
              Total: ${totalPriceUSD.toFixed(2)} USD
            </Text>
            {selectedCurrency !== 'USD' && (
              <Text style={styles.convertedText}>
                ≈ {selectedCurrency} {convertedTotal.toFixed(2)}
              </Text>
            )}
          </View>

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
            disabled={isProcessing}
            onPress={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                Alert.alert('Error', 'User not logged in');
                return;
              }

              if (!recipientAddress) {
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
            style={[styles.checkoutButton, isProcessing && styles.checkoutButtonDisabled]}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.checkoutButtonText}>
                {activeSavedCard && selectedCardId !== 'new'
                  ? `⚡ 1-Click Pay (${selectedCurrency} ${convertedTotal.toFixed(2)})`
                  : `Checkout (${selectedCurrency} ${convertedTotal.toFixed(2)})`}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

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
  priceContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  totalTextUSD: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  convertedText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0284c7',
    marginTop: 2,
  },
  checkoutButton: {
    backgroundColor: '#28a745',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 8,
    minWidth: 220,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    opacity: 0.7,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
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
    marginBottom: 12,
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
    marginBottom: 12,
  },
  recipientCardEmptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c53030',
  },
  currencySection: {
    marginHorizontal: 4,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  currencyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  currencyLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currencySubLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  currencyPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  currencyPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  currencyPillActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  currencyPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  currencyPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  savedCardsSection: {
    marginHorizontal: 4,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  savedCardsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savedCardsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedCardsSubLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  cardItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  cardItemRowActive: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  cardItemSelectable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardDetails: {
    marginLeft: 10,
  },
  cardBrandText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardExpiryText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  deleteCardButton: {
    padding: 6,
    marginLeft: 8,
  },
  deleteCardButtonText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },
  newCardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginTop: 4,
  },
  newCardOptionActive: {
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
  },
  newCardOptionText: {
    marginLeft: 10,
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#0284c7',
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0284c7',
  },
  saveCardToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 6,
    marginBottom: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#64748b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  checkboxCheck: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  saveCardToggleText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  notesContainer: {
    marginHorizontal: 4,
    marginBottom: 12,
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
