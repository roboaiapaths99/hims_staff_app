import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, RefreshControl, Platform 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { useNavigation } from '@react-navigation/native';
import { 
  Video, Heart, Clipboard, LogOut, RefreshCw, 
  User, CheckCircle, Clock, Truck
} from 'lucide-react-native';

export const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

  // States
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/appointments', {
        params: { doctor_id: user.id }
      });
      // Sort appointments by start_time
      const sorted = res.data.sort((a: any, b: any) => a.start_time.localeCompare(b.start_time));
      setAppointments(sorted);
    } catch (err) {
      console.error('Failed to load doctor schedule:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSchedule();
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of the doctor console?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', onPress: logout, style: 'destructive' }
    ]);
  };

  const handleStartTeleconsult = async (apptId: string) => {
    setIsLoading(true);
    try {
      // 1. Create or fetch telemedicine session room
      const res = await apiClient.post('/api/telemedicine/create-room', {
        appointment_id: apptId
      });
      const session = res.data;
      
      // 2. Also start EMR consultation record
      await apiClient.post('/api/consultation/visit/start', {
        appointment_id: apptId
      });

      // 3. Navigate to telehealth video call Webview
      navigation.navigate('Telehealth', { sessionId: session.id });
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to start telemedicine call room.';
      Alert.alert('Telehealth Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isRefreshing) {
    return (
      <div style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background } as any}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 12, color: colors.secondary, fontSize: 12, fontWeight: 'bold' }}>Loading OPD Queue...</Text>
      </div>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={[colors.accent]} />
      }
    >
      {/* Clinician Header Summary */}
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

      {/* Ambulance Duty Dispatch Banner */}
      <View style={styles.driverSection}>
        <TouchableOpacity 
          style={styles.driverBanner}
          onPress={() => navigation.navigate('AmbulanceTasks')}
        >
          <Truck size={18} color={colors.white} />
          <Text style={styles.driverBannerText}>View Ambulance Dispatch Duty Tasks</Text>
        </TouchableOpacity>
      </View>

      {/* Daily schedule grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Consultation Timeline Queue</Text>
        {appointments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Clock size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No appointments scheduled for today.</Text>
          </View>
        ) : (
          appointments.map((item) => {
            const isCompleted = item.status === 'completed';
            const isWaiting = ['waiting', 'ready_for_doctor', 'in_vitals', 'in_consultation'].includes(item.status);
            
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

                <Text style={styles.patientName}>Patient: {item.patient_name}</Text>
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
                    <User size={12} color={colors.accent} />
                    <Text style={[styles.actionBtnText, { color: colors.accent }]}>Lab Reports</Text>
                  </TouchableOpacity>
                </View>

                {/* Actions row */}
                {!isCompleted && (
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.vitalsBtn]}
                      onPress={() => navigation.navigate('PatientVitals', { patientId: item.patient_id })}
                    >
                      <Heart size={14} color={colors.secondary} />
                      <Text style={styles.actionBtnText}>Vitals</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionButton, styles.prescBtn]}
                      onPress={() => navigation.navigate('QuickPrescription', { appointmentId: item.id, patientId: item.patient_id })}
                    >
                      <Clipboard size={14} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Prescribe</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionButton, styles.videoBtn]}
                      onPress={() => handleStartTeleconsult(item.id)}
                    >
                      <Video size={14} color={colors.white} />
                      <Text style={[styles.actionBtnText, { color: colors.white }]}>Teleconsult</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
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
  welcomeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 2,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    marginTop: 4,
  },
  logoutButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fee2e2',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    fontWeight: '500',
  },
  apptCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
    marginBottom: 12,
  },
  apptTime: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusTag: {
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  patientName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.text,
  },
  mrnText: {
    fontSize: 11,
    color: colors.secondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
    fontWeight: '600',
  },
  reasonText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  recordsActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 10,
  },
  historyBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    width: '48%',
  },
  labBtn: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#b2f5ea',
    width: '48%',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 14,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '31%',
  },
  vitalsBtn: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prescBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  videoBtn: {
    backgroundColor: colors.accent,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.secondary,
    marginLeft: 4,
  },
  driverSection: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  driverBanner: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
  },
  driverBannerText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 8,
  }
});
export default DashboardScreen;
