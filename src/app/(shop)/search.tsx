import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Link } from 'expo-router';
import { supabase } from '../lib/supabase'; // Import central correct Supabase client

// Types
type Category = {
  id: number;
  created_at: string;
  name: string;
  imageUrl: string;
  slug: string;
  product: any;
};

type Product = {
  id: number;
  created_at: string;
  title: string;
  slug: string | null;
  imagesUrl: string[];
  price: number;
  heroImage: string;
  category: number;
  maxQuantity: number;
};

const SearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch products from Supabase
  const fetchProducts = async () => {
    const { data, error } = await supabase.from('product').select('*');
    if (error) {
      console.error('Error fetching products:', error);
      throw new Error('Failed to fetch products: ' + error.message);
    }
    return data;
  };

  // Fetch categories from Supabase
  const fetchCategories = async () => {
    const { data, error } = await supabase.from('category').select('*');
    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error('Failed to fetch categories: ' + error.message);
    }
    return data;
  };

  // UseEffect to fetch data on initial load
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const fetchedProducts = await fetchProducts();
        const fetchedCategories = await fetchCategories();
        setProducts(fetchedProducts || []);
        setCategories(fetchedCategories || []);
      } catch (error) {
        console.error('Failed to fetch products or categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Handle search functionality using substring matching (.includes)
  const handleSearch = () => {
    const query = searchQuery.trim().toLowerCase();
    if (query === '') {
      setFilteredProducts([]);
      setFilteredCategories([]);
      return;
    }
    const filteredProd = products.filter(product =>
      product.title.toLowerCase().includes(query)
    );
    const filteredCat = categories.filter(category =>
      category.name.toLowerCase().includes(query)
    );
    setFilteredProducts(filteredProd);
    setFilteredCategories(filteredCat);
  };

  useEffect(() => {
    handleSearch();
  }, [searchQuery, products, categories]);

  // Get category name for a product
  const getCategoryName = (categoryId: number) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <Link asChild href={`/product/${item.slug}`}>
      <TouchableOpacity style={styles.productCard}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.heroImage }} style={styles.productImage} />
        </View>
        <View style={styles.productInfo}>
          <Text numberOfLines={1} style={styles.productTitle}>{item.title}</Text>
          <Text style={styles.categoryBadge}>{getCategoryName(item.category)}</Text>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    </Link>
  );

  const renderCategoryChip = ({ item }: { item: Category }) => (
    <Link asChild href={`/categories/${item.slug}`}>
      <TouchableOpacity style={styles.categoryChip}>
        <Image source={{ uri: item.imageUrl }} style={styles.categoryChipImage} />
        <Text style={styles.categoryChipText}>{item.name}</Text>
      </TouchableOpacity>
    </Link>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Modern Pill Search Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <View style={styles.searchBarContainer}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search items, brands, categories..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => Keyboard.dismiss()}
              returnKeyType="search"
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="green" />
          </View>
        ) : searchQuery === '' ? (
          /* Initial State: Showcase active browse elements without headings */
          <View style={styles.flex}>
            {/* Scrollable Horizontal Categories Chips */}
            <View style={styles.horizontalChipsContainer}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={categories}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderCategoryChip}
                contentContainerStyle={styles.chipsScroll}
              />
            </View>

            {/* Popular/Discover products grid */}
            <FlatList
              key="discover_grid"
              data={products.slice(0, 10)}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderProductItem}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gridScroll}
            />
          </View>
        ) : (
          /* Search Results State */
          <View style={styles.flex}>
            {/* Horizontal matched categories if any */}
            {filteredCategories.length > 0 && (
              <View style={styles.matchedCategoriesSection}>
                <Text style={styles.resultsSubtitle}>Matching Categories</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={filteredCategories}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderCategoryChip}
                  contentContainerStyle={styles.chipsScroll}
                />
              </View>
            )}

            {/* Results Header */}
            <Text style={styles.sectionTitle}>
              Search Results ({filteredProducts.length})
            </Text>

            {filteredProducts.length > 0 ? (
              <FlatList
                key="results_grid"
                data={filteredProducts}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderProductItem}
                numColumns={2}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.gridScroll}
              />
            ) : (
              <View style={styles.centered}>
                <Ionicons name="search-outline" size={64} color="#ccc" style={styles.noResultsIcon} />
                <Text style={styles.noResultsText}>No products found matching "{searchQuery}"</Text>
                <Text style={styles.noResultsSubtext}>Try adjusting your spelling or searching for a broader term.</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
    borderRadius: 20,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 12,
    height: 46,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  horizontalChipsContainer: {
    height: 65,
    marginVertical: 8,
  },
  chipsScroll: {
    paddingBottom: 8,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  categoryChipImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    resizeMode: 'cover',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  gridScroll: {
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '48%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  imageContainer: {
    backgroundColor: '#fff',
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  productInfo: {
    padding: 12,
    backgroundColor: '#fdfdfd',
    borderTopWidth: 1,
    borderColor: '#f1f1f1',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2b2b2b',
    marginBottom: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eafaf1',
    color: 'green',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1BC464',
  },
  matchedCategoriesSection: {
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  noResultsIcon: {
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#495057',
    textAlign: 'center',
    marginBottom: 6,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#868e96',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SearchScreen;
