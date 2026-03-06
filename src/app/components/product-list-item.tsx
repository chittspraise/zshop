import React, { useState } from 'react';
import { StyleSheet, Pressable, Text, View, Image } from 'react-native';
import { Link } from 'expo-router';
import { Tables } from '../../types/database.types';
import { useCartStore } from '../cart-store';

export const ProductListItem = ({
  product,
}: {
  product: Tables<'product'>;
}) => {
  const { addItem, incrementItem, decrementItem, items } = useCartStore();
  const cartItem = items.find(item => item.id === product.id);
  const quantity = cartItem ? cartItem.quantity : 0;

  const increase = () => {
    if (quantity === 0) {
      addItem({
        id: product.id,
        title: product.title,
        price: product.price,
        quantity: 1,
        heroImage: product.heroImage,
      });
    } else {
      incrementItem(product.id);
    }
  };

  const decrease = () => {
    decrementItem(product.id);
  };

  return (
    <View style={styles.item}>
      <Link asChild href={`/product/${product.slug}`}>
        <Pressable>
          <View style={styles.itemImageContainer}>
            <Image source={{ uri: product.heroImage as string }} style={styles.itemImage} />
          </View>
          <View style={styles.itemTextContainer}>
            <Text style={styles.itemTitle}>{product.title}</Text>
            <Text style={styles.itemPrice}>R{product.price.toFixed(2)}</Text>
            {product.Status === 'out of stock' && (
              <Text style={styles.productStatus}>Out of stock</Text>
            )}
          </View>
        </Pressable>
      </Link>

      {product.Status !== 'out of stock' && (
        <View style={styles.cartControls}>
          {quantity === 0 ? (
            <Pressable style={styles.addButton} onPress={increase}>
              <Text style={styles.addButtonText}>Add to cart</Text>
            </Pressable>
          ) : (
            <View style={styles.quantityContainer}>
              <Pressable style={styles.controlButton} onPress={decrease}>
                <Text style={styles.controlText}>-</Text>
              </Pressable>
              <Text style={styles.quantityText}>{quantity}</Text>
              <Pressable style={styles.controlButton} onPress={increase}>
                <Text style={styles.controlText}>+</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    width: '48%',
    backgroundColor: 'white',
    marginVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  itemImageContainer: {
    height: 150,
    width: '90%',
    borderRadius: 10,
    alignSelf: 'center',
  },
  itemImage: {
    height: '100%',
    width: '100%',
    resizeMode: 'contain',
  },
  itemTextContainer: {
    padding: 8,
    alignItems: 'flex-start',
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    color: 'black',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  productStatus: {
    fontSize: 14,
    color: 'red',
  },
  cartControls: {
    paddingHorizontal: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addButton: {
    width: '100%',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'lightgreen',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: { width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: 'lightgreen',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  controlText: {
    color: 'white',
    fontSize: 18,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
