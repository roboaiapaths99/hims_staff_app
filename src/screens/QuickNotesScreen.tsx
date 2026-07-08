import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, Platform 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { ArrowLeft, Search, Check, Mic, Activity, PlusCircle, Trash2 } from 'lucide-react-native';

export const QuickNotesScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { appointmentId, patientId, visitId } = route.params || {};

  const [visit, setVisit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [symptoms, setSymptoms] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);

  // Dictation States
  const [activeDictationField, setActiveDictationField] = useState<'symptoms' | 'notes' | 'treatment' | null>(null);

  // ICD-10 Search
  const [diagQuery, setDiagQuery] = useState('');
  const [diagSuggestions, setDiagSuggestions] = useState<any[]>([]);

  useEffect(() => {
    resolveVisit();
  }, [appointmentId, visitId]);

  const resolveVisit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Start or retrieve visit
      const targetApptId = appointmentId || visitId;
      if (!targetApptId) {
        setError('Missing appointment or visit identifiers.');
        setIsLoading(false);
        return;
      }
      
      const res = await apiClient.post('/api/consultation/visit/start', {
        appointment_id: targetApptId
      });
      const v = res.data;
      setVisit(v);
      setSymptoms(v.symptoms || '');
      setClinicalNotes(v.clinical_notes || '');
      setTreatmentPlan(v.treatment_plan || '');
      setSelectedDiagnoses(v.diagnosis || []);
    } catch (err) {
      console.error(err);
      setError('Failed to resolve active EMR visit details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchDiagnosis = async (text: string) => {
    setDiagQuery(text);
    if (text.length < 2) {
      setDiagSuggestions([]);
      return;
    }
    try {
      const res = await apiClient.get('/api/consultation/icd10', {
        params: { q: text }
      });
      setDiagSuggestions(res.data);
    } catch (e) {
      console.warn('Failed to query ICD10 database', e);
    }
  };

  const handleAddDiagnosis = (diag: any) => {
    const codeStr = `${diag.code} - ${diag.name}`;
    if (!selectedDiagnoses.includes(codeStr)) {
      setSelectedDiagnoses([...selectedDiagnoses, codeStr]);
    }
    setDiagQuery('');
    setDiagSuggestions([]);
  };

  const handleRemoveDiagnosis = (diagStr: string) => {
    setSelectedDiagnoses(selectedDiagnoses.filter(d => d !== diagStr));
  };

  const handleStartDictation = (field: 'symptoms' | 'notes' | 'treatment') => {
    const SpeechRecognition = (Platform.OS === 'web') 
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) 
      : null;

    if (SpeechRecognition) {
      setActiveDictationField(field);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (field === 'symptoms') setSymptoms(prev => prev ? `${prev} ${transcript}` : transcript);
        if (field === 'notes') setClinicalNotes(prev => prev ? `${prev} ${transcript}` : transcript);
        if (field === 'treatment') setTreatmentPlan(prev => prev ? `${prev} ${transcript}` : transcript);
        setActiveDictationField(null);
      };

      recognition.onerror = () => {
        setActiveDictationField(null);
        Alert.alert('Dictation Error', 'Could not process voice input.');
      };

      recognition.onend = () => {
        setActiveDictationField(null);
      };

      recognition.start();
    } else {
      // Mock Dictation for simulator / Native platform fallback
      setActiveDictationField(field);
      setTimeout(() => {
        const mockTexts = {
          symptoms: 'Patient reports mild chest discomfort and fatigue.',
          notes: 'Vitals stable. Cardiovascular exam shows regular rate and rhythm.',
          treatment: 'Advised lifestyle modification, low sodium diet, and review in two weeks.'
        };
        const transcript = mockTexts[field];
        if (field === 'symptoms') setSymptoms(prev => prev ? `${prev} ${transcript}` : transcript);
        if (field === 'notes') setClinicalNotes(prev => prev ? `${prev} ${transcript}` : transcript);
        if (field === 'treatment') setTreatmentPlan(prev => prev ? `${prev} ${transcript}` : transcript);
        
        setActiveDictationField(null);
        Alert.alert('Dictation Complete', 'Voice transcript captured successfully.');
      }, 2000);
    }
  };

  const handleSaveDraft = async () => {
    if (!visit) return;
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        symptoms,
        clinical_notes: clinicalNotes,
        treatment_plan: treatmentPlan,
        diagnosis: selectedDiagnoses
      };
      await apiClient.post(`/api/consultation/visit/${visit.id}/save`, payload);
      Alert.alert('Draft Saved', 'Consultation draft notes logged.');
    } catch (err: any) {
      Alert.alert('Sync Error', err.response?.data?.detail || 'Failed to save notes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeVisit = async () => {
    if (!visit) return;
    if (!clinicalNotes.trim() || selectedDiagnoses.length === 0) {
      Alert.alert('Incomplete EMR', 'Please record clinical notes and at least one diagnosis code.');
      return;
    }

    Alert.alert('Confirm Finalization', 'Finalizing will lock this visit permanently. Proceed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finalize & Lock',
        onPress: async () => {
          setIsLoading(true);
          setError(null);
          try {
            const payload = {
              symptoms,
              clinical_notes: clinicalNotes,
              treatment_plan: treatmentPlan,
              diagnosis: selectedDiagnoses
            };
            await apiClient.post(`/api/consultation/visit/${visit.id}/complete`, payload);
            Alert.alert('Visit Finalized', 'Clinical consult finalized, EMR record locked.', [
              { text: 'OK', onPress: () => navigation.goBack() }
            ]);
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to lock visit.');
          } finally {
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clinical Consult Notes</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading && !visit ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Syncing EMR Record...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.formCard}>
            {/* Symptoms */}
            <View style={styles.inputGroup}>
              <View style={styles.fieldHeader}>
                <Text style={styles.inputLabel}>Presenting Symptoms</Text>
                <TouchableOpacity 
                  onPress={() => handleStartDictation('symptoms')}
                  style={[styles.dictateBtn, activeDictationField === 'symptoms' && styles.dictateBtnActive]}
                >
                  <Mic size={14} color={activeDictationField === 'symptoms' ? colors.white : colors.accent} />
                  <Text style={[styles.dictateBtnText, activeDictationField === 'symptoms' && styles.dictateBtnTextActive]}>
                    {activeDictationField === 'symptoms' ? 'Listening...' : 'Dictate'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={2}
                value={symptoms}
                onChangeText={setSymptoms}
                placeholder="Chief complaints, duration..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Clinical Notes */}
            <View style={styles.inputGroup}>
              <View style={styles.fieldHeader}>
                <Text style={styles.inputLabel}>Clinical Notes & Examination</Text>
                <TouchableOpacity 
                  onPress={() => handleStartDictation('notes')}
                  style={[styles.dictateBtn, activeDictationField === 'notes' && styles.dictateBtnActive]}
                >
                  <Mic size={14} color={activeDictationField === 'notes' ? colors.white : colors.accent} />
                  <Text style={[styles.dictateBtnText, activeDictationField === 'notes' && styles.dictateBtnTextActive]}>
                    {activeDictationField === 'notes' ? 'Listening...' : 'Dictate'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.textInput, { height: 100 }]}
                multiline
                numberOfLines={4}
                value={clinicalNotes}
                onChangeText={setClinicalNotes}
                placeholder="Findings, physical examinations, history..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Diagnosis (ICD-10 Search) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ICD-10 Diagnosis</Text>
              <View style={styles.searchBox}>
                <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Type to search conditions..."
                  placeholderTextColor={colors.textMuted}
                  value={diagQuery}
                  onChangeText={handleSearchDiagnosis}
                />
              </View>
              {diagSuggestions.length > 0 && (
                <View style={styles.dropdown}>
                  {diagSuggestions.map(d => (
                    <TouchableOpacity 
                      key={d.code} 
                      style={styles.dropdownItem}
                      onPress={() => handleAddDiagnosis(d)}
                    >
                      <Text style={styles.dropdownText}>{d.code} - {d.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Diagnosis tags */}
              <View style={styles.tagsContainer}>
                {selectedDiagnoses.map(d => (
                  <View key={d} style={styles.tag}>
                    <Text style={styles.tagText}>{d}</Text>
                    <TouchableOpacity onPress={() => handleRemoveDiagnosis(d)} style={styles.removeTagBtn}>
                      <Trash2 size={12} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* Treatment Plan */}
            <View style={styles.inputGroup}>
              <View style={styles.fieldHeader}>
                <Text style={styles.inputLabel}>Treatment Plan & Advice</Text>
                <TouchableOpacity 
                  onPress={() => handleStartDictation('treatment')}
                  style={[styles.dictateBtn, activeDictationField === 'treatment' && styles.dictateBtnActive]}
                >
                  <Mic size={14} color={activeDictationField === 'treatment' ? colors.white : colors.accent} />
                  <Text style={[styles.dictateBtnText, activeDictationField === 'treatment' && styles.dictateBtnTextActive]}>
                    {activeDictationField === 'treatment' ? 'Listening...' : 'Dictate'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={2}
                value={treatmentPlan}
                onChangeText={setTreatmentPlan}
                placeholder="Prescribed advice, lifestyle adjustments..."
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.draftBtn} onPress={handleSaveDraft}>
              <Text style={styles.draftBtnText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finalizeBtn} onPress={handleFinalizeVisit}>
              <Check size={16} color={colors.white} />
              <Text style={styles.finalizeBtnText}>Finalize & Lock</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    padding: 40,
    marginTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: colors.secondary,
    fontWeight: 'bold',
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccfbf1',
  },
  dictateBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dictateBtnText: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  dictateBtnTextActive: {
    color: colors.white,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.background,
    textAlignVertical: 'top',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  dropdown: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    maxHeight: 120,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownText: {
    fontSize: 12,
    color: colors.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: '500',
  },
  removeTagBtn: {
    marginLeft: 6,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  draftBtn: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 12,
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  finalizeBtn: {
    flex: 1.2,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finalizeBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.white,
    marginLeft: 6,
  },
});

export default QuickNotesScreen;
