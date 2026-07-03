import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, Platform, FlatList 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import apiClient from '../api/client';
import { colors } from '../theme/colors';
import { ArrowLeft, Search, PlusCircle, Trash2, Check } from 'lucide-react-native';

export const QuickPrescriptionScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { appointmentId, patientId } = route.params || {};

  const [visit, setVisit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search Drugs
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearchingMeds, setIsSearchingMeds] = useState(false);

  // Form parameters
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [dosage, setDosage] = useState('1-0-1');
  const [frequency, setFrequency] = useState('Daily');
  const [duration, setDuration] = useState('5 days');
  const [qty, setQty] = useState('10');
  const [instructions, setInstructions] = useState('After food');

  useEffect(() => {
    if (appointmentId) {
      resolveVisit();
    }
  }, [appointmentId]);

  const resolveVisit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Create or retrieve EMR Visit using appointment ID
      const res = await apiClient.post('/api/consultation/visit/start', {
        appointment_id: appointmentId
      });
      setVisit(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to resolve active EMR visit details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchMeds = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsSearchingMeds(true);
    try {
      const res = await apiClient.get('/api/pharmacy/inventory/search', {
        params: { q: text }
      });
      setSuggestions(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingMeds(false);
    }
  };

  const handleAddMedication = (med: any) => {
    const quantity = parseInt(qty) || 10;
    const isAlreadyAdded = selectedItems.some(i => i.medicine_id === med.id);
    
    if (isAlreadyAdded) {
      Alert.alert('Duplicate Item', 'This drug has already been added to the prescription list.');
      return;
    }

    setSelectedItems([...selectedItems, {
      medicine_id: med.id,
      medicine_name: med.medicine_name,
      dosage,
      frequency,
      duration,
      instructions,
      quantity_prescribed: quantity
    }]);

    setSearchQuery('');
    setSuggestions([]);
  };

  const handleRemoveItem = (medId: string) => {
    setSelectedItems(selectedItems.filter(i => i.medicine_id !== medId));
  };

  const handleSubmitPrescription = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('Empty Order', 'Please add at least one medication to the prescription list.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        patient_id: patientId,
        visit_id: visit.id,
        items: selectedItems
      };
      
      await apiClient.post('/api/pharmacy/prescriptions', payload);
      Alert.alert(
        'Rx Filed', 
        'E-prescription created and inventory stock reservations logged.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to submit prescription.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rx Prescriber</Text>
        <View style={{ width: 60 }} />
      </View>

      {isLoading && !visit ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Syncing Visit Records...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Form instructions */}
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Add Medication Directions</Text>
            
            <View style={styles.formGrid}>
              <View style={styles.gridCell}>
                <Text style={styles.inputLabel}>Dosage</Text>
                <TextInput
                  style={styles.textInput}
                  value={dosage}
                  onChangeText={setDosage}
                  placeholder="e.g. 1-0-1"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.inputLabel}>Frequency</Text>
                <TextInput
                  style={styles.textInput}
                  value={frequency}
                  onChangeText={setFrequency}
                  placeholder="e.g. Daily"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.inputLabel}>Duration</Text>
                <TextInput
                  style={styles.textInput}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="e.g. 5 days"
                />
              </View>
            </View>

            <View style={styles.formGrid}>
              <View style={[styles.gridCell, { flex: 1.5 }]}>
                <Text style={styles.inputLabel}>Instructions</Text>
                <TextInput
                  style={styles.textInput}
                  value={instructions}
                  onChangeText={setInstructions}
                  placeholder="e.g. After food"
                />
              </View>
              <View style={styles.gridCell}>
                <Text style={styles.inputLabel}>Qty</Text>
                <TextInput
                  style={styles.textInput}
                  value={qty}
                  keyboardType="number-pad"
                  onChangeText={setQty}
                  placeholder="10"
                />
              </View>
            </View>

            {/* Drug Search */}
            <Text style={styles.inputLabel}>Search & Add Medication</Text>
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.secondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search warehouse stock..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearchMeds}
              />
              {isSearchingMeds && (
                <ActivityIndicator size="small" color={colors.accent} style={styles.searchLoader} />
              )}
            </View>

            {/* Search Suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.suggestionsBox}>
                {suggestions.map(med => (
                  <TouchableOpacity
                    key={med.id}
                    style={styles.suggestionItem}
                    onPress={() => handleAddMedication(med)}
                  >
                    <Text style={styles.suggestionName}>{med.medicine_name}</Text>
                    <Text style={styles.suggestionStock}>In Stock: {med.quantity}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Added Medications list */}
          <Text style={styles.sectionTitle}>Prescribed Items</Text>
          {selectedItems.length === 0 ? (
            <Text style={styles.emptyText}>No medications added to this prescription yet.</Text>
          ) : (
            <View style={styles.listCard}>
              {selectedItems.map((item, idx) => (
                <View key={item.medicine_id} style={[styles.medItem, idx > 0 && styles.itemBorder]}>
                  <View style={styles.itemMeta}>
                    <Text style={styles.itemName}>{item.medicine_name}</Text>
                    <Text style={styles.itemDetail}>
                      {item.dosage} | {item.frequency} | {item.duration} ({item.quantity_prescribed} pcs)
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveItem(item.medicine_id)}>
                    <Trash2 size={16} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Submit Button */}
          {selectedItems.length > 0 && (
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitPrescription}>
              <Check size={18} color={colors.white} />
              <Text style={styles.submitButtonText}>Submit E-Prescription</Text>
            </TouchableOpacity>
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
    backgroundColor: colors.background,
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
  formCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  formGrid: {
    flexDirection: 'row',
    marginHorizontal: -6,
    marginBottom: 12,
  },
  gridCell: {
    flex: 1,
    marginHorizontal: 6,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.text,
  },
  searchLoader: {
    marginLeft: 6,
  },
  suggestionsBox: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 140,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  suggestionName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  suggestionStock: {
    fontSize: 10,
    color: colors.accent,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  listCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemMeta: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  itemDetail: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  }
});
export default QuickPrescriptionScreen;
