import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PatientVitalsScreen from '../screens/PatientVitalsScreen';
import QuickPrescriptionScreen from '../screens/QuickPrescriptionScreen';
import TelehealthScreen from '../screens/TelehealthScreen';
import { LabResultsScreen } from '../screens/LabResultsScreen';
import { PatientHistoryScreen } from '../screens/PatientHistoryScreen';

// Icons
import { LayoutDashboard } from 'lucide-react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator for main dashboards
const MainTabNavigator = () => {
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
        component={DashboardScreen} 
        options={{
          tabBarLabel: 'OPD Queue',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

import { AmbulanceTasksScreen } from '../screens/AmbulanceTasksScreen';

export const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

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
          <Stack.Screen name="Main" component={MainTabNavigator} />
          <Stack.Screen name="PatientVitals" component={PatientVitalsScreen} />
          <Stack.Screen name="QuickPrescription" component={QuickPrescriptionScreen} />
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
