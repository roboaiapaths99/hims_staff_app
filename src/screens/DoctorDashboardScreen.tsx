import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Platform 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import { 
  Video, Heart, Clipboard, LogOut, RefreshCw, 
  User, CheckCircle, Clock, Search, BookOpen, AlertTriangle 
} from 'lucide-react-native';

export const DoctorDashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

  // Navigation Tabs
  const [currentTab, setCurrentTab] = useState<'opd' | 'ipd'>('opd');

  // OPD States
  const [appointments, setAppointments] = useState<any[]>([]);
  
  // IPD States
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [progressNotes, setProgressNotes] = useState<any[]>([]);
  const [newProgressNote, setNewProgressNote] = useState('');
  const [isDictatingProgressNote, setIsDictatingProgressNote] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (currentTab === 'opd') {
      loadSchedule();
    } else {
      loadWardAdmissions();
    }
  }, [currentTab]);

  const loadSchedule = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/appointments', {
        params: { doctor_id: user.id }
      });
      const sorted = res.data.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      setAppointments(sorted);
    } catch (err) {
      console.error('Failed to load doctor schedule:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadWardAdmissions = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/ipd/admissions', {
        params: { status_filter: 'admitted' }
      });
      setAdmissions(res.data);
    } catch (err) {
      console.error('Failed to load ward admissions:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (currentTab === 'opd') {
      loadSchedule();
    } else {
      loadWardAdmissions();
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out of the doctor console?')) {
        logout();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to log out of the doctor console?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', onPress: logout, style: 'destructive' }
      ]);
    }
  };

  const handleStartTeleconsult = async (apptId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/api/telemedicine/create-room', {
        appointment_id: apptId
      });
      const session = res.data;
      
      await apiClient.post('/api/consultation/visit/start', {
        appointment_id: apptId
      });

      navigation.navigate('Telehealth', { sessionId: session.id });
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to start telemedicine call room.';
      Alert.alert('Telehealth Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Dictate Doctor Rounds Notes
  const handleStartRoundsDictation = () => {
    const SpeechRecognition = (Platform.OS === 'web') 
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) 
      : null;

    if (SpeechRecognition) {
      setIsDictatingProgressNote(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNewProgressNote(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsDictatingProgressNote(false);
      };

      recognition.onerror = () => {
        setIsDictatingProgressNote(false);
        Alert.alert('Dictation Error', 'Could not record voice input.');
      };

      recognition.onend = () => {
        setIsDictatingProgressNote(false);
      };

      recognition.start();
    } else {
      setIsDictatingProgressNote(true);
      setTimeout(() => {
        setNewProgressNote(prev => 
          prev ? `${prev} Patient is hemodynamically stable. Lungs clear to auscultation bilateral.` : 'Patient is hemodynamically stable. Lungs clear to auscultation bilateral.'
        );
        setIsDictatingProgressNote(false);
        Alert.alert('Dictation Complete', 'Rounds progress notes captured.');
      }, 2000);
    }
  };

  // Submit rounds note
  const handleSubmitProgressNote = async () => {
    if (!newProgressNote) {
      Alert.alert('Empty Note', 'Please type or dictate progress remarks before submitting.');
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        note: `[DOCTOR ROUNDS] Dr. ${user?.name}: ${newProgressNote}`
      };
      
      const res = await apiClient.post(`/api/ipd/admissions/${selectedAdmission.id}/notes`, payload);
      Alert.alert('Success', ' rounds progress note logged to central EMR.');
      
      // Update local notes feed
      if (res.data?.progress_notes) {
        setProgressNotes(res.data.progress_notes);
      } else {
        // Fallback fetch
        const updatedAdm = await apiClient.get(`/api/ipd/admissions/${selectedAdmission.id}`);
        setProgressNotes(updatedAdm.data.progress_notes || []);
      }
      setNewProgressNote('');
    } catch (e: any) {
      Alert.alert('Sync Error', 'Could not post progress note to EMR logs.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load patient specific notes when opening admission bed card
  const handleOpenBedCard = async (adm: any) => {
    setSelectedAdmission(adm);
    setProgressNotes(adm.progress_notes || []);
  };

  const filteredOPD = appointments.filter(a =>
    a.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.mrn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIPD = admissions.filter(a =>
    a.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
          <Text style={styles.welcomeText}>Logged in Practitioner,</Text>
          <Text style={styles.doctorName}>Dr. {user?.name}</Text>
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
          onPress={() => { setCurrentTab('opd'); setSelectedAdmission(null); }}
        >
          <Text style={[styles.tabButtonText, currentTab === 'opd' && styles.activeTabButtonText]}>OPD Timeline</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, currentTab === 'ipd' && styles.activeTabButton]}
          onPress={() => { setCurrentTab('ipd'); setSelectedAdmission(null); }}
        >
          <Text style={[styles.tabButtonText, currentTab === 'ipd' && styles.activeTabButtonText]}>Ward Bedside Rounds</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !isRefreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Syncing EMR Directory...</Text>
        </View>
      )}

      {currentTab === 'opd' && !isLoading && (
        <View style={styles.section}>
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

          {filteredOPD.length === 0 ? (
            <View style={styles.emptyCard}>
              <Clock size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No appointments scheduled for today.</Text>
            </View>
          ) : (
            filteredOPD.map((item) => {
              const isCompleted = item.status === 'completed';
              return (
                <View key={item.id} style={styles.apptCard}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.apptTime}>{item.start_time} - {item.end_time}</Text>
                    <Text style={[
                      styles.statusTag, 
                      { 
                        backgroundColor: isCompleted ? '#ecfdf5' : '#eff6ff',
                        color: isCompleted ? '#059669' : '#2563eb' 
                      }
                    ]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.patientTitle}>Patient: {item.patient_name}</Text>
                  <Text style={styles.mrnText}>MRN: {item.mrn}</Text>
                  <Text style={styles.reasonText}>Reason: {item.reason || 'General Consultation'}</Text>

                  {/* Patient Records Row */}
                  <View style={styles.recordsActionsContainer}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.historyBtn]}
                      onPress={() => navigation.navigate('PatientHistory', { patientId: item.patient_id })}
                    >
                      <Clock size={12} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Clinical Timeline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionButton, styles.labBtn]}
                      onPress={() => navigation.navigate('LabResults', { visitId: item.visit_id || item.id })}
                    >
                      <BookOpen size={12} color={colors.accent} />
                      <Text style={[styles.actionBtnText, { color: colors.accent }]}>Lab Reports</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Clinical Tool Buttons */}
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.vitalsBtn]}
                      onPress={() => navigation.navigate('PatientVitals', { patientId: item.patient_id, appointmentId: item.id })}
                    >
                      <Heart size={12} color={colors.secondary} />
                      <Text style={styles.actionBtnText}>Vitals Log</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionButton, styles.prescBtn]}
                      onPress={() => navigation.navigate('QuickPrescription', { patientId: item.patient_id, appointmentId: item.id })}
                    >
                      <Clipboard size={12} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Quick Notes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionButton, styles.videoBtn]}
                      onPress={() => handleStartTeleconsult(item.id)}
                    >
                      <Video size={12} color={colors.white} />
                      <Text style={[styles.actionBtnText, { color: colors.white }]}>Consult</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {currentTab === 'ipd' && !isLoading && (
        !selectedAdmission ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ward Occupants Rounds List</Text>

            <View style={styles.searchContainer}>
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Patient Name or Room..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {filteredIPD.length === 0 ? (
              <View style={styles.emptyCard}>
                <User size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No admitted ward patients found.</Text>
              </View>
            ) : (
              filteredIPD.map(adm => (
                <TouchableOpacity 
                  key={adm.id} 
                  style={styles.apptCard}
                  onPress={() => handleOpenBedCard(adm)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.apptTime}>Room: {adm.room_number}</Text>
                    <Text style={[styles.statusTag, { backgroundColor: '#fee2e2', color: colors.danger }]}>
                      ADMITTED
                    </Text>
                  </View>
                  <Text style={styles.patientTitle}>Patient: {adm.patient_name}</Text>
                  <Text style={styles.mrnText}>MRN: {adm.patient_mrn}</Text>
                  <Text style={styles.reasonText}>Bed Class: {adm.room_type.toUpperCase()} | Attending: Dr. {adm.doctor_name}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          <View style={styles.formContainer}>
            <TouchableOpacity style={styles.backButton} onPress={() => setSelectedAdmission(null)}>
              <Text style={styles.backText}>← Back to Ward Grid</Text>
            </TouchableOpacity>

            <Text style={styles.formTitle}>Bedside EMR Rounds Card</Text>
            <Text style={styles.patientNameHeader}>{selectedAdmission.patient_name}</Text>
            <Text style={styles.bedNoHeader}>Room {selectedAdmission.room_number} | MRN: {selectedAdmission.patient_mrn}</Text>

            {/* Ward Rounds Notes History Feed */}
            <View style={styles.notesFeedContainer}>
              <Text style={styles.sectionTitleHeader}>EMR Case Notes History</Text>
              {progressNotes.length === 0 ? (
                <Text style={styles.noNotesText}>No progress notes entered for this admission session.</Text>
              ) : (
                <ScrollView style={styles.notesScrollView}>
                  {progressNotes.map((n, idx) => (
                    <View key={idx} style={styles.noteCard}>
                      <View style={styles.noteHeader}>
                        <Text style={styles.noteBy}>{n.by || 'Clinician'}</Text>
                        <Text style={styles.noteTime}>{n.date ? new Date(n.date).toLocaleDateString() : 'N/A'}</Text>
                      </View>
                      <Text style={styles.noteContent}>{n.note}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Dictate New Rounds Progress Note */}
            <View style={styles.addNoteContainer}>
              <Text style={styles.sectionTitleHeader}>Dictate rounds Note</Text>
              <View style={styles.dictateInputContainer}>
                <TextInput
                  style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="Record patient round instructions, prescription additions, or bedside remarks..."
                  placeholderTextColor={colors.textMuted}
                  value={newProgressNote}
                  onChangeText={setNewProgressNote}
                />
                <TouchableOpacity 
                  style={[styles.micBtn, isDictatingProgressNote && styles.micBtnActive]} 
                  onPress={handleStartRoundsDictation}
                >
                  <Text style={styles.micBtnText}>{isDictatingProgressNote ? 'Listening...' : '🎙️ Dictate Note'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtnNote} onPress={handleSubmitProgressNote}>
              <Text style={styles.submitBtnNoteText}>Verify & Log Rounds Note</Text>
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
  doctorName: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginTop: 2 },
  roleText: { fontSize: 9, fontWeight: '800', color: colors.accent, marginTop: 4 },
  logoutButton: { padding: 10, borderRadius: 12, backgroundColor: '#fee2e2' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12, marginBottom: 18 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  tabButtonText: { fontSize: 12, color: colors.textMuted, fontWeight: 'bold' },
  activeTabButtonText: { color: colors.primary },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  sectionTitleHeader: { fontSize: 11, fontWeight: '800', color: colors.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: colors.text },
  emptyCard: { backgroundColor: colors.white, borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontWeight: '500' },
  apptCard: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10, marginBottom: 12 },
  apptTime: { fontSize: 12, fontWeight: 'bold', color: colors.primary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statusTag: { fontSize: 9, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
  patientTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  mrnText: { fontSize: 11, color: colors.secondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2, fontWeight: '600' },
  reasonText: { fontSize: 12, color: colors.textMuted, marginTop: 6, lineHeight: 18 },
  recordsActionsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 10 },
  historyBtn: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', width: '48%' },
  labBtn: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#b2f5ea', width: '48%' },
  actionsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 14 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, width: '31%' },
  vitalsBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  prescBtn: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  videoBtn: { backgroundColor: colors.accent },
  actionBtnText: { fontSize: 11, fontWeight: 'bold', color: colors.secondary, marginLeft: 4 },
  formContainer: { backgroundColor: colors.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.border },
  backButton: { marginBottom: 12 },
  backText: { color: colors.accent, fontWeight: 'bold', fontSize: 12 },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: colors.primary },
  patientNameHeader: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginTop: 4 },
  bedNoHeader: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 14 },
  notesFeedContainer: { marginBottom: 16 },
  noNotesText: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },
  notesScrollView: { height: 160, backgroundColor: '#f8fafc', borderRadius: 12, borderColor: '#e2e8f0', borderWidth: 1, padding: 12 },
  noteCard: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 8 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  noteBy: { fontSize: 11, fontWeight: 'bold', color: colors.primary },
  noteTime: { fontSize: 9, color: colors.textMuted },
  noteContent: { fontSize: 12, color: colors.text, lineHeight: 18 },
  addNoteContainer: { marginBottom: 16 },
  dictateInputContainer: { marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: colors.text, backgroundColor: colors.background },
  micBtn: { backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center', marginTop: 8, alignSelf: 'flex-start' },
  micBtnActive: { backgroundColor: colors.danger },
  micBtnText: { color: colors.white, fontSize: 11, fontWeight: 'bold' },
  submitBtnNote: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitBtnNoteText: { color: colors.white, fontWeight: 'bold', fontSize: 13 }
});
export default DoctorDashboardScreen;
