import React, { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  View,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useCartStore } from './cart-store';
import { useAuth } from './Providers/auth-provider';

const FloatingCartOverlay = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { items, getTotalPrice } = useCartStore();
  const { session } = useAuth();

  const [visible, setVisible] = useState(true);  // <-- added visibility state

  const pan = React.useRef(new Animated.ValueXY({ x: 20, y: 100 })).current;
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gs) =>
        Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        const { x, y } = (pan as any).__getValue?.() ?? { x: 0, y: 0 };
        pan.setOffset({ x, y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = getTotalPrice();

  if (!visible) return null;  // <-- hide if dismissed
  if (pathname === '/cart' || pathname === '/Deliveryaddress') return null;
  if (totalCount === 0) return null;
  if (!session) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.container, pan.getLayout()]}
    >
      <View style={styles.wrapper}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/cart')}
        >
          <Text style={styles.text}>
            🛒 {totalCount} | ${parseFloat(totalPrice).toFixed(2)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setVisible(false)}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeText}>×</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export default FloatingCartOverlay;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 10,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  button: {
    // no background here since wrapper already has it
    paddingHorizontal: 10,
  },
  text: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'red',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 19,
    textAlign: 'center',
  },
});
