import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import apiClient from '../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ArrowLeft, Clock, History, FileText } from 'lucide-react-native';

export const PatientHistoryScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { patientId } = route.params || {};

  const [portalData, setPortalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (patientId) {
      fetchPatientTimeline();
    } else {
      setIsLoading(false);
    }
  }, [patientId]);

  const fetchPatientTimeline = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/patients/${patientId}/portal-data`);
      setPortalData(res.data);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to retrieve patient historical timeline data.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clinical Timeline History</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Compiling timeline history...</Text>
        </View>
      ) : !portalData ? (
        <View style={styles.center}>
          <History size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>Patient portal data could not be retrieved.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          {/* Patient summary badge */}
          <View style={styles.profileCard}>
            <Text style={styles.profileName}>
              {portalData.profile?.first_name} {portalData.profile?.last_name}
            </Text>
            <Text style={styles.profileMeta}>
              MRN: {portalData.profile?.mrn} | {portalData.profile?.gender} | Phone: {portalData.profile?.phone || 'N/A'}
            </Text>
          </View>

          {/* Timeline list */}
          <Text style={styles.timelineTitle}>Chronological Chart Events</Text>
          
          {/* Combined Chronological timeline */}
          {portalData.visits?.length === 0 && portalData.labs?.length === 0 ? (
            <Text style={styles.noHistoryText}>No records found on patient clinical file.</Text>
          ) : (
            <View style={styles.timelineContainer}>
              {/* Process and combine visits, labs and radiology chronological records */}
              {[
                ...(portalData.visits || []).map((v: any) => ({
                  type: 'Visit',
                  title: `Consultation (${v.status.toUpperCase()})`,
                  subtitle: `Complaints: ${v.chief_complaint || 'General Checkup'}`,
                  desc: v.soap_notes ? `Notes: ${v.soap_notes}` : '',
                  date: v.visit_date
                })),
                ...(portalData.labs || []).map((l: any) => ({
                  type: 'Laboratory',
                  title: `Lab Order (${l.status.toUpperCase()})`,
                  subtitle: `Tests: ${l.items?.map((it: any) => it.test_name).join(', ') || 'N/A'}`,
                  desc: l.results_summary ? `Results: ${l.results_summary}` : '',
                  date: l.created_at
                })),
                ...(portalData.radiology || []).map((r: any) => ({
                  type: 'Radiology',
                  title: `Imaging: ${r.test_name} (${r.status.toUpperCase()})`,
                  subtitle: `Indication: ${r.clinical_indication || 'N/A'}`,
                  desc: '',
                  date: r.created_at
                }))
              ]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((event, idx) => (
                  <View key={idx} style={styles.timelineRow}>
                    <View style={styles.timeLineCol}>
                      <View style={styles.markerCircle} />
                      <View style={styles.verticalLine} />
                    </View>
                    <View style={styles.eventContent}>
                      <View style={styles.eventHeader}>
                        <Text style={styles.eventDate}>{event.date}</Text>
                        <Text style={[
                          styles.eventBadge, 
                          event.type === 'Visit' ? styles.visitBadge : event.type === 'Laboratory' ? styles.labBadge : styles.radBadge
                        ]}>
                          {event.type}
                        </Text>
                      </View>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventSub}>{event.subtitle}</Text>
                      {event.desc ? <Text style={styles.eventDesc}>{event.desc}</Text> : null}
                    </View>
                  </View>
                ))
              }
            </View>
          )}
        </ScrollView>
      )}
    </View>
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
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: colors.secondary,
    fontWeight: 'bold',
  },
  emptyText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  profileMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noHistoryText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 32,
  },
  timelineContainer: {
    paddingLeft: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timeLineCol: {
    alignItems: 'center',
    marginRight: 12,
  },
  markerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
    zIndex: 1,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  eventContent: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: 'bold',
  },
  eventBadge: {
    fontSize: 8,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  visitBadge: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
  },
  labBadge: {
    backgroundColor: '#f0fdfa',
    color: '#0d9488',
  },
  radBadge: {
    backgroundColor: '#faf5ff',
    color: '#7c3aed',
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  eventSub: {
    fontSize: 11,
    color: colors.secondary,
    marginTop: 2,
  },
  eventDesc: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
});
