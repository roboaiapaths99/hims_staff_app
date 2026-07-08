import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, RefreshControl, Platform 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { User, Clipboard, Plus, Calendar, Search, LogOut, CheckCircle, Bed } from 'lucide-react-native';

export const ReceptionDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab State
  const [currentTab, setCurrentTab] = useState<'appointments' | 'beds'>('appointments');

  // Bed Management State
  const [rooms, setRooms] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [showAdmitForm, setShowAdmitForm] = useState(false);
  
  // Admission Form Fields
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [patientIdInput, setPatientIdInput] = useState('');
  const [doctorIdInput, setDoctorIdInput] = useState('');
  const [initialDepositInput, setInitialDepositInput] = useState('5000');

  // New patient registration form state
  const [showRegForm, setShowRegForm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('1990-01-01');
  const [gender, setGender] = useState('male');
  const [address, setAddress] = useState('N/A');

  useEffect(() => {
    if (currentTab === 'appointments') {
      fetchAppointments();
    } else {
      fetchBedsData();
    }
  }, [currentTab]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/appointments');
      setAppointments(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchBedsData = async () => {
    setIsLoading(true);
    try {
      const roomsRes = await apiClient.get('/api/config/rooms');
      const admissionsRes = await apiClient.get('/api/ipd/admissions', { 
        params: { status_filter: 'admitted' } 
      });
      setRooms(roomsRes.data);
      setAdmissions(admissionsRes.data);
    } catch (e) {
      console.error('Failed to load beds data:', e);
      Alert.alert('Sync Error', 'Could not retrieve IPD ward layout.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (currentTab === 'appointments') {
      fetchAppointments();
    } else {
      fetchBedsData();
    }
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

  const handleCheckIn = async (apptId: string) => {
    setIsLoading(true);
    try {
      await apiClient.put(`/api/appointments/${apptId}/status`, {
        status: 'ready_for_doctor'
      });
      Alert.alert('Success', 'Patient check-in completed. Added to clinician active queue.');
      fetchAppointments();
    } catch (e: any) {
      Alert.alert('Check-In Failed', e.response?.data?.detail || 'Failed to check-in patient.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterPatient = async () => {
    if (!firstName || !lastName || !phone) {
      Alert.alert('Missing Fields', 'First name, last name, and phone number are required.');
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.post('/api/auth/patient/register', {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        dob: dob,
        gender: gender,
        address: address,
        emergency_contact_name: 'N/A',
        emergency_contact_phone: 'N/A',
        tenant_id: user?.tenant_id,
        branch_id: user?.branch_id
      });
      Alert.alert('Registration Successful', `Patient profile generated for ${firstName} ${lastName}`);
      setShowRegForm(false);
      setFirstName('');
      setLastName('');
      setPhone('');
      fetchAppointments();
    } catch (e: any) {
      Alert.alert('Registration Failed', e.response?.data?.detail || 'Failed to create patient account.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit patient admission (IPD)
  const handleAdmitPatient = async () => {
    if (!patientIdInput || !doctorIdInput) {
      Alert.alert('Required Fields', 'Please supply valid Patient ID and Doctor ID.');
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.post('/api/ipd/admissions', {
        patient_id: patientIdInput,
        doctor_id: doctorIdInput,
        room_id: selectedRoom.id,
        initial_deposit: parseFloat(initialDepositInput),
        admission_date: new Date().toISOString()
      });
      Alert.alert('Admission Confirmed', `Patient has been assigned to Room ${selectedRoom.room_number}`);
      setShowAdmitForm(false);
      setSelectedRoom(null);
      setPatientIdInput('');
      setDoctorIdInput('');
      fetchBedsData();
    } catch (e: any) {
      Alert.alert('Admission Failed', e.response?.data?.detail || 'Verify room availability/credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Discharge patient (IPD)
  const handleDischarge = async (admissionId: string) => {
    setIsLoading(true);
    try {
      await apiClient.post(`/api/ipd/admissions/${admissionId}/discharge`, {
        discharge_summary: 'Discharged standard recovery procedure.'
      });
      Alert.alert('Success', 'Patient discharged. Bed has been cleaned and marked available.');
      fetchBedsData();
    } catch (e: any) {
      Alert.alert('Discharge Failed', e.response?.data?.detail || 'Failed to complete discharge.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAppts = appointments.filter(a => 
    a.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.mrn?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <Text style={styles.welcomeText}>Front Desk Reception Console,</Text>
          <Text style={styles.receptName}>{user?.name}</Text>
          <Text style={styles.roleText}>{user?.role.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Segmented Navigation Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'appointments' && styles.activeTabButton]}
          onPress={() => { setCurrentTab('appointments'); setShowRegForm(false); }}
        >
          <Text style={[styles.tabButtonText, currentTab === 'appointments' && styles.activeTabButtonText]}>OPD Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'beds' && styles.activeTabButton]}
          onPress={() => { setCurrentTab('beds'); setShowRegForm(false); }}
        >
          <Text style={[styles.tabButtonText, currentTab === 'beds' && styles.activeTabButtonText]}>Bed Allocation</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !isRefreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Synchronizing with Central Database...</Text>
        </View>
      )}

      {currentTab === 'appointments' && !isLoading && (
        !showRegForm ? (
          <View style={styles.section}>
            <View style={styles.titleRow}>
              <Text style={styles.sectionTitle}>Daily Bookings & Intake</Text>
              <TouchableOpacity style={styles.regBtn} onPress={() => setShowRegForm(true)}>
                <Plus size={14} color={colors.white} />
                <Text style={styles.regBtnText}>New Patient</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search appointments by Patient Name or MRN"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {filteredAppts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Calendar size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No appointments booked for today.</Text>
              </View>
            ) : (
              filteredAppts.map(a => {
                const isCheckedIn = ['ready_for_doctor', 'in_vitals', 'in_consultation', 'completed'].includes(a.status);
                return (
                  <View key={a.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.timeText}>{a.start_time} - {a.end_time}</Text>
                      <Text style={[
                        styles.statusBadge,
                        { backgroundColor: isCheckedIn ? '#d1fae5' : '#f3f4f6', color: isCheckedIn ? '#059669' : '#374151' }
                      ]}>
                        {a.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.nameText}>Patient: {a.patient_name}</Text>
                    <Text style={styles.mrnText}>MRN: {a.mrn || 'No MRN'}</Text>
                    <Text style={styles.doctorLabel}>Assigned Doctor: Dr. {a.doctor_name || 'N/A'}</Text>

                    {!isCheckedIn && (
                      <TouchableOpacity style={styles.checkInBtn} onPress={() => handleCheckIn(a.id)}>
                        <Text style={styles.checkInBtnText}>Check In Patient</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowRegForm(false)}>
              <Text style={styles.backText}>← Back to Appointments</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Register New Patient Profile</Text>

            <View style={styles.grid}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Patient Full Name (First Name / Last Name)</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="First name"
                    placeholderTextColor={colors.textMuted}
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Last name"
                    placeholderTextColor={colors.textMuted}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +91 9876543210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date of Birth (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1990-05-15"
                  placeholderTextColor={colors.textMuted}
                  value={dob}
                  onChangeText={setDob}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender & Address</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="male / female / other"
                    placeholderTextColor={colors.textMuted}
                    value={gender}
                    onChangeText={setGender}
                  />
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="City Address"
                    placeholderTextColor={colors.textMuted}
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleRegisterPatient}>
              <Text style={styles.submitBtnText}>Provision Patient Profile</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {currentTab === 'beds' && !isLoading && (
        !showAdmitForm ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ward Occupancy & Room Status</Text>

            {rooms.length === 0 ? (
              <View style={styles.emptyCard}>
                <Bed size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No room configurations found.</Text>
              </View>
            ) : (
              rooms.map(room => {
                const admission = admissions.find(adm => adm.room_id === room.id);
                const isOccupied = room.status === 'occupied';

                return (
                  <View key={room.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.roomNoText}>Room: {room.room_number}</Text>
                      <Text style={[
                        styles.statusBadge,
                        { backgroundColor: isOccupied ? '#fef3c7' : '#d1fae5', color: isOccupied ? '#b45309' : '#059669' }
                      ]}>
                        {room.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.roomTypeText}>Class: {room.room_type.toUpperCase()}</Text>
                    <Text style={styles.roomRateText}>Base Charge: ₹{room.hourly_rate}/hr</Text>

                    {isOccupied && admission ? (
                      <View style={styles.occupantContainer}>
                        <Text style={styles.occupantText}>Occupant: {admission.patient_name}</Text>
                        <Text style={styles.occupantMrn}>MRN: {admission.patient_mrn}</Text>
                        <Text style={styles.doctorLabel}>Doctor: Dr. {admission.doctor_name}</Text>
                        <TouchableOpacity 
                          style={styles.dischargeBtn} 
                          onPress={() => handleDischarge(admission.id)}
                        >
                          <Text style={styles.dischargeBtnText}>Process Discharge</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={styles.admitBtn} 
                        onPress={() => { setSelectedRoom(room); setShowAdmitForm(true); }}
                      >
                        <Text style={styles.admitBtnText}>Admit Patient here</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => { setShowAdmitForm(false); setSelectedRoom(null); }}>
              <Text style={styles.backText}>← Back to Rooms</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>IPD Patient Admission</Text>
            <Text style={styles.selectedRoomHeader}>Target: Room {selectedRoom?.room_number} ({selectedRoom?.room_type})</Text>

            <View style={styles.grid}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Patient ID (Hex ID)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter MongoDB Patient ID"
                  placeholderTextColor={colors.textMuted}
                  value={patientIdInput}
                  onChangeText={setPatientIdInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Admitting Practitioner ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter Doctor User ID"
                  placeholderTextColor={colors.textMuted}
                  value={doctorIdInput}
                  onChangeText={setDoctorIdInput}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Initial Security Deposit (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5000"
                  keyboardType="numeric"
                  placeholderTextColor={colors.textMuted}
                  value={initialDepositInput}
                  onChangeText={setInitialDepositInput}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleAdmitPatient}>
              <Text style={styles.submitBtnText}>Confirm Ward Admission</Text>
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
  receptName: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginTop: 2 },
  roleText: { fontSize: 9, fontWeight: '800', color: colors.accent, marginTop: 4 },
  logoutButton: { padding: 10, borderRadius: 12, backgroundColor: '#fee2e2' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12, marginBottom: 18 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabButtonText: { fontSize: 12, color: colors.textMuted, fontWeight: 'bold' },
  activeTabButtonText: { color: colors.primary },
  section: { marginBottom: 24 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.secondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  regBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  regBtnText: { color: colors.white, fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: colors.text },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontWeight: '500' },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8, marginBottom: 10 },
  timeText: { fontSize: 12, fontWeight: 'bold', color: colors.primary },
  roomNoText: { fontSize: 13, fontWeight: 'bold', color: colors.primary },
  roomTypeText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  roomRateText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statusBadge: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  nameText: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  mrnText: { fontSize: 11, color: colors.secondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2, fontWeight: '600' },
  doctorLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  checkInBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 12 },
  checkInBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 12 },
  admitBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 12 },
  admitBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 12 },
  occupantContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  occupantText: { fontSize: 13, fontWeight: 'bold', color: colors.text },
  occupantMrn: { fontSize: 11, color: colors.secondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
  dischargeBtn: { backgroundColor: colors.danger, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 12 },
  dischargeBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 12 },
  formContainer: { backgroundColor: colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border },
  backButton: { marginBottom: 16 },
  backText: { color: colors.accent, fontWeight: 'bold', fontSize: 12 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginBottom: 8 },
  selectedRoomHeader: { fontSize: 12, color: colors.secondary, fontWeight: 'bold', marginBottom: 20 },
  grid: { marginBottom: 16 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: colors.secondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.text, backgroundColor: colors.background },
  row: { flexDirection: 'row' },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 13 }
});
export default ReceptionDashboardScreen;
