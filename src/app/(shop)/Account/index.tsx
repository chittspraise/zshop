import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from "../../Providers/auth-provider";
import { getMyProfile, useUpsertMyProfile } from "../../api/api";
import Icon from "react-native-vector-icons/MaterialIcons";
import FeatherIcon from "react-native-vector-icons/Feather";
import IoniconsIcon from "react-native-vector-icons/Ionicons";
import { useNavigation } from "expo-router";
import { supabase } from "../../lib/supabase";
import { format } from "date-fns";

export default function AccountScreen() {
  const { session, user } = useAuth();
  const { data: profile, isLoading, error } = getMyProfile();
  const { mutate: upsertMyProfile } = useUpsertMyProfile();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("No recipient address set yet");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [email, setEmail] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation();

  // Wallet statement state
  const [walletStatementVisible, setWalletStatementVisible] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txsLoading, setTxsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "No First Name");
      setLastName(profile.last_name || "");
      setPhoneNumber(profile.phone_number || "No Phone Number");
      setAddress(profile.address || "No Address");
      setDeliveryNote(profile.delivery_note || "No Note");
      setEmail(user?.email || "");
    }
  }, [profile, user]);

  // Load recipient address on mount/focus
  const loadRecipientAddress = async () => {
    try {
      const stored = await AsyncStorage.getItem('recipient_address');
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecipientAddress(parsed.recipientAddress);
      } else {
        setRecipientAddress("No recipient address set yet");
      }
    } catch (e) {
      console.error('Error loading recipient address in account:', e);
    }
  };

  useEffect(() => {
    loadRecipientAddress();
    const unsubscribe = navigation.addListener('focus', loadRecipientAddress);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const channel = supabase.channel('public:profile')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profile' }, (payload) => {
        if (payload.new.user_id === user?.id) {
          setAddress(payload.new.address || 'No Address');
          setDeliveryNote(payload.new.delivery_note || 'No Note');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSave = () => {
    upsertMyProfile(
      {
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        address,
        delivery_note: deliveryNote,
        email,
      },
      {
        onSuccess: () => {
          setModalVisible(false);
          Alert.alert("Success", "Profile successfully updated");
        },
        onError: (err) => {
          console.error("Profile update error:", err);
          Alert.alert("Error", "Error updating profile");
        },
      }
    );
  };

  const openWalletStatement = async () => {
    if (!user) return;
    setWalletStatementVisible(true);
    setTxsLoading(true);
    try {
      const { data, error: txsError } = await (supabase as any)
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!txsError && data) {
        setTransactions(data);
      } else {
        console.error("Error fetching transactions:", txsError);
      }
    } catch (err) {
      console.error("Unexpected error fetching transactions:", err);
    } finally {
      setTxsLoading(false);
    }
  };

  if (isLoading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1BC464" />;
  if (error) return <Text style={styles.errorText}>Error loading profile</Text>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Adaptive Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>My Account</Text>
          <Text style={styles.name} numberOfLines={1}>{firstName} {lastName}</Text>
          <Text style={styles.headerEmail} numberOfLines={1}>{email}</Text>
          <Text style={styles.headerPhone}>{phoneNumber}</Text>
          
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.editIconContainer}
          >
            <FeatherIcon name="edit-2" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Premium Wallet Balance Card */}
        <TouchableOpacity style={styles.card} onPress={openWalletStatement} activeOpacity={0.95}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Wallet Balance (Tap for statement)</Text>
            <FeatherIcon name="chevron-right" size={16} color="#1BC464" style={{ marginLeft: "auto" }} />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={styles.walletIconBg}>
              <IoniconsIcon name="wallet-outline" size={24} color="#1BC464" />
            </View>
            <Text style={styles.walletBalance}>
              ${profile?.wallet_balance ?? 0}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Section: Settings Group */}
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.groupCard}>
          <TouchableOpacity onPress={() => navigation.navigate("RecipientAddressScreen" as never)}>
            <Option icon="map" label="Recipient Address" value={recipientAddress} iconColor="#10b981" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("passwordreset" as never)}>
            <Option icon="lock" label="Reset Password" iconColor="#ef4444" isLast />
          </TouchableOpacity>
        </View>

        {/* Section: Shopping Assistant */}
        <Text style={styles.sectionTitle}>Shopping Assistant</Text>
        <View style={styles.groupCard}>
          <TouchableOpacity onPress={() => navigation.navigate("contact" as never)}>
            <Option icon="phone" label="Contact Us & Live Help" iconColor="#8b5cf6" isLast />
          </TouchableOpacity>
        </View>
        
        {/* Section: Support Links */}
        <Text style={styles.sectionTitle}>Support & Policy</Text>
        <View style={styles.groupCard}>
          <TouchableOpacity onPress={() => Linking.openURL("https://eshopadmin-zeta.vercel.app/Policy")}>
            <Option icon="shield" label="Privacy Policy" iconColor="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Linking.openURL("https://eshopadmin-zeta.vercel.app/TermsAndCondition")}>
            <Option icon="gavel" label="Terms of Service" iconColor="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => Linking.openURL('https://eshopadmin-zeta.vercel.app/TermsAndCondition')} style={{ borderBottomWidth: 0 }}>
            <Option icon="help" label="FAQ" iconColor="#64748b" isLast />
          </TouchableOpacity>
        </View>

        {/* Footer Brand Info */}
        <View style={styles.footerBrand}>
          <Text style={styles.footerBrandText}>eshop App v1.0.0</Text>
          <Text style={styles.footerBrandSub}>© 2026 Proudchitts Inc. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile Info</Text>

            <TextInput
              placeholder="First Name"
              value={firstName}
              onChangeText={setFirstName}
              style={styles.input}
              placeholderTextColor="#aaa"
            />
            <TextInput
              placeholder="Last Name"
              value={lastName}
              onChangeText={setLastName}
              style={styles.input}
              placeholderTextColor="#aaa"
            />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#aaa"
            />
            <TextInput
              placeholder="Phone Number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              style={styles.input}
              keyboardType="phone-pad"
              placeholderTextColor="#aaa"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#1BC464" }]}
                onPress={handleSave}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#888" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wallet Balance Statement Modal */}
      <Modal visible={walletStatementVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%", width: "95%" }]}>
            <Text style={styles.modalTitle}>Wallet Statement</Text>

            {txsLoading ? (
              <ActivityIndicator size="large" color="#1BC464" style={{ marginVertical: 30 }} />
            ) : transactions.length === 0 ? (
              <View style={{ alignItems: "center", marginVertical: 40 }}>
                <IoniconsIcon name="receipt-outline" size={48} color="#ccc" />
                <Text style={{ fontSize: 14, color: "#888", marginTop: 10 }}>No transactions recorded yet.</Text>
              </View>
            ) : (
              <FlatList
                data={transactions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 16 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isRefund = item.type === "refund";
                  return (
                    <View style={styles.txRow}>
                      <View style={[styles.txIconContainer, { backgroundColor: isRefund ? "#e8fdf0" : "#fff5f5" }]}>
                        <Icon 
                          name={isRefund ? "arrow-downward" : "arrow-upward"} 
                          size={18} 
                          color={isRefund ? "#10b981" : "#ef4444"} 
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text numberOfLines={1} style={styles.txDescription}>{item.description}</Text>
                        <Text style={styles.txDate}>{format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')}</Text>
                      </View>
                      <Text style={[styles.txAmount, { color: isRefund ? "#10b981" : "#ef4444" }]}>
                        {isRefund ? "+" : "-"}${Math.abs(item.amount).toFixed(2)}
                      </Text>
                    </View>
                  );
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: "#1BC464", marginTop: 10, width: "100%" }]}
              onPress={() => setWalletStatementVisible(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type OptionProps = {
  icon: string;
  label: string;
  value?: string;
  isLast?: boolean;
  iconColor?: string;
};

function Option({ icon, label, value, isLast, iconColor = "#1BC464" }: OptionProps) {
  return (
    <View style={[styles.option, isLast && { borderBottomWidth: 0 }]}>
      <View style={[styles.optionIconBg, { backgroundColor: iconColor + "10" }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionText}>{label}</Text>
        {value && <Text style={styles.optionValue} numberOfLines={1}>{value}</Text>}
      </View>
      <Icon name="chevron-right" size={20} color="#94a3b8" />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
    fontWeight: "bold",
  },
  header: {
    backgroundColor: "#1BC464",
    paddingTop: Platform.OS === 'android' ? 36 : 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
    position: "relative",
    shadowColor: "#1BC464",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  editIconContainer: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    padding: 8,
    borderRadius: 20,
  },
  headerLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  name: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerEmail: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  headerPhone: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#1e293b", // Deep luxury slate/dark grey balance card
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  walletIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(27, 196, 100, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  walletBalance: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginLeft: 12,
  },
  sectionTitle: {
    fontWeight: "800",
    fontSize: 13,
    color: "#64748b",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
  },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.015,
    shadowRadius: 6,
    elevation: 1,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  optionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  optionValue: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerBrand: {
    marginTop: 24,
    alignItems: "center",
    paddingBottom: 20,
  },
  footerBrandText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footerBrandSub: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)", // Slate overlay
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 400,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
    color: "#1e293b",
  },
  input: {
    height: 46,
    borderColor: "#cbd5e1",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    backgroundColor: "#f8fafc",
    fontSize: 15,
    color: "#334155",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#f1f5f9",
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  txDescription: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  txDate: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
    fontWeight: "500",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
});
