import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { registerForPushNotificationsAsync } from '../utils/notifications';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant_id: string | null;
  hospital_id: string | null;
  branch_id: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (email: string, password: string, selectedTenantId?: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotificationsAsync().catch(err => console.log('Push notification registration failed', err));
    }
  }, [isAuthenticated]);

  const loadStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('hmis_token');
      const storedUser = await AsyncStorage.getItem('hmis_user_data');
      if (token && storedUser) {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      }
    } catch (e) {
      console.error('Failed to load stored auth details', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, selectedTenantId?: string | null) => {
    try {
      let deviceId = await AsyncStorage.getItem('hmis_device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
        await AsyncStorage.setItem('hmis_device_id', deviceId);
      }

      const res = await apiClient.post('/api/auth/login', { 
        email, 
        password,
        tenant_id: selectedTenantId || undefined,
        device_id: deviceId
      });
      const { access_token, user: userData } = res.data;

      // Validate that the user belongs to the selected tenant (if selected)
      if (selectedTenantId && userData.tenant_id !== selectedTenantId) {
        throw new Error('Access denied: You are not registered under this hospital.');
      }

      // Validate that the user role is a registered staff member (not a patient)
      const blockedRoles = ['patient', 'super_admin'];
      if (blockedRoles.includes(userData.role)) {
        throw new Error('Access denied: This app is for hospital staff only.');
      }

      await AsyncStorage.setItem('hmis_token', access_token);
      await AsyncStorage.setItem('hmis_user_data', JSON.stringify(userData));
      if (userData.branch_id) {
        await AsyncStorage.setItem('hmis_current_branch_id', userData.branch_id);
      }
      if (userData.tenant_id) {
        await AsyncStorage.setItem('hmis_user_tenant_id', userData.tenant_id);
      }

      setUser(userData);
      setIsAuthenticated(true);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to sign in. Please verify your credentials.';
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      console.log('Clearing auth session...');
      await AsyncStorage.removeItem('hmis_token');
      await AsyncStorage.removeItem('hmis_user_data');
      await AsyncStorage.removeItem('hmis_current_branch_id');
      await AsyncStorage.removeItem('hmis_user_tenant_id');
      console.log('Auth data cleared, updating state...');
      setUser(null);
      setIsAuthenticated(false);
      console.log('Logout complete');
    } catch (e) {
      console.error('Failed to clear session details', e);
      throw e; // Re-throw so caller knows there was an error
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
