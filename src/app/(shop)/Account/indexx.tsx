import React, { useEffect, useState, } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal, TextInput, Linking } from 'react-native';
import { Card, Button, Icon } from 'react-native-paper';
import FeatherIcon from 'react-native-vector-icons/Feather';
import IoniconsIcon from 'react-native-vector-icons/Ionicons';

import { User } from '@supabase/supabase-js';
import { useNavigation,  } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useWallet } from '../../Providers/Wallet-provider';
import SetDeliveryAddress from '../../Deliveryaddress';
import { getMyProfile } from '../../api/api';


const AccountScreen = () => {
  const [user, setUser] = useState<User | null>(null);
  const [firstName, setFirstName] = useState<string | null>('No First Name');
  const [phoneNumber, setPhoneNumber] = useState<string | null>('No Phone Number');
  const [address,setAddress]= useState<string | null>('No Address');
  const [deliveryNote, setDeliveryNote] = useState<string|null>('no note');
  const { walletBalance } = useWallet();
  const navigation = useNavigation();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user:", error);
      } else {
        setUser(data?.user || null);
      }
    };

    fetchUserData();
  }, []);
  useEffect(() => {
    const channel = supabase.channel('public:profile')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profile' }, (payload: { new: { user_id: string; address: string } }) => {
        if (payload.new.user_id === user?.id) {
          setAddress(payload.new.address || 'No Address');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  useEffect(() => {
    if (user) {
      const fetchUserMetadata = async () => {
        const { data: userMetadata, error: metadataError } = await supabase
          .from('profile')
          .select('first_name, phone_number, address, delivery_note') // Added delivery_note to the select statement
          .eq('user_id', user.id);

        if (userMetadata && userMetadata.length > 0) {
          const singleUser = userMetadata[0];
          setFirstName(singleUser.first_name || 'No First Name');
          setPhoneNumber(singleUser.phone_number || 'No Phone Number');
          setAddress(singleUser.address || 'No Address');
          setDeliveryNote(singleUser.delivery_note || " no dlivery_note");
        } else {
          console.error("No user metadata found");
        }

        try {
          const { data: userProfile, error } = await supabase.functions.invoke('getMyProfile');
          if (error) {
            console.error("Error fetching user profile:", error);
          } else if (userProfile) {
            setFirstName(userProfile.first_name || 'No First Name');
            setPhoneNumber(userProfile.phone_number || 'No Phone Number');
            setAddress(userProfile.address || 'No Address');

          }
        } catch (error) {
          console.error("Unexpected error fetching user profile:", error);
        }
      };

      fetchUserMetadata();
    }
  }, [user]);

  const [modalVisible, setModalVisible] = useState(false);

  const handleSavePhoneNumber = async () => {
    if (user) {
      const { error } = await supabase
        .from('profile')
        .update({ phone_number: newPhoneNumber })
        .eq('user_id', user.id);

      if (error) {
        console.error("Error updating phone number:", error);
      } else {
        setPhoneNumber(newPhoneNumber);
        setModalVisible(false);
      }
    }
  };

  const [newPhoneNumber, setNewPhoneNumber] = useState(phoneNumber);

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: 'https://randomuser.me/api/portraits/men/1.jpg' }}
            style={styles.profilePic}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{firstName}</Text>
            <Text style={styles.email}>{user?.email || 'No Email Provided'}</Text>
          </View>
        </View>
      </Card>

      {/* Wallet Balance */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <IoniconsIcon name="wallet-outline" size={20} color="#1BC464" />
            <Text style={styles.sectionTitle}> Wallet Balance</Text>
          </View>
          <Text style={styles.balance}>
            ${walletBalance !== null ? walletBalance.toFixed(2) : '0.00'}
          </Text>
        
        </Card.Content>
      </Card>
   {/* Delivery Address */}
  <TouchableOpacity onPress={() => navigation.navigate('Deliveryaddress' as never)}>
    <Card style={styles.card}>
      <Card.Content>
      <View style={styles.row}>
        <FeatherIcon name="home" size={20} color="#1BC464" />
        <Text style={styles.sectionTitle}> Delivery Address</Text>
        <FeatherIcon name="edit-2" size={20} color="#1BC464" style={styles.editIcon} />
      </View>
      <Text style={styles.detailValue}>{address}</Text>
      
      </Card.Content>
    </Card>
  </TouchableOpacity>

      <Card style={styles.card}>
        <Card.Content>
            <View style={styles.row}>
            <FeatherIcon name="phone" size={20} color="#1BC464" />
            <Text style={styles.sectionTitle}> Phone Number</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.editIcon}>
              <FeatherIcon name="edit-2" size={20} color="#1BC464" />
            </TouchableOpacity>
            </View>
            <Modal
            visible={modalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setModalVisible(false)}
            >
            <View style={styles.modalContainer}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Phone Number</Text>
                <TextInput
                style={[styles.input, { width: '300%' }]}
                value={newPhoneNumber || ''}
                onChangeText={setNewPhoneNumber}
                keyboardType="phone-pad"
                maxLength={15} // Set a maximum length for the phone number
                />
              <Button mode="contained" onPress={handleSavePhoneNumber} style={styles.saveButton}>
                Save
              </Button>
              <Button mode="text" onPress={() => setModalVisible(false)} style={styles.cancelButton}>
                Cancel
              </Button>
              </View>
            </View>
            </Modal>
          <Text style={styles.detailValue}>{phoneNumber}</Text>
        </Card.Content>
      </Card>
    
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.Title}>
        <FeatherIcon name="shopping-bag" size={20} color="#1BC464" />
        <Text style={styles.sectionTitle}> Shopping Assistant</Text>
          </View>
         
        <TouchableOpacity onPress={() => alert('Navigate to WhatsApp Support')}>
          <View style={styles.row}>
            <Image
              source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/5e/WhatsApp_icon.png' }}
              style={{ width: 24, height: 24, marginRight: 20 }}
            />
            <Text style={[styles.sectionTitle, { marginLeft: 0, fontSize: 16 }]}> WhatsApp Support</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => alert('Navigate to FAQs')}>
          <Text style={styles.link}>FAQs</Text>
        </TouchableOpacity>
        </Card.Content>
      </Card>
      {/* Footer Links */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={()=>(Linking.openURL('https://eshopadmin-zeta.vercel.app/Policy'))}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </TouchableOpacity>

       
      </View>
    </ScrollView>
  );
};

export default AccountScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 15,
    borderWidth: 2,
    borderColor: '#1BC464',
  },
  profileInfo: {
    flex: 1,
  },
  username: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
  },
  email: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    marginLeft: 12,
  },
  balance: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1BC464',
    marginVertical: 10,
  },
  payOutButton: {
    backgroundColor: '#1BC464',
    marginTop: 10,
    borderRadius: 6,
  },
  detailValue: {
    fontSize: 16,
    color: '#444',
    marginTop: 5,
  },
  editIcon: {
    marginLeft: 'auto',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#222',
  },
  input: {
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    width: '100%',
    fontSize: 16,
    marginBottom: 15,
  },
  saveButton: {
    backgroundColor: '#1BC464',
    borderRadius: 6,
    width: '100%',
    marginBottom: 10,
  },
  cancelButton: {
    width: '100%',
  },
  link: {
    color: '#1BC464',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  footer: {
    marginTop: 30,
    paddingBottom: 50,
    alignItems: 'center',
  },
  footerLink: {
    fontSize: 14,
    color: '#1BC464',
    marginVertical: 5,
    textDecorationLine: 'underline',
  },
  Title: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
});



