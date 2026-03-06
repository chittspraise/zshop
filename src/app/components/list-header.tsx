import React, { useRef, useState, useEffect } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

import { useCartStore } from '../cart-store';
import { supabase } from '../lib/supabase';
import { Tables } from '../../types/database.types';
import { getMyProfile } from '../api/api';

const { width } = Dimensions.get('window');

const heroImages = [
  require('../../../assets/images/gg2-removebg-preview.png'),
  require('../../../assets/images/gg-removebg-preview.png'),
  require('../../../assets/images/gg3-removebg-preview.png'),
];

export const ListHeader = ({ categories }: { categories: Tables<'category'>[] }) => {
  const { getItemCount } = useCartStore();
  const flatListRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const { data: profile, isLoading, error } = getMyProfile();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (index + 1) % heroImages.length;
      setIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 3000);

    return () => clearInterval(interval);
  }, [index]);

  return (
    <View>
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {isLoading && <ActivityIndicator />}
            {error && <Text>Error loading profile</Text>}
            {profile?.first_name && (
              <Text style={styles.name}>Welcome, {profile.first_name}</Text>
            )}
          </View>

          <View style={styles.headerRight}>
            <Link style={styles.cartContainer} href="/cart" asChild>
              <Pressable>
                {({ pressed }) => (
                  <View>
                    <FontAwesome
                      name="shopping-cart"
                      size={24}
                      color="grey"
                      style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                    />
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{getItemCount()}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            </Link>
            <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
              <FontAwesome name="sign-out" size={24} color="red" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Image Carousel */}
      <View style={styles.heroContainer}>
        <FlatList
          ref={flatListRef}
          data={heroImages}
          keyExtractor={(_, i) => i.toString()}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Image source={item} style={styles.heroImage} />
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <FlatList
          data={categories}
          renderItem={({ item }) => (
            <Link asChild href={`/categories/${item.slug}`}>
              <Pressable style={styles.category}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.categoryImage}
                  onError={(error) =>
                    console.log('Image failed to load', error.nativeEvent)
                  }
                />
                <Text style={styles.categoryText}>{item.name}</Text>
              </Pressable>
            </Link>
          )}
          keyExtractor={(item) => item.name}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10 }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    gap: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartContainer: {
    padding: 10,
  },
  signOutButton: {
    padding: 10,
  },
  heroContainer: {
    width: '100%',
    height: 200,
  },
  heroImage: {
    width: width,
    height: 200,
    resizeMode: 'contain',
    borderRadius: 20,
  },
  categoriesContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  category: {
    width: (width - 20) / 3,
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    textAlign: 'center',
  },
  badgeContainer: {
    position: 'absolute',
    top: -5,
    right: 5,
    backgroundColor: '#1BC464',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
