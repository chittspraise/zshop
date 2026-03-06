import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Button,
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { supabase } from './lib/supabase';
import MapView, { Marker } from './components/Map';
import { useRouter } from 'expo-router';

// Define Region type here to avoid importing from react-native-maps on web
interface Region {
  latitude: number;
  longitude: number;
}

interface AutocompletePrediction {
  place_id: string;
  description: string;
}

const GOOGLE_API_KEY = 'AIzaSyAlqEdbDqQLKQAHwyr6vhY6nbV0OvVAb4E';

const SetDeliveryAddress: React.FC = () => {
  // Basic states for location and autocomplete
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [loadingLocation, setLoadingLocation] = useState<boolean>(true);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [addressInput, setAddressInput] = useState<string>('');
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New state for the modal map and delivery note
  const [showMapModal, setShowMapModal] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState<string>('');
  // This local state holds the marker position while adjusting in the modal.
  const [modalCoords, setModalCoords] = useState<Coordinates | null>(null);

  const router = useRouter();

  // Request location permission and get device location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Please allow location access to set your delivery address.'
        );
        setHasPermission(false);
        setLoadingLocation(false);
        return;
      }
      setHasPermission(true);

      try {
        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation(coords);
        setSelectedCoords(coords); // default selection
      } catch (err) {
        console.warn('Error getting current location:', err);
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  // Fetch autocomplete predictions when the addressInput changes
  const fetchAddressPredictions = async (input: string) => {
    if (!input) {
      setPredictions([]);
      return;
    }
    setIsLoadingPredictions(true);
    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${GOOGLE_API_KEY}&input=${encodeURIComponent(
        input
      )}&language=en`;
      if (currentLocation) {
        url += `&location=${currentLocation.latitude},${currentLocation.longitude}&radius=3000`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      } else {
        setPredictions([]);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    } finally {
      setIsLoadingPredictions(false);
    }
  };

  // Fetch place details for a selected prediction
  const fetchPlaceDetails = async (placeId: string, description: string) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?key=${GOOGLE_API_KEY}&place_id=${placeId}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.result && data.result.geometry) {
        const { lat, lng } = data.result.geometry.location;
        setSelectedCoords({ latitude: lat, longitude: lng });
        setSelectedAddress(description);
        setAddressInput(description);
        setPredictions([]);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  };

  // Handler to show the modal map for adjusting current location
  const handleShowMapModal = async () => {
    if (!currentLocation) {
      Alert.alert('No Current Location', 'Unable to retrieve your current location.');
      return;
    }
    // Set the modal marker to current location by default
    setModalCoords(currentLocation);
    setShowMapModal(true);
  };

  // Reverse geocode current location (if needed outside modal)
  const handleUseCurrentLocation = async () => {
    if (!currentLocation) {
      Alert.alert('No Current Location', 'Could not get your location yet.');
      return;
    }
    setSelectedCoords(currentLocation);
    try {
      const latlng = `${currentLocation.latitude},${currentLocation.longitude}`;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=${GOOGLE_API_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.results && data.results.length > 0) {
        const formatted = data.results[0].formatted_address;
        setSelectedAddress(formatted);
        setAddressInput(formatted);
        setPredictions([]);
        handleShowMapModal();
      } else {
        Alert.alert('No address found for current location.');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  // Save the address (including note) to Supabase
  const handleSaveAddress = async () => {
    setIsSubmitting(true);
    if (!selectedCoords) {
      Alert.alert('No location selected', 'Please pick an address or adjust your location on the map.');
      setIsSubmitting(false);
      return;
    }
    const finalAddress = selectedAddress || 'Current location';
    const finalNote = deliveryNote; // Additional delivery note info

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'User not logged in.');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('profile')
      .update({
        address: finalAddress,
        latitude: selectedCoords.latitude,
        longitude: selectedCoords.longitude,
        delivery_note: finalNote, // Ensure your table has this column
      })
      .eq('user_id', user.id);

    if (error) {
      Alert.alert('Error', 'Could not save address: ' + error.message);
    } else {
      alert('Delivery address saved successfully.');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/cart');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Delivery Address</Text>

      {hasPermission === false && (
        <Text style={styles.errorText}>
          Location permission is required to set your delivery address.
        </Text>
      )}

      {loadingLocation && <ActivityIndicator size="large" color="#1BC464" />}

      {/* Search Bar for manual address entry */}
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchBar}
          placeholder="Search for an address (e.g., 92, Baker Street)"
          value={addressInput}
          onChangeText={(text) => {
            setAddressInput(text);
            fetchAddressPredictions(text);
          }}
        />
      </View>

      {/* Suggestions List */}
      {isLoadingPredictions && <ActivityIndicator size="small" color="#1BC464" />}
      <FlatList
        data={predictions}
        keyExtractor={(item) => item.place_id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.suggestionRow}
            onPress={() => fetchPlaceDetails(item.place_id, item.description)}
          >
            <Text style={styles.suggestionText}>{item.description}</Text>
          </TouchableOpacity>
        )}
      />

      {/* "Nearby addresses" Section */}
      {currentLocation && (
        <View style={styles.nearbySection}>
          <Text style={styles.subtitle}>Nearby addresses</Text>
          <TouchableOpacity style={styles.currentLocationRow} onPress={handleShowMapModal}>
            <Icon name="map-marker" size={20} color="#1BC464" />
            <Text style={styles.currentLocationText}> Adjust via Map</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.currentLocationRow} onPress={handleUseCurrentLocation}>
            <Icon name="crosshairs-gps" size={20} color="#1BC464" />
            <Text style={styles.currentLocationText}> Use My Current Location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Delivery Note Section */}
      <View style={styles.deliveryNoteContainer}>
        <Text style={styles.label}>Delivery Note</Text>
        <TextInput
          style={styles.deliveryNoteInput}
          placeholder="e.g., Complex 3, Unit 12"
          value={deliveryNote}
          onChangeText={setDeliveryNote}
        />
      </View>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <Button
          title={isSubmitting ? 'Saving...' : 'SAVE ADDRESS'}
          onPress={handleSaveAddress}
          disabled={isSubmitting}
          color="#1BC464"
        />
      </View>

      {/* Modal for Map Adjustment */}
      <Modal visible={showMapModal} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Adjust Your Location</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.map}>
                <Text>Map functionality is not available on the web.</Text>
            </View>
          ) : modalCoords ? (
            <MapView
              style={styles.map}
              initialRegion={{
                ...modalCoords,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onRegionChangeComplete={(region: Region) => {
                // Optionally update marker position continuously
              }}
            >
              <Marker
                coordinate={modalCoords}
                draggable
                onDragEnd={(e: any) => setModalCoords(e.nativeEvent.coordinate)}
              />
            </MapView>
          ) : (
            <ActivityIndicator size="large" color="#1BC464" />
          )}
          <View style={styles.modalFooter}>
            <Button title="Confirm" onPress={() => {
              if (modalCoords) {
                // Update the main selected coordinates and attempt reverse geocoding
                setSelectedCoords(modalCoords);
                (async () => {
                  const latlng = `${modalCoords.latitude},${modalCoords.longitude}`;
                  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=${GOOGLE_API_KEY}`;
                  const resp = await fetch(url);
                  const data = await resp.json();
                  if (data.results && data.results.length > 0) {
                    const formatted = data.results[0].formatted_address;
                    setSelectedAddress(formatted);
                    setAddressInput(formatted);
                  }
                })();
              }
              setShowMapModal(false);
            }} color="#1BC464" />
            <Button title="Cancel" onPress={() => setShowMapModal(false)} color="#999" />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SetDeliveryAddress;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 10 },
  headerTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  errorText: { color: 'red', marginBottom: 10 },
  searchBarContainer: { backgroundColor: '#f5f5f5', borderRadius: 8, marginBottom: 10 },
  searchBar: { height: 42, fontSize: 16, paddingHorizontal: 10, color: '#333' },
  suggestionRow: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#ccc' },
  suggestionText: { fontSize: 14, color: '#333' },
  nearbySection: { marginVertical: 10 },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  currentLocationRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  currentLocationText: { marginLeft: 6, fontSize: 16, color: '#1BC464' },
  deliveryNoteContainer: { marginTop: 20 },
  label: { fontSize: 16, marginBottom: 6, fontWeight: '600' },
  deliveryNoteInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  saveButtonContainer: { marginTop: 30 },
  modalContainer: { flex: 1, padding: 16, backgroundColor: '#fff' },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  map: { flex: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 10 },
});