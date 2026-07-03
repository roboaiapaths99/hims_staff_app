import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, FlatList, Alert, RefreshControl, Platform
} from 'react-native';
import { colors } from '../theme/colors';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Truck, Compass, CheckCircle2, Phone, AlertCircle } from 'lucide-react-native';

export const AmbulanceTasksScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignedTasks();
  }, []);

  const fetchAssignedTasks = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/emergency/ambulance');
      // Filter ambulance bookings assigned to this staff driver
      const assigned = res.data.filter((b: any) => 
        b.driver_name?.toLowerCase() === user?.name?.toLowerCase() && b.status !== 'completed' && b.status !== 'cancelled'
      );
      setTasks(assigned);
    } catch (e: any) {
      console.warn('Failed to load assigned ambulance dispatches', e);
    } finally {
      setIsLoading(false);
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
      confirmMsg = 'Patient loaded. Start en-route transit to hospital?';
    } else if (currentStatus === 'en_route_hospital') {
      nextStatus = 'completed';
      confirmMsg = 'Patient admitted. Complete ambulance trip?';
    } else {
      return;
    }

    Alert.alert('Update Status', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Proceed', 
        onPress: async () => {
          setIsUpdating(bookingId);
          try {
            await apiClient.put(`/api/emergency/ambulance/${bookingId}`, { status: nextStatus });
            fetchAssignedTasks();
          } catch (e: any) {
            Alert.alert('Update Failed', e.response?.data?.detail || 'Failed to update trip status.');
          } finally {
            setIsUpdating(null);
          }
        } 
      }
    ]);
  };

  const renderTaskItem = ({ item }: { item: any }) => {
    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'dispatched': return 'Head to Pickup';
        case 'arrived': return 'Load Patient';
        case 'en_route_hospital': return 'Transit to Hospital';
        default: return status.toUpperCase();
      }
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Truck size={20} color={colors.accent} />
          <Text style={styles.vehicleText}>Vehicle: {item.vehicle_number || 'N/A'}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.infoText}><Compass size={12} color={colors.textMuted} /> Pickup Address:</Text>
          <Text style={styles.addressVal}>{item.pickup_address}</Text>

          <Text style={styles.infoText}><Phone size={12} color={colors.textMuted} /> Patient Contact:</Text>
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ambulance Duty Tasks</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.accent} style={styles.centerLoader} />
      ) : tasks.length === 0 ? (
        <ScrollView 
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAssignedTasks} />}
        >
          <CheckCircle2 size={50} color={colors.secondary} />
          <Text style={styles.emptyTitle}>All Clear</Text>
          <Text style={styles.emptySubtitle}>You currently have no emergency dispatch tasks assigned to your name.</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTaskItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={fetchAssignedTasks}
          refreshing={isLoading}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  centerLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
    marginBottom: 12,
  },
  vehicleText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 8,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
  },
  cardBody: {
    paddingTop: 4,
  },
  infoText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  addressVal: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 18,
  },
  patientVal: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 12,
  },
  notesBox: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  loader: {
    paddingVertical: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  }
});
export default AmbulanceTasksScreen;
