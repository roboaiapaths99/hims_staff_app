import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, RefreshControl, Platform 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { Beaker, Search, LogOut, CheckCircle, Plus } from 'lucide-react-native';

export const LabTechnicianDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Results entry form states
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [resultValues, setResultValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchLabOrders();
  }, []);

  const fetchLabOrders = async () => {
    setIsLoading(true);
    try {
      // Query pending orders
      const res = await apiClient.get('/api/labs/orders');
      // Show active lab order lifecycles
      const active = res.data.filter((o: any) => 
        ['ordered', 'sample_collected'].includes(o.status)
      );
      setOrders(active);
    } catch (e) {
      console.error('Failed to load lab orders:', e);
      Alert.alert('Network Error', 'Could not sync lab workspace.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchLabOrders();
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out of the lab console?')) logout();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', onPress: logout, style: 'destructive' }
      ]);
    }
  };

  // Collect Sample: status -> sample_collected
  const handleCollectSample = async (orderId: string) => {
    setIsLoading(true);
    try {
      await apiClient.put(`/api/labs/orders/${orderId}/status`, null, {
        params: { status: 'sample_collected' }
      });
      Alert.alert('Success', 'Specimen collected & logged. Order ready for results entry.');
      fetchLabOrders();
    } catch (e: any) {
      Alert.alert('Action Failed', e.response?.data?.detail || 'Failed to update sample collection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit lab results
  const handleSubmitResults = async () => {
    // Make sure we entered something
    const entries = selectedOrder.items.map((item: any) => {
      const val = resultValues[item.test_id] || '';
      return {
        test_id: item.test_id,
        test_name: item.test_name,
        result_value: val,
        normal_range: '',
        unit: '',
        abnormal_flag: false
      };
    });

    const emptyValue = entries.some((e: any) => !e.result_value);
    if (emptyValue) {
      Alert.alert('Missing Values', 'Please specify a value for each lab test parameter.');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post(`/api/labs/orders/${selectedOrder.id}/results`, {
        results: entries
      });
      Alert.alert('Success', 'Laboratory metrics logged and dispatched to EMR directory.');
      setSelectedOrder(null);
      setResultValues({});
      fetchLabOrders();
    } catch (e: any) {
      Alert.alert('Submission Failed', e.response?.data?.detail || 'Failed to post lab result sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => 
    o.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.doctor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.id.slice(-8).toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Text style={styles.welcomeText}>Pathology & Lab Workspace,</Text>
          <Text style={styles.techName}>{user?.name}</Text>
          <Text style={styles.roleText}>{user?.role.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {isLoading && !isRefreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Syncing laboratory diagnostics...</Text>
        </View>
      )}

      {!isLoading && (
        !selectedOrder ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Lab Orders</Text>

            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Patient Name or Order ID"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {filteredOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Beaker size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No pending laboratory orders found.</Text>
              </View>
            ) : (
              filteredOrders.map(order => {
                const isSampleCollected = order.status === 'sample_collected';
                return (
                  <View key={order.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.orderId}>Order: #{order.id.slice(-8).toUpperCase()}</Text>
                      <Text style={[
                        styles.statusBadge,
                        { backgroundColor: isSampleCollected ? '#fee2e2' : '#eff6ff', color: isSampleCollected ? '#ef4444' : '#3b82f6' }
                      ]}>
                        {order.status.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                    </View>

                    <Text style={styles.infoText}>Patient: {order.patient_name}</Text>
                    <Text style={styles.infoText}>Prescribed by: Dr. {order.doctor_name}</Text>
                    
                    <Text style={styles.testsLabel}>Requested Investigations:</Text>
                    {order.items.map((item: any, idx: number) => (
                      <Text key={idx} style={styles.testItem}>• {item.test_name}</Text>
                    ))}

                    {!isSampleCollected ? (
                      <TouchableOpacity 
                        style={styles.collectBtn} 
                        onPress={() => handleCollectSample(order.id)}
                      >
                        <Text style={styles.btnText}>Collect Sample</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.resultsBtn} 
                        onPress={() => setSelectedOrder(order)}
                      >
                        <Text style={styles.btnText}>Enter Lab Values</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => { setSelectedOrder(null); setResultValues({}); }}
            >
              <Text style={styles.backText}>← Back to Order Directory</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Enter Lab Investigation Metrics</Text>
            <Text style={styles.patientTarget}>Patient: {selectedOrder.patient_name}</Text>
            <Text style={styles.orderId}>Ref: Order #{selectedOrder.id.slice(-8).toUpperCase()}</Text>

            <View style={styles.grid}>
              {selectedOrder.items.map((item: any) => (
                <View key={item.test_id} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{item.test_name}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter diagnostic result value..."
                    placeholderTextColor={colors.textMuted}
                    value={resultValues[item.test_id] || ''}
                    onChangeText={(val) => setResultValues(prev => ({ ...prev, [item.test_id]: val }))}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmitResults}>
              <Text style={styles.submitBtnText}>Verify and Dispatch Results</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  loadingContainer: { marginVertical: 32, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: colors.secondary, fontSize: 12, fontWeight: 'bold' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  welcomeText: { fontSize: 12, color: colors.textMuted, fontWeight: 'bold' },
  techName: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginTop: 2 },
  roleText: { fontSize: 9, fontWeight: '800', color: colors.accent, marginTop: 4 },
  logoutButton: { padding: 10, borderRadius: 12, backgroundColor: '#fee2e2' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: colors.text },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontWeight: '500' },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 10 },
  orderId: { fontSize: 12, fontWeight: 'bold', color: colors.primary },
  statusBadge: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  infoText: { fontSize: 13, color: colors.text, marginTop: 4, fontWeight: '500' },
  testsLabel: { fontSize: 11, fontWeight: 'bold', color: colors.secondary, marginTop: 10, marginBottom: 4 },
  testItem: { fontSize: 12, color: colors.textMuted, marginLeft: 8, marginVertical: 2 },
  collectBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 14 },
  resultsBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 14 },
  btnText: { color: colors.white, fontWeight: 'bold', fontSize: 12 },
  formContainer: { backgroundColor: colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border },
  backButton: { marginBottom: 16 },
  backText: { color: colors.accent, fontWeight: 'bold', fontSize: 12 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
  patientTarget: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginTop: 4 },
  grid: { marginTop: 16, marginBottom: 16 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: colors.secondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.text, backgroundColor: colors.background },
  submitBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 13 }
});
export default LabTechnicianDashboardScreen;
