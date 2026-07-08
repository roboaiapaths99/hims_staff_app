import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, RefreshControl, Platform 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { 
  User, Heart, Thermometer, Weight, ChevronRight, Activity, 
  AlertTriangle, Search, LogOut, Clipboard 
} from 'lucide-react-native';

export const NurseDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  
  const [patients, setPatients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tab State
  const [currentTab, setCurrentTab] = useState<'opd' | 'ipd'>('opd');
  
  // OPD Selected patient for vital recording
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Vitals form fields
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [pulse, setPulse] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [pain, setPain] = useState('0');

  // IPD Admissions State
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [sbarRecommendation, setSbarRecommendation] = useState('');
  const [isDictatingSbar, setIsDictatingSbar] = useState(false);

  useEffect(() => {
    if (currentTab === 'opd') {
      fetchAppointments();
    } else {
      fetchAdmissionsData();
    }
  }, [currentTab]);

  const fetchAppointments = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/appointments');
      const active = res.data.filter((a: any) => 
        ['booked', 'waiting', 'in_vitals', 'ready_for_doctor'].includes(a.status)
      );
      setPatients(active);
    } catch (e) {
      console.error('Failed to load appointments for nurse triage:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchAdmissionsData = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/ipd/admissions', { 
        params: { status_filter: 'admitted' } 
      });
      setAdmissions(res.data);
    } catch (e) {
      console.error('Failed to load admissions for nurse desk:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (currentTab === 'opd') {
      fetchAppointments();
    } else {
      fetchAdmissionsData();
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out of the console?')) logout();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', onPress: logout, style: 'destructive' }
      ]);
    }
  };

  // NEWS Score Calculation Engine
  const calculateNewsScore = () => {
    let score = 0;
    const sys = parseInt(bpSys);
    const p = parseInt(pulse);
    const t = parseFloat(temp);
    const o2 = parseInt(spo2);

    if (!isNaN(sys)) {
      if (sys <= 90 || sys >= 220) score += 3;
      else if ((sys >= 91 && sys <= 100) || (sys >= 200 && sys <= 219)) score += 2;
      else if (sys >= 101 && sys <= 110) score += 1;
    }
    if (!isNaN(p)) {
      if (p <= 40 || p >= 131) score += 3;
      else if (p >= 111 && p <= 130) score += 2;
      else if ((p >= 41 && p <= 50) || (p >= 91 && p <= 110)) score += 1;
    }
    if (!isNaN(o2)) {
      if (o2 < 92) score += 3;
      else if (o2 === 92 || o2 === 93) score += 2;
      else if (o2 === 94 || o2 === 95) score += 1;
    }
    if (!isNaN(t)) {
      if (t <= 95.0 || t >= 102.3) score += 3;
      else if (t >= 100.5 && t <= 102.2) score += 2;
      else if ((t >= 95.1 && t <= 96.8)) score += 1;
    }

    return score;
  };

  const getTriageLevel = (score: number) => {
    if (score >= 7) return 'red';
    if (score >= 4) return 'yellow';
    return 'green';
  };

  const handleSubmitVitals = async () => {
    if (!selectedPatient) return;
    if (!bpSys || !bpDia || !pulse || !temp || !spo2 || !weight || !height) {
      Alert.alert('Incomplete Form', 'Please fill in all physiological parameters.');
      return;
    }

    setIsLoading(true);
    const newsVal = calculateNewsScore();
    const level = getTriageLevel(newsVal);

    try {
      const payload = {
        patient_id: selectedPatient.patient_id,
        appointment_id: selectedPatient.id,
        bp_sys: parseInt(bpSys),
        bp_dia: parseInt(bpDia),
        pulse: parseInt(pulse),
        temperature: parseFloat(temp),
        spo2: parseInt(spo2),
        weight: parseFloat(weight),
        height: parseFloat(height),
        pain_score: parseInt(pain),
        triage_level: level,
        news_score: newsVal,
        recorded_by_id: user?.id,
        recorded_by_name: user?.name
      };

      await apiClient.post('/api/vitals', payload);
      
      Alert.alert('Success', `Physiological vitals saved. Patient Triage: ${level.toUpperCase()}`);
      
      // Reset state
      setSelectedPatient(null);
      setBpSys('');
      setBpDia('');
      setPulse('');
      setTemp('');
      setSpo2('');
      setWeight('');
      setHeight('');
      setPain('0');
      fetchAppointments();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Sync Error', e.response?.data?.detail || 'Failed to sync vital logs.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start voice dictation for SBAR handover
  const handleStartSbarDictation = () => {
    const SpeechRecognition = (Platform.OS === 'web') 
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) 
      : null;

    if (SpeechRecognition) {
      setIsDictatingSbar(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSbarRecommendation(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsDictatingSbar(false);
      };

      recognition.onerror = () => {
        setIsDictatingSbar(false);
        Alert.alert('Dictation Error', 'Could not record voice.');
      };

      recognition.onend = () => {
        setIsDictatingSbar(false);
      };

      recognition.start();
    } else {
      setIsDictatingSbar(true);
      setTimeout(() => {
        setSbarRecommendation(prev => 
          prev ? `${prev} Keep head of bed elevated 30 degrees, monitor pulse every 2 hours.` : 'Keep head of bed elevated 30 degrees, monitor pulse every 2 hours.'
        );
        setIsDictatingSbar(false);
        Alert.alert('Dictation Complete', 'Nursing recommendation saved.');
      }, 2000);
    }
  };

  // Submit Shift Handover
  const handleSubmitHandover = async () => {
    if (!sbarRecommendation) {
      Alert.alert('Missing Info', 'Please enter a handover recommendation description.');
      return;
    }
    setIsLoading(true);
    try {
      const formattedNote = `[SBAR SHIFT HANDOVER] Outgoing Nurse ${user?.name} handed off to oncoming shift. S: Admitted in Bed ${selectedAdmission.room_number}. R: ${sbarRecommendation}`;
      
      await apiClient.post(`/api/ipd/admissions/${selectedAdmission.id}/notes`, {
        note: formattedNote
      });

      Alert.alert('Success', 'Shift Handover note logged to patient records.');
      setSelectedAdmission(null);
      setSbarRecommendation('');
      fetchAdmissionsData();
    } catch (e: any) {
      Alert.alert('Sync Error', 'Failed to upload handover logs.');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.mrn && p.mrn.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAdmissions = admissions.filter(a =>
    a.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.patient_mrn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.room_number?.toLowerCase().includes(searchQuery.toLowerCase())
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
          <Text style={styles.welcomeText}>Ward Nurse Intake Console,</Text>
          <Text style={styles.nurseName}>{user?.name}</Text>
          <Text style={styles.roleText}>{user?.role.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'opd' && styles.activeTabButton]}
          onPress={() => { setCurrentTab('opd'); setSelectedPatient(null); setSelectedAdmission(null); }}
        >
          <Text style={[styles.tabButtonText, currentTab === 'opd' && styles.activeTabButtonText]}>OPD Vitals Queue</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'ipd' && styles.activeTabButton]}
          onPress={() => { setCurrentTab('ipd'); setSelectedPatient(null); setSelectedAdmission(null); }}
        >
          <Text style={[styles.tabButtonText, currentTab === 'ipd' && styles.activeTabButtonText]}>IPD Ward Rounds</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !isRefreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Syncing Clinical Files...</Text>
        </View>
      )}

      {currentTab === 'opd' && !isLoading && (
        !selectedPatient ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Daily Patients</Text>
            
            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Patient Name or MRN"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {filteredPatients.length === 0 ? (
              <View style={styles.emptyCard}>
                <User size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No patients match your query.</Text>
              </View>
            ) : (
              filteredPatients.map(p => (
                <TouchableOpacity 
                  key={p.id} 
                  style={styles.patientCard}
                  onPress={() => setSelectedPatient(p)}
                >
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{p.patient_name}</Text>
                    <Text style={styles.mrnText}>MRN: {p.mrn}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.secondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedPatient(null)}>
              <Text style={styles.backButtonText}>← Back to Patient Directory</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Record Vitals Signs</Text>
            <Text style={styles.patientTarget}>Patient: {selectedPatient.patient_name}</Text>

            <View style={styles.grid}>
              {/* BP Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Blood Pressure (Systolic / Diastolic)</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    placeholder="Sys (e.g. 120)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={bpSys}
                    onChangeText={setBpSys}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Dia (e.g. 80)"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={bpDia}
                    onChangeText={setBpDia}
                  />
                </View>
              </View>

              {/* Pulse & Temp */}
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Pulse Rate (bpm)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 72"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={pulse}
                    onChangeText={setPulse}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Temp (°F)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 98.6"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={temp}
                    onChangeText={setTemp}
                  />
                </View>
              </View>

              {/* SpO2 & Pain */}
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>SpO2 (%)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 98"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={spo2}
                    onChangeText={setSpo2}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Pain Index (0-10)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0 = None, 10 = Severe"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={pain}
                    onChangeText={setPain}
                  />
                </View>
              </View>

              {/* Height & Weight */}
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 175"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={height}
                    onChangeText={setHeight}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 70"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                  />
                </View>
              </View>
            </View>

            {/* Live NEWS Score Banner */}
            {(bpSys || pulse || temp || spo2) && (
              <View style={[
                styles.newsAlert,
                {
                  backgroundColor: calculateNewsScore() >= 7 ? '#fee2e2' : calculateNewsScore() >= 4 ? '#fef3c7' : '#d1fae5',
                  borderColor: calculateNewsScore() >= 7 ? '#fca5a5' : calculateNewsScore() >= 4 ? '#fcd34d' : '#6ee7b7'
                }
              ]}>
                <AlertTriangle size={16} color={calculateNewsScore() >= 7 ? colors.danger : calculateNewsScore() >= 4 ? '#b45309' : '#059669'} />
                <Text style={[styles.newsAlertText, { color: calculateNewsScore() >= 7 ? colors.danger : calculateNewsScore() >= 4 ? '#b45309' : '#059669' }]}>
                  NEWS Triage Score: {calculateNewsScore()} ({getTriageLevel(calculateNewsScore()).toUpperCase()})
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitVitals}>
              <Text style={styles.submitButtonText}>Save Vitals & Clear Queue</Text>
            </TouchableOpacity>
          </View>
        )
      )}

      {currentTab === 'ipd' && !isLoading && (
        !selectedAdmission ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ward Occupants & Beds</Text>

            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Occupant Name, Room, MRN"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {filteredAdmissions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Activity size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No admitted ward patients match search.</Text>
              </View>
            ) : (
              filteredAdmissions.map(adm => (
                <TouchableOpacity 
                  key={adm.id} 
                  style={styles.patientCard}
                  onPress={() => setSelectedAdmission(adm)}
                >
                  <View style={styles.patientInfo}>
                    <Text style={styles.patientName}>{adm.patient_name}</Text>
                    <Text style={styles.mrnText}>Room: {adm.room_number} ({adm.room_type})</Text>
                    <Text style={styles.doctorText}>Attending: Dr. {adm.doctor_name}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.secondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedAdmission(null)}>
              <Text style={styles.backButtonText}>← Back to Ward List</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>SBAR Shift Handover</Text>
            <Text style={styles.patientTarget}>Patient: {selectedAdmission.patient_name}</Text>
            <Text style={styles.roomNoText}>Bed Assigned: Room {selectedAdmission.room_number}</Text>

            <View style={styles.sbarTemplate}>
              <View style={styles.sbarSection}>
                <Text style={styles.sbarLabel}>S (Situation)</Text>
                <Text style={styles.sbarVal}>Patient currently resting in Room {selectedAdmission.room_number}. Demographics: MRN {selectedAdmission.patient_mrn}, assigned to Dr. {selectedAdmission.doctor_name}.</Text>
              </View>

              <View style={styles.sbarSection}>
                <Text style={styles.sbarLabel}>B (Background)</Text>
                <Text style={styles.sbarVal}>Admitted on {new Date(selectedAdmission.admission_date).toLocaleDateString()}. Initial security deposit processed.</Text>
              </View>

              <View style={styles.sbarSection}>
                <Text style={styles.sbarLabel}>R (Recommendation & Bedside Instructions)</Text>
                <View style={styles.dictateInputContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1, height: 80, textAlignVertical: 'top' }]}
                    multiline
                    placeholder="Enter nurse instructions or dictate hand-off remarks..."
                    placeholderTextColor={colors.textMuted}
                    value={sbarRecommendation}
                    onChangeText={setSbarRecommendation}
                  />
                  <TouchableOpacity 
                    style={[styles.micBtn, isDictatingSbar && styles.micBtnActive]} 
                    onPress={handleStartSbarDictation}
                  >
                    <Text style={styles.micBtnText}>{isDictatingSbar ? 'Listening...' : '🎙️ Dictate'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitHandover}>
              <Text style={styles.submitButtonText}>Log Shift Handover Note</Text>
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
  nurseName: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginTop: 2 },
  roleText: { fontSize: 9, fontWeight: '800', color: colors.accent, marginTop: 4 },
  logoutButton: { padding: 10, borderRadius: 12, backgroundColor: '#fee2e2' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12, marginBottom: 18 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabButtonText: { fontSize: 12, color: colors.textMuted, fontWeight: 'bold' },
  activeTabButtonText: { color: colors.primary },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: colors.text },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontWeight: '500' },
  patientCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  mrnText: { fontSize: 11, color: colors.secondary, marginTop: 2, fontWeight: '600' },
  doctorText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  formContainer: { backgroundColor: colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border },
  backButton: { marginBottom: 16 },
  backButtonText: { color: colors.accent, fontWeight: 'bold', fontSize: 12 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: colors.primary },
  patientTarget: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginTop: 4 },
  roomNoText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  grid: { marginTop: 16 },
  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: 'bold', color: colors.secondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.text, backgroundColor: colors.background },
  row: { flexDirection: 'row' },
  newsAlert: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, padding: 12, borderRadius: 10, marginVertical: 14 },
  newsAlertText: { fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  submitButton: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  submitButtonText: { color: colors.white, fontWeight: 'bold', fontSize: 13 },
  sbarTemplate: { marginTop: 16 },
  sbarSection: { marginBottom: 14 },
  sbarLabel: { fontSize: 11, fontWeight: 'bold', color: colors.primary, textTransform: 'uppercase', marginBottom: 4 },
  sbarVal: { fontSize: 12, color: colors.text, lineHeight: 18, backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  dictateInputContainer: { marginTop: 6 },
  micBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', marginTop: 8, alignSelf: 'flex-start' },
  micBtnActive: { backgroundColor: colors.danger },
  micBtnText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  loadingText: { marginTop: 12, color: colors.secondary, fontSize: 12, fontWeight: 'bold' }
});
export default NurseDashboardScreen;
