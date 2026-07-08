import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, RefreshControl, Platform 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { Clipboard, CheckCircle, Search, LogOut, ArrowLeft, Heart } from 'lucide-react-native';

export const PharmacistDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active prescription details
  const [activePrescription, setActivePrescription] = useState<any | null>(null);
  
  // Barcode scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<string[]>([]); // matched barcodes

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/pharmacy/prescriptions');
      // Filter pending ones
      const pending = res.data.filter((p: any) => p.status === 'pending');
      setPrescriptions(pending);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPrescriptions();
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) logout();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', onPress: logout, style: 'destructive' }
      ]);
    }
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const status = await requestPermission();
      if (!status.granted) {
        Alert.alert('Permission Denied', 'Camera permissions are required to scan barcodes.');
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setIsScanning(false);
    Alert.alert('Barcode Scanned', `Product code: ${data}`);
    // Simulate successful match of packaging barcode code
    if (activePrescription) {
      const itemToMatch = activePrescription.items[scannedItems.length];
      if (itemToMatch) {
        setScannedItems([...scannedItems, itemToMatch.medicine_id]);
      }
    }
  };

  const handleDispense = async () => {
    if (!activePrescription) return;
    setIsLoading(true);
    try {
      const payload = {
        items: activePrescription.items.map((item: any) => ({
          medicine_id: item.medicine_id || item.id,
          quantity: item.quantity || 1,
          batch_id: item.batch_id || null
        }))
      };
      await apiClient.post(`/api/pharmacy/prescriptions/${activePrescription.id}/dispense`, payload);
      Alert.alert('Success', 'Prescription medication dispensed and stock levels decremented.');
      setActivePrescription(null);
      setScannedItems([]);
      fetchPrescriptions();
    } catch (e: any) {
      Alert.alert('Failure', e.response?.data?.detail || 'Failed to complete dispensing transaction.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isRefreshing && prescriptions.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Syncing Pharmacy Orders...</Text>
      </View>
    );
  }

  // Camera Scanning view overlay
  if (isScanning && Platform.OS !== 'web') {
    return (
      <View style={styles.scannerWrapper}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'],
          }}
        />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Center the medicine pack barcode code inside the camera view</Text>
          <TouchableOpacity style={styles.closeScanBtn} onPress={() => setIsScanning(false)}>
            <Text style={styles.closeScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Logged in Pharmacist,</Text>
          <Text style={styles.nameText}>{user?.name}</Text>
          <Text style={styles.roleText}>{user?.role.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {!activePrescription ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Prescriptions</Text>
          {prescriptions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Clipboard size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No pending prescriptions for today.</Text>
            </View>
          ) : (
            prescriptions.map(p => (
              <TouchableOpacity 
                key={p.id} 
                style={styles.card}
                onPress={() => {
                  setActivePrescription(p);
                  setScannedItems([]);
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.timeText}>ID: {p.id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.badgeText}>PENDING</Text>
                </View>
                <Text style={styles.patientLabel}>Patient: {p.patient_name || 'Anonymous'}</Text>
                <Text style={styles.detailsText}>Contains: {p.items.length} prescribed items</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        <View style={styles.detailContainer}>
          <TouchableOpacity style={styles.backButton} onPress={() => setActivePrescription(null)}>
            <Text style={styles.backText}>← Back to Order Inbox</Text>
          </TouchableOpacity>

          <Text style={styles.detailTitle}>Medication Verification</Text>
          <Text style={styles.patientSub}>Patient: {activePrescription.patient_name || 'Anonymous'}</Text>

          <View style={styles.itemsList}>
            {activePrescription.items.map((item: any, idx: number) => {
              const isVerified = scannedItems.includes(item.medicine_id) || Platform.OS === 'web';
              return (
                <View key={item.medicine_id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.medicine_name}</Text>
                    <Text style={styles.itemSpec}>Dosage: {item.dosage} | Duration: {item.duration}</Text>
                    <Text style={styles.itemQty}>Qty: {item.quantity_prescribed} tabs</Text>
                  </View>
                  {isVerified ? (
                    <Text style={styles.verifiedText}>✓ Verified</Text>
                  ) : (
                    <Text style={styles.unverifiedText}>Pending Scan</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Verification Actions */}
          {scannedItems.length < activePrescription.items.length && Platform.OS !== 'web' ? (
            <TouchableOpacity style={styles.scanButton} onPress={handleOpenScanner}>
              <Text style={styles.scanButtonText}>Verify package barcode ({scannedItems.length}/{activePrescription.items.length})</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.dispenseButton} onPress={handleDispense}>
              <Text style={styles.dispenseButtonText}>Dispense Medications</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 12, color: colors.secondary, fontSize: 12, fontWeight: 'bold' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  welcomeText: { fontSize: 12, color: colors.textMuted, fontWeight: 'bold' },
  nameText: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginTop: 2 },
  roleText: { fontSize: 9, fontWeight: '800', color: colors.accent, marginTop: 4 },
  logoutButton: { padding: 10, borderRadius: 12, backgroundColor: '#fee2e2' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontWeight: '500' },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 10 },
  timeText: { fontSize: 12, fontWeight: 'bold', color: colors.primary },
  badgeText: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#fef3c7', color: '#d97706' },
  patientLabel: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  detailsText: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  detailContainer: { backgroundColor: colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border },
  backButton: { marginBottom: 16 },
  backText: { color: colors.accent, fontWeight: 'bold', fontSize: 12 },
  detailTitle: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
  patientSub: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 20 },
  itemsList: { marginBottom: 20 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 13, fontWeight: 'bold', color: colors.text },
  itemSpec: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  itemQty: { fontSize: 11, color: colors.secondary, fontWeight: 'bold', marginTop: 2 },
  verifiedText: { fontSize: 11, fontWeight: 'bold', color: '#059669' },
  unverifiedText: { fontSize: 11, fontWeight: 'bold', color: '#d97706' },
  scanButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  scanButtonText: { color: colors.white, fontWeight: 'bold', fontSize: 13 },
  dispenseButton: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  dispenseButtonText: { color: colors.white, fontWeight: 'bold', fontSize: 13 },
  scannerWrapper: { flex: 1, backgroundColor: 'black' },
  scannerOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' },
  scannerText: { color: 'white', textAlign: 'center', marginBottom: 20, fontSize: 12, fontWeight: 'bold' },
  closeScanBtn: { backgroundColor: 'white', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  closeScanText: { color: 'black', fontWeight: 'bold' }
});
export default PharmacistDashboardScreen;
