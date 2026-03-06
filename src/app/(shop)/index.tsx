
import React from 'react';
import { ActivityIndicator, FlatList, ImageBackground, StyleSheet, Text, View } from 'react-native';
import{ ListHeader } from '../components/list-header';
import { ProductListItem } from '../components/product-list-item';
import { getProductsAndCategories } from '../api/api';


const Home = () => {
  const {data, isLoading,  error} = getProductsAndCategories();
  if(isLoading) return <ActivityIndicator />;

  if(error || !data) 
    return <Text>{error?.message || 'An error occurred'}</Text>;

 
  return (  
    
     
       <View>
      <FlatList 
        data={data.products}
        renderItem={({item}) => <ProductListItem product={item} />}
        keyExtractor={item => item.id.toString()}
        numColumns={2}  
        ListHeaderComponent={<ListHeader categories={data.categories} />}
        contentContainerStyle={styles.flatListContent}
        columnWrapperStyle={styles.flatListColumn}
        style={{paddingVertical: 5}}
      />
    
    </View> 

    );
    
  };

export default Home;

const styles = StyleSheet.create({
  flatListContent: {
    paddingBottom: 20,
  },
  flatListColumn: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  backgroundImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

