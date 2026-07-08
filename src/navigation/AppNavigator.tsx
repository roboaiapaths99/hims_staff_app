import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DoctorDashboardScreen from '../screens/DoctorDashboardScreen';
import NurseDashboardScreen from '../screens/NurseDashboardScreen';
import PharmacistDashboardScreen from '../screens/PharmacistDashboardScreen';
import ReceptionDashboardScreen from '../screens/ReceptionDashboardScreen';
import AmbulanceDashboardScreen from '../screens/AmbulanceDashboardScreen';
import { LabTechnicianDashboardScreen } from '../screens/LabTechnicianDashboardScreen';
import PatientVitalsScreen from '../screens/PatientVitalsScreen';
import { QuickNotesScreen } from '../screens/QuickNotesScreen';
import TelehealthScreen from '../screens/TelehealthScreen';
import { LabResultsScreen } from '../screens/LabResultsScreen';
import { PatientHistoryScreen } from '../screens/PatientHistoryScreen';
import { AmbulanceTasksScreen } from '../screens/AmbulanceTasksScreen';

// Icons
import { LayoutDashboard } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const RestrictedMobileScreen = () => {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  
  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    
    setIsLoggingOut(true);
    try {
      console.log('Starting logout...');
      await logout();
      console.log('Logout completed');
    } catch (err: any) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={styles.restrictedContainer}>
      <View style={styles.restrictedContent}>
        <Text style={styles.restrictedTitle}>Mobile Access Restricted</Text>
        <Text style={styles.restrictedDescription}>
          This workflow is only available via the HIMS Web Admin Panel. Please log in on a desktop computer.
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
        onPress={handleLogout}
        disabled={isLoggingOut}
        activeOpacity={0.7}
      >
        <Text style={styles.logoutButtonText}>
          {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  restrictedContainer: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    paddingBottom: 40,
  },
  restrictedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  restrictedDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
});

// Bottom Tab Navigator for main dashboards
const MainTabNavigator = ({ role }: { role: string }) => {
  const getDashboardComponent = () => {
    switch (role) {
      case 'nurse':
        return NurseDashboardScreen;
      case 'pharmacist':
        return PharmacistDashboardScreen;
      case 'driver':
        return AmbulanceDashboardScreen;
      case 'doctor':
      case 'surgeon':
      case 'anesthetist':
        return DoctorDashboardScreen;
      default:
        return RestrictedMobileScreen;
    }
  };

  const getTabTitle = () => {
    switch (role) {
      case 'nurse': return 'Nurse Desk';
      case 'pharmacist': return 'Prescriptions';
      case 'driver': return 'Ambulance';
      case 'doctor':
      case 'surgeon':
      case 'anesthetist':
        return 'OPD Queue';
      default: return 'Restricted';
    }
  };

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.secondary,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="DashboardTab" 
        component={getDashboardComponent()} 
        options={{
          tabBarLabel: getTabTitle(),
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return null; // Context will display its own spinner
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // Auth Stack
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        // Main App Stack
        <>
          <Stack.Screen name="Main">
            {(props) => <MainTabNavigator {...props} role={user?.role || 'doctor'} />}
          </Stack.Screen>
          <Stack.Screen name="PatientVitals" component={PatientVitalsScreen} />
          <Stack.Screen name="QuickPrescription" component={QuickNotesScreen} />
          <Stack.Screen name="Telehealth" component={TelehealthScreen} />
          <Stack.Screen name="LabResults" component={LabResultsScreen} />
          <Stack.Screen name="PatientHistory" component={PatientHistoryScreen} />
          <Stack.Screen name="AmbulanceTasks" component={AmbulanceTasksScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
export default AppNavigator;
