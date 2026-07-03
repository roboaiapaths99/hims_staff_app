import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, Platform 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { ArrowLeft, Activity, Heart, Thermometer, Weight, ChevronRight } from 'lucide-react-native';

export const PatientVitalsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { patientId } = route.params || {};

  const [vitals, setVitals] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patientId) {
      loadVitals();
    }
  }, [patientId]);

  const loadVitals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/vitals/patient/${patientId}`);
      if (res.data && res.data.length > 0) {
        setVitals(res.data[0]); // Get the most recent vitals entry
      } else {
        setVitals(null);
      }
    } catch (err) {
      console.error('Failed to load vitals:', err);
      setError('Failed to fetch patient vitals log.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Syncing Vitals Ledger...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Physiological Vitals</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!vitals ? (
          <View style={styles.emptyContainer}>
            <Activity size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No vital signs triaged for this patient today.</Text>
          </View>
        ) : (
          <View style={styles.vitalsContainer}>
            {/* Triage Level Indicator */}
            <View style={[
              styles.triageCard,
              {
                backgroundColor: vitals.triage_level === 'red' ? '#fee2e2' :
                                 vitals.triage_level === 'yellow' ? '#fef3c7' : '#d1fae5'
              }
            ]}>
              <Activity size={20} color={vitals.triage_level === 'red' ? colors.danger :
                                        vitals.triage_level === 'yellow' ? colors.warning : colors.success} />
              <View style={styles.triageDetails}>
                <Text style={styles.triageLabel}>CLINICAL TRIAGE STATUS</Text>
                <Text style={[
                  styles.triageStatus,
                  {
                    color: vitals.triage_level === 'red' ? colors.danger :
                           vitals.triage_level === 'yellow' ? colors.warning : colors.success
                  }
                ]}>
                  {vitals.triage_level.toUpperCase()} RESPONSE REQUIRED
                </Text>
              </View>
            </View>

            {/* Vitals Grid Card */}
            <View style={styles.gridCard}>
              {/* BP & Pulse Row */}
              <View style={styles.gridRow}>
                <View style={styles.gridCell}>
                  <Heart size={20} color={colors.danger} />
                  <View style={styles.cellDetails}>
                    <Text style={styles.cellLabel}>Blood Pressure</Text>
                    <Text style={styles.cellValue}>{vitals.bp_sys}/{vitals.bp_dia}</Text>
                    <Text style={styles.cellUnit}>mmHg</Text>
                  </View>
                </View>

                <View style={styles.gridCell}>
                  <Activity size={20} color={colors.accent} />
                  <View style={styles.cellDetails}>
                    <Text style={styles.cellLabel}>Pulse Rate</Text>
                    <Text style={styles.cellValue}>{vitals.pulse}</Text>
                    <Text style={styles.cellUnit}>bpm</Text>
                  </View>
                </View>
              </View>

              {/* Temperature & SpO2 Row */}
              <View style={[styles.gridRow, styles.gridRowBorder]}>
                <View style={styles.gridCell}>
                  <Thermometer size={20} color={colors.warning} />
                  <View style={styles.cellDetails}>
                    <Text style={styles.cellLabel}>Body Temperature</Text>
                    <Text style={styles.cellValue}>{vitals.temperature}</Text>
                    <Text style={styles.cellUnit}>°F</Text>
                  </View>
                </View>

                <View style={styles.gridCell}>
                  <Activity size={20} color="#0284c7" />
                  <View style={styles.cellDetails}>
                    <Text style={styles.cellLabel}>Blood Oxygen</Text>
                    <Text style={styles.cellValue}>{vitals.spo2}</Text>
                    <Text style={styles.cellUnit}>% SpO2</Text>
                  </View>
                </View>
              </View>

              {/* Height & Weight Row */}
              <View style={[styles.gridRow, styles.gridRowBorder]}>
                <View style={styles.gridCell}>
                  <Weight size={20} color={colors.secondary} />
                  <View style={styles.cellDetails}>
                    <Text style={styles.cellLabel}>Body Weight</Text>
                    <Text style={styles.cellValue}>{vitals.weight}</Text>
                    <Text style={styles.cellUnit}>kg</Text>
                  </View>
                </View>

                <View style={styles.gridCell}>
                  <ChevronRight size={20} color={colors.secondary} />
                  <View style={styles.cellDetails}>
                    <Text style={styles.cellLabel}>Height & BMI</Text>
                    <Text style={styles.cellValue}>{vitals.height} cm</Text>
                    <Text style={styles.cellUnit}>BMI: {vitals.bmi}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Pain Score */}
            <View style={styles.painBox}>
              <Text style={styles.painLabel}>Subjective Pain Scale: <Text style={styles.painValue}>{vitals.pain_score} / 10</Text></Text>
              <View style={styles.painBarBg}>
                <View style={[
                  styles.painBarFill,
                  { 
                    width: `${vitals.pain_score * 10}%`,
                    backgroundColor: vitals.pain_score >= 7 ? colors.danger :
                                     vitals.pain_score >= 4 ? colors.warning : colors.success
                  }
                ]} />
              </View>
            </View>

            <Text style={styles.triageNote}>Recorded by nursing staff on {new Date(vitals.created_at).toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  backText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
    fontWeight: '500',
  },
  vitalsContainer: {
    paddingBottom: 40,
  },
  triageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  triageDetails: {
    marginLeft: 12,
  },
  triageLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  triageStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  gridCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  gridRow: {
    flexDirection: 'row',
    padding: 16,
  },
  gridRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gridCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cellDetails: {
    marginLeft: 12,
  },
  cellLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  cellValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cellUnit: {
    fontSize: 10,
    color: colors.secondary,
    fontWeight: '600',
    marginTop: 1,
  },
  painBox: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 24,
  },
  painLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  painValue: {
    color: colors.primary,
  },
  painBarBg: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  painBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  triageNote: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});
export default PatientVitalsScreen;
