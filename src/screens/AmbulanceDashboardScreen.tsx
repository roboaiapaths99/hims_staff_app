import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Alert, Platform 
} from 'react-native';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import * as Location from 'expo-location';
import { Truck, Compass, CheckCircle2, Phone, LogOut, ArrowLeft, AlertTriangle } from 'lucide-react-native';

export const AmbulanceDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Incoming Live SOS broadcasts
  const [incomingSOS, setIncomingSOS] = useState<any[]>([]);

  // Geo-location state
  const [locationSub, setLocationSub] = useState<any>(null);
  const [coords, setCoords] = useState<any>(null);

  useEffect(() => {
    fetchAssignedTasks();
    setupLocationTracking();
    fetchUnclaimedSOS();

    // Setup live socket connection for drivers
    const socketBase = 'http://localhost:8002'; // default development backend address
    const socket = io(socketBase, {
      transports: ['websocket'],
      upgrade: false
    });

    socket.on('connect', () => {
      console.log('Mobile driver socket connected:', socket.id);
      socket.emit('join_drivers');
    });

    socket.on('sos_alert', (data: any) => {
      console.log('Urgent SOS broadcast received on mobile driver:', data);
      setIncomingSOS((prev) => {
        if (prev.some((x) => x.id === data.id)) return prev;
        return [data, ...prev];
      });
    });

    socket.on('sos_claimed', (data: any) => {
      console.log('SOS alert claimed elsewhere:', data);
      setIncomingSOS((prev) => prev.filter((x) => x.id !== data.id));
    });

    return () => {
      if (locationSub) {
        locationSub.remove();
      }
      socket.disconnect();
    };
  }, []);

  const fetchUnclaimedSOS = async () => {
    try {
      const res = await apiClient.get('/api/emergency/sos/unclaimed');
      setIncomingSOS(res.data);
    } catch (e) {
      console.warn('Failed to fetch unclaimed SOS broadcasts', e);
    }
  };

  const handleClaimSOS = async (sosId: string) => {
    setIsUpdating(sosId);
    try {
      await apiClient.post(`/api/emergency/claim-sos/${sosId}`);
      Alert.alert('SOS Claimed Successfully', 'The dispatch is registered to you. Start transit immediately!');
      fetchUnclaimedSOS();
      fetchAssignedTasks();
    } catch (e: any) {
      Alert.alert('Claim Failed', e.response?.data?.detail || 'SOS alert was claimed by another driver.');
      fetchUnclaimedSOS();
    } finally {
      setIsUpdating(null);
    }
  };

  const setupLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Foreground location permission denied.');
        return;
      }
      
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 15000,
          distanceInterval: 10,
        },
        (loc) => {
          setCoords(loc.coords);
          // Broadcast live coordinates to backend
          sendLocationUpdate(loc.coords);
        }
      );
      setLocationSub(sub);
    } catch (e) {
      console.warn('Failed to start location streaming:', e);
    }
  };

  const sendLocationUpdate = async (coordinates: any) => {
    try {
      await apiClient.post('/api/emergency/ambulance/location', {
        driver_id: user?.id,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      // Fail silently in background
    }
  };

  const fetchAssignedTasks = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/emergency/ambulance');
      const assigned = res.data.filter((b: any) => 
        b.driver_name?.toLowerCase() === user?.name?.toLowerCase() && b.status !== 'completed' && b.status !== 'cancelled'
      );
      setTasks(assigned);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAssignedTasks();
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

  const handleUpdateStatus = async (bookingId: string, currentStatus: string) => {
    let nextStatus = '';
    let confirmMsg = '';

    if (currentStatus === 'dispatched') {
      nextStatus = 'arrived';
      confirmMsg = 'Mark as arrived at pickup location?';
    } else if (currentStatus === 'arrived') {
      nextStatus = 'en_route_hospital';
      confirmMsg = 'Patient loaded. Start transit to hospital?';
    } else if (currentStatus === 'en_route_hospital') {
      nextStatus = 'completed';
      confirmMsg = 'Admissions completed. Mark trip as finished?';
    } else {
      return;
    }

    Alert.alert('Update Transit Status', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Proceed', 
        onPress: async () => {
          setIsUpdating(bookingId);
          try {
            await apiClient.put(`/api/emergency/ambulance/${bookingId}`, { status: nextStatus });
            fetchAssignedTasks();
          } catch (e: any) {
            Alert.alert('Update Failed', e.response?.data?.detail || 'Failed to update transit status.');
          } finally {
            setIsUpdating(null);
          }
        } 
      }
    ]);
  };

  if (isLoading && !isRefreshing && tasks.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Syncing Ambulance Tasks...</Text>
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
          <Text style={styles.welcomeText}>Ambulance Dispatch Hub,</Text>
          <Text style={styles.driverName}>{user?.name}</Text>
          <Text style={styles.roleText}>{user?.role.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* GPS Status */}
      {coords && (
        <View style={styles.gpsBadge}>
          <Compass size={16} color="#059669" />
          <Text style={styles.gpsText}>GPS Location Active: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</Text>
        </View>
      )}

      {/* Incoming Live SOS broadcasts */}
      {incomingSOS.length > 0 && (
        <View style={{ backgroundColor: '#fee2e2', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#fca5a5', marginBottom: 20 }}>
          <Text style={[styles.sectionTitle, { color: '#dc2626', marginBottom: 12 }]}>📢 Incoming Emergency Broadcasts</Text>
          {incomingSOS.map((alert) => (
            <View key={alert.id} style={[styles.card, { borderColor: '#ef4444', marginBottom: 12 }]}>
              <View style={styles.cardHeader}>
                <AlertTriangle size={20} color="#dc2626" style={{ marginRight: 6 }} />
                <Text style={[styles.vehicleText, { color: '#dc2626' }]}>URGENT SOS ALERT</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.infoText}>Patient Details:</Text>
                <Text style={styles.patientVal}>{alert.patient_name} (MRN: {alert.mrn || 'N/A'})</Text>

                <Text style={styles.infoText}>GPS Coordinates:</Text>
                <Text style={styles.addressVal}>
                  Lat: {alert.latitude?.toFixed(5) || 'Fallback'}, Lng: {alert.longitude?.toFixed(5) || 'Fallback'}
                </Text>

                <Text style={styles.infoText}>Resolved Area:</Text>
                <Text style={styles.addressVal}>{alert.address_resolved || 'Branch Location Fallback'}</Text>

                {isUpdating === alert.id ? (
                  <ActivityIndicator size="small" color="#dc2626" style={styles.loader} />
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: '#dc2626' }]}
                    onPress={() => handleClaimSOS(alert.id)}
                  >
                    <Text style={styles.actionBtnText}>CLAIM EMERGENCY ALARM</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assigned Trips</Text>
        {tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <CheckCircle2 size={32} color={colors.secondary} />
            <Text style={styles.emptyText}>You currently have no active emergency dispatches.</Text>
          </View>
        ) : (
          tasks.map(item => {
            const getStatusLabel = (status: string) => {
              switch (status) {
                case 'dispatched': return 'Confirm Arrival at Site';
                case 'arrived': return 'Confirm Patient Loaded';
                case 'en_route_hospital': return 'Confirm Hospital Arrival';
                default: return status.toUpperCase();
              }
            };

            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Truck size={20} color={colors.accent} />
                  <Text style={styles.vehicleText}>Vehicle: {item.vehicle_number || 'N/A'}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.infoText}>Pickup Address:</Text>
                  <Text style={styles.addressVal}>{item.pickup_address}</Text>

                  <Text style={styles.infoText}>Patient Contact:</Text>
                  <Text style={styles.patientVal}>{item.patient_name} ({item.patient_phone || 'No phone'})</Text>

                  {item.notes && (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>Notes: "{item.notes}"</Text>
                    </View>
                  )}

                  {isUpdating === item.id ? (
                    <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
                  ) : (
                    <TouchableOpacity 
                      style={styles.actionBtn}
                      onPress={() => handleUpdateStatus(item.id, item.status)}
                    >
                      <Text style={styles.actionBtnText}>{getStatusLabel(item.status)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
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
  driverName: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginTop: 2 },
  roleText: { fontSize: 9, fontWeight: '800', color: colors.accent, marginTop: 4 },
  logoutButton: { padding: 10, borderRadius: 12, backgroundColor: '#fee2e2' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e6f4ea', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#a3cfbb', marginBottom: 18 },
  gpsText: { fontSize: 11, color: '#137333', fontWeight: 'bold', marginLeft: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontWeight: '500', textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 12 },
  vehicleText: { fontSize: 13, fontWeight: 'bold', color: colors.primary, marginLeft: 8, flex: 1 },
  statusBadge: { backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: 'bold', color: colors.white },
  cardBody: { paddingTop: 4 },
  infoText: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
  addressVal: { fontSize: 13, color: colors.text, marginBottom: 12, lineHeight: 18 },
  patientVal: { fontSize: 13, color: colors.text, marginBottom: 12 },
  notesBox: { backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 16 },
  notesText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
  actionBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  actionBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 13 },
  loader: { paddingVertical: 12 }
});
export default AmbulanceDashboardScreen;
