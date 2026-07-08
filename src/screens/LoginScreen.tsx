import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert 
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { Stethoscope, Mail, Lock, Building, Fingerprint } from 'lucide-react-native';
import apiClient from '../api/client';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Biometrics availability
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);

  // Hospital selection state
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [filteredHospitals, setFilteredHospitals] = useState<any[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [hospitalsLoaded, setHospitalsLoaded] = useState(false);

  useEffect(() => {
    fetchHospitals();
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setIsBiometricSupported(hasHardware);
      setIsBiometricEnrolled(isEnrolled);

      // Auto fill saved email if exists
      const savedEmail = await AsyncStorage.getItem('hmis_saved_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
      
      const savedHospital = await AsyncStorage.getItem('hmis_saved_hospital');
      if (savedHospital) {
        const parsed = JSON.parse(savedHospital);
        setSelectedHospital(parsed);
        setSearchQuery(parsed.name);
      }
    } catch (e) {
      console.warn('Biometric check failed', e);
    }
  };

  const fetchHospitals = async () => {
    try {
      const res = await apiClient.get('/api/auth/public/hospitals');
      setHospitals(res.data);
      setHospitalsLoaded(true);
    } catch (err: any) {
      console.warn('Failed to load active hospital list', err);
      setError('Unable to load hospital directory. Please check your network connection and ensure the backend server is running.');
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setSelectedHospital(null);
    if (!text.trim()) {
      setFilteredHospitals(hospitals);
      setShowDropdown(hospitals.length > 0);
      return;
    }
    const query = text.toLowerCase();
    const filtered = hospitals.filter(h => 
      h.name.toLowerCase().includes(query) || 
      h.subdomain.toLowerCase().includes(query)
    );
    setFilteredHospitals(filtered);
    setShowDropdown(true);
  };

  const handleSelectHospital = (hospital: any) => {
    setSelectedHospital(hospital);
    setSearchQuery(hospital.name);
    setShowDropdown(false);
    setError(null);
  };

  const handleSignIn = async () => {
    setError(null);
    if (!selectedHospital) {
      setError('Please search and select your hospital organization.');
      return;
    }
    if (!email || !password) {
      setError('Please fill in both email and password fields.');
      return;
    }
    
    setIsLoading(true);
    try {
      await login(email, password, selectedHospital.id);
      
      // Save credentials for subsequent biometric logins
      await AsyncStorage.setItem('hmis_saved_email', email);
      await AsyncStorage.setItem('hmis_saved_password', password);
      await AsyncStorage.setItem('hmis_saved_hospital', JSON.stringify(selectedHospital));
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate staff credentials.');
      setIsLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    setError(null);
    try {
      const savedEmail = await AsyncStorage.getItem('hmis_saved_email');
      const savedPassword = await AsyncStorage.getItem('hmis_saved_password');
      const savedHospital = await AsyncStorage.getItem('hmis_saved_hospital');

      if (!savedEmail || !savedPassword || !savedHospital) {
        Alert.alert(
          'Biometrics Unregistered',
          'Please sign in manually with your password first to enable biometric shortcuts.'
        );
        return;
      }

      const parsedHospital = JSON.parse(savedHospital);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock HIMS Console',
        fallbackLabel: 'Enter Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLoading(true);
        setSelectedHospital(parsedHospital);
        setSearchQuery(parsedHospital.name);
        setEmail(savedEmail);
        setPassword(savedPassword);
        
        await login(savedEmail, savedPassword, parsedHospital.id);
      }
    } catch (e: any) {
      setError('Biometric authentication failed.');
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Stethoscope size={55} color={colors.accent} />
          <Text style={styles.title}>HMIS Doctor Workspace</Text>
          <Text style={styles.subtitle}>Clinical Practitioner Mobile Platform</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Staff Authentication</Text>
          <Text style={styles.cardInfo}>
            Select your hospital and sign in using your institutional email credentials.
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Hospital Search Selector */}
          <View style={styles.inputContainer}>
            <View style={styles.inputIcon}>
              <Building size={18} color={colors.secondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Search & Select Hospital"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearchChange}
              onFocus={() => {
                if (searchQuery.trim() && filteredHospitals.length > 0) {
                  setShowDropdown(true);
                } else if (!searchQuery.trim() && hospitals.length > 0) {
                  setFilteredHospitals(hospitals);
                  setShowDropdown(true);
                }
              }}
            />
          </View>

          {/* Dropdown overlay list */}
          {showDropdown && (
            <View style={styles.dropdownContainer}>
              <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                {filteredHospitals.length > 0 ? (
                  filteredHospitals.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.dropdownItem}
                      onPress={() => handleSelectHospital(item)}
                    >
                      <Text style={styles.dropdownItemText}>{item.name}</Text>
                      <Text style={styles.dropdownItemSub}>{item.subdomain}.hmis.com</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.dropdownItem}>
                    <Text style={[styles.dropdownItemSub, { fontStyle: 'italic' }]}>
                      {hospitalsLoaded ? 'No matching hospitals found.' : 'Loading hospitals...'}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          <View style={styles.inputContainer}>
            <View style={styles.inputIcon}>
              <Mail size={18} color={colors.secondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Staff email address"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputIcon}>
              <Lock size={18} color={colors.secondary} />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Account password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
          ) : (
            <View>
              <TouchableOpacity 
                style={styles.button}
                onPress={handleSignIn}
              >
                <Text style={styles.buttonText}>Sign In to Console</Text>
              </TouchableOpacity>

              {isBiometricSupported && isBiometricEnrolled && (
                <TouchableOpacity 
                  style={[styles.button, styles.biometricBtn]}
                  onPress={handleBiometricSignIn}
                >
                  <Fingerprint size={16} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.buttonText}>Unlock with Face ID / Touch ID</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        <Text style={styles.footerNote}>Protected by institutional directory access rules.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  cardInfo: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  inputIcon: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 16,
    fontSize: 14,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  biometricBtn: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  loader: {
    marginVertical: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 40,
  },
  dropdownContainer: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 16,
    maxHeight: 180,
    overflow: 'hidden',
  },
  dropdownList: {
    padding: 8,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  dropdownItemSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  }
});
export default LoginScreen;
