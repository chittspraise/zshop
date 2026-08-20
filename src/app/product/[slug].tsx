import * as React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  ScrollView,
} from 'react-native';
import { Stack, Redirect, useLocalSearchParams } from 'expo-router';
import { useToast } from 'react-native-toast-notifications';

import { getProduct, getProductsAndCategories } from '../api/api';
import { useState, useEffect, useMemo } from 'react';
import { useCartStore } from '../cart-store';

// Define Product type if not already defined
interface Product {
  id: string;
  title: string;
  price: number;
  heroImage: string;
  description: string;
  imagesUrl: string[];
  categoryId?: string;
  Status?: string;
}

const ProductDetails = () => {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const toast = useToast();

  // Fetch main product
  const { data: product, error, isLoading } = getProduct(slug);

  // Fetch all products and categories to derive related products
  const {
    data: productsAndCategories,
    error: relatedError,
    isLoading: relatedLoading,
  } = getProductsAndCategories();

  const { items, addItem, incrementItem, decrementItem } = useCartStore();

  const cartItem = items.find((item: any) => item.id === product?.id);
  const initialQuantity = cartItem ? cartItem.quantity : 0;
  const [quantity, setQuantity] = useState<number>(initialQuantity);

  // Compute related products once both product and products list are loaded
  const relatedProducts = useMemo(() => {
    if (!product || !productsAndCategories) return [];
    return productsAndCategories.products
      .filter((p) => p.category === product.category && p.id !== product.id)
      .map((p) => ({
        ...p,
        id: p.id.toString(),
        description: p.description ?? '', // Ensure description is a string
        Status: p.Status ?? undefined, // Convert null to undefined for Status
      }));
  }, [product, productsAndCategories]);

  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text>Error: {error.message}</Text>;
  if (!product) return <Redirect href="/404" />;

  const increaseQuantity = () => {
    setQuantity((prev) => prev + 1);
    incrementItem(product.id);
  };

  const decreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
      decrementItem(product.id);
    } else {
      toast.show('Minimum quantity reached', {
        type: 'warning',
        placement: 'top',
        duration: 1300,
      });
    }
  };

  const addToCart = () => {
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      quantity,
      heroImage: product.heroImage,
    });
    toast.show('Added to cart', {
      type: 'success',
      placement: 'top',
      duration: 1300,
    });
  };

  const totalPrice = (product.price * quantity).toFixed(2);

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: product.title }} />
      <Image source={{ uri: product.heroImage }} style={styles.heroImage} />

      <View style={{ padding: 16 }}>
        <Text style={styles.title}>{product.title}</Text>

        <View style={styles.priceContainer}>
          <Text style={styles.price}>Unit Price: ${product.price.toFixed(2)}</Text>
          <Text style={styles.price}>Total Price: ${totalPrice}</Text>
        </View>

        <Text style={styles.description}>{product.description}</Text>

        <FlatList
          horizontal
          data={product.imagesUrl}
          keyExtractor={(_item, index) => index.toString()}
          renderItem={({ item }: ListRenderItemInfo<string>) => (
            <Image source={{ uri: item }} style={styles.image} />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imagesContainer}
        />

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={decreaseQuantity}
            disabled={quantity === 1}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </TouchableOpacity>

          <Text style={styles.quantity}>{quantity}</Text>

          <TouchableOpacity
            style={styles.quantityButton}
            onPress={increaseQuantity}
            disabled={product.Status === 'out of stock'}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              ...styles.addToCartButton,
              opacity: quantity === 0 ? 0.5 : 1,
            }}
            onPress={addToCart}
            disabled={quantity === 0}
          >
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>

        {/* Related Products Section */}
        <Text style={styles.sectionTitle}>Related Products</Text>
        {relatedLoading ? (
          <ActivityIndicator />
        ) : relatedProducts.length > 0 ? (
          <FlatList
            data={relatedProducts}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.relatedList}
            renderItem={({ item }: ListRenderItemInfo<Product>) => (
              <TouchableOpacity style={styles.relatedCard} onPress={() => {/* navigate to item.slug */}}>
                <Image source={{ uri: item.heroImage }} style={styles.relatedImage} />
                <Text numberOfLines={1} style={styles.relatedTitle}>{item.title}</Text>
                <Text style={styles.relatedPrice}>${item.price.toFixed(2)}</Text>
              </TouchableOpacity>
            )}
          />
        ) : (
          <Text style={styles.noRelated}>No related products found.</Text>
        )}
      </View>
    </ScrollView>
  );
};

export default ProductDetails;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  heroImage: {
    width: '100%',
    height: 250,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  price: {
    fontWeight: 'bold',
    color: '#000',
  },
  description: {
    fontSize: 16,
    color: '#555',
    marginVertical: 8,
  },
  imagesContainer: {
    marginBottom: 16,
  },
  image: {
    width: 100,
    height: 100,
    marginRight: 8,
    borderRadius: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1BC464',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  quantityButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: '#1BC464',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  addToCartText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  relatedList: {
    paddingBottom: 16,
  },
  relatedCard: {
    width: 140,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
    padding: 8,
  },
  relatedImage: {
    width: '100%',
    height: 80,
    resizeMode: 'contain',
    borderRadius: 4,
  },
  relatedTitle: {
    fontSize: 14,
    marginTop: 6,
  },
  relatedPrice: {
    fontWeight: 'bold',
    marginTop: 4,
  },
  noRelated: {
    fontSize: 14,
    color: '#888',
  },
});
