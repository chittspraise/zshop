import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { getMyOrder } from '../../api/api';
import React from 'react';

const OrderDetails = () => {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: order, error, isLoading } = getMyOrder(slug);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error || !order) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Error: {error?.message || 'Order not found'}
        </Text>
      </View>
    );
  }

  // Create individual items based on quantity, and include status directly
  const orderItems = order.order_item.flatMap((orderItem: any) => {
    const individualItems = [];
    for (let i = 0; i < orderItem.quantity; i++) {
      individualItems.push({
        id: `${orderItem.id}_${i}`,
        title: orderItem.products?.title || 'Item',
        heroImage: orderItem.products?.heroImage,
        price: orderItem.products?.price ?? 0,
        status: orderItem.status,
      });
    }
    return individualItems;
  });

  const renderHeader = () => (
    <View>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderSlugText}>Order #{order.slug}</Text>
          <Text style={styles.date}>
            {format(new Date(order.created_at), 'MMM dd, yyyy • HH:mm')}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            styles[`statusBadge_${order.status?.replace(' ', '')}`] ||
              styles.statusBadge_Default,
          ]}
        >
          <Text style={styles.statusText}>{order.status}</Text>
        </View>
      </View>

      {order.description ? (
        <Text style={styles.details}>{order.description}</Text>
      ) : null}

      {/* Shop Collection Card when Accepted */}
      {order.shop_name ? (
        <View style={styles.collectionCard}>
          <View style={styles.collectionHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="storefront" size={22} color="#15803d" />
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.collectionTitle}>Ready for Collection</Text>
              <Text style={styles.collectionSubtitle}>
                Collect your order at this shop:
              </Text>
            </View>
          </View>

          <View style={styles.shopDivider} />

          <Text style={styles.shopName}>{order.shop_name}</Text>

          {order.shop_address ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#4b5563" />
              <Text style={styles.infoText}>{order.shop_address}</Text>
            </View>
          ) : null}

          {order.shop_owner_name ? (
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={18} color="#4b5563" />
              <Text style={styles.infoText}>Contact: {order.shop_owner_name}</Text>
            </View>
          ) : null}

          {order.shop_phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color="#4b5563" />
              <Text style={styles.infoText}>
                {order.shop_phone.replace('whatsapp:', '')}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionButtonsRow}>
            {order.shop_address ? (
              <TouchableOpacity
                style={styles.actionButtonPrimary}
                onPress={() => {
                  const query =
                    order.shop_latitude && order.shop_longitude
                      ? `${order.shop_latitude},${order.shop_longitude}`
                      : encodeURIComponent(order.shop_address || '');
                  Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${query}`
                  );
                }}
              >
                <Ionicons name="navigate-outline" size={15} color="#fff" />
                <Text style={styles.actionButtonPrimaryText}>Directions</Text>
              </TouchableOpacity>
            ) : null}

            {order.shop_phone ? (
              <TouchableOpacity
                style={styles.actionButtonSecondary}
                onPress={() => {
                  const cleanPhone = order.shop_phone!
                    .replace('whatsapp:', '')
                    .replace('+', '')
                    .trim();
                  Linking.openURL(`https://wa.me/${cleanPhone}`);
                }}
              >
                <Ionicons name="logo-whatsapp" size={15} color="#25D366" />
                <Text style={styles.actionButtonSecondaryText}>WhatsApp</Text>
              </TouchableOpacity>
            ) : null}

            {order.shop_phone ? (
              <TouchableOpacity
                style={styles.actionButtonCall}
                onPress={() => {
                  const cleanPhone = order.shop_phone!
                    .replace('whatsapp:', '')
                    .replace(/\s+/g, '')
                    .trim();
                  Linking.openURL(`tel:${cleanPhone}`);
                }}
              >
                <Ionicons name="call-outline" size={15} color="#15803d" />
                <Text style={styles.actionButtonCallText}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.instructionBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#1e40af" />
            <Text style={styles.instructionText}>
              Show Order ID <Text style={{ fontWeight: 'bold' }}>#{order.slug}</Text> to staff at pickup.
            </Text>
          </View>
        </View>
      ) : order.status === 'Received' ? (
        <View style={styles.pendingCard}>
          <Ionicons name="hourglass-outline" size={22} color="#854d0e" />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.pendingTitle}>Waiting for Shop Acceptance</Text>
            <Text style={styles.pendingText}>
              Nearby shops have been notified. Once a shop accepts your order, their collection address and contact details will appear here.
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={styles.itemsTitle}>Items Ordered:</Text>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <View style={styles.horizontalLine} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Price:</Text>
        <Text style={styles.totalValue}>${order.totalPrice?.toFixed(2)}</Text>
      </View>
      {order.status !== 'Received' && order.refunded_amount ? (
        <Text style={styles.refundText}>
          Refund: ${order.refunded_amount.toFixed(2)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Order #${order.slug}` }} />

      <FlatList
        data={orderItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.orderItem}>
            {item.heroImage ? (
              <Image source={{ uri: item.heroImage }} style={styles.heroImage} />
            ) : (
              <View style={[styles.heroImage, styles.imagePlaceholder]}>
                <Ionicons name="cube-outline" size={32} color="#9ca3af" />
              </View>
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.title}</Text>
              <Text style={styles.itemPrice}>Price: ${item.price}</Text>
              {item.status?.trim().toLowerCase() === 'out of stock' && (
                <Text style={[styles.itemStatus, { color: 'red' }]}>
                  Status: {item.status}
                </Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
};

export default OrderDetails;

const styles: { [key: string]: any } = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderSlugText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  date: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  details: {
    fontSize: 14,
    color: '#4b5563',
    marginVertical: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadge_Received: {
    backgroundColor: '#d97706',
  },
  statusBadge_Ready: {
    backgroundColor: '#16a34a',
  },
  statusBadge_Declined: {
    backgroundColor: '#dc2626',
  },
  statusBadge_Completed: {
    backgroundColor: '#16a34a',
  },
  statusBadge_Default: {
    backgroundColor: '#4b5563',
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },

  /* Collection Card Styles */
  collectionCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#86efac',
    padding: 16,
    marginVertical: 14,
    shadowColor: '#15803d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  collectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#15803d',
  },
  collectionSubtitle: {
    fontSize: 12,
    color: '#166534',
    marginTop: 1,
  },
  shopDivider: {
    height: 1,
    backgroundColor: '#bbf7d0',
    marginVertical: 12,
  },
  shopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#15803d',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionButtonSecondaryText: {
    color: '#15803d',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  actionButtonCall: {
    flex: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionButtonCallText: {
    color: '#15803d',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  instructionText: {
    fontSize: 12,
    color: '#1e40af',
    marginLeft: 6,
    flex: 1,
  },

  /* Pending Notification Card */
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fefce8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fef08a',
    padding: 14,
    marginVertical: 12,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#854d0e',
  },
  pendingText: {
    fontSize: 12,
    color: '#a16207',
    marginTop: 2,
    lineHeight: 16,
  },

  itemsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 14,
    marginBottom: 8,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  heroImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    resizeMode: 'contain',
    backgroundColor: '#f3f4f6',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 3,
  },
  itemStatus: {
    fontSize: 12,
    marginTop: 3,
  },
  footer: {
    marginTop: 16,
    paddingVertical: 12,
  },
  horizontalLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  refundText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#dc2626',
    marginTop: 6,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 24,
  },
});
