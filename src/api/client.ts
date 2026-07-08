import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getBaseUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri || '';
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:8002`;
  }
  
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8002';
  }
  return 'http://localhost:8002';
};

const API_BASE_URL = getBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('hmis_token');
    const branchId = await AsyncStorage.getItem('hmis_current_branch_id');
    const tenantId = await AsyncStorage.getItem('hmis_user_tenant_id');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (branchId) {
      config.headers['X-Branch-ID'] = branchId;
    }
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Offline Queue Handler
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isNetworkError = !error.response && error.message === 'Network Error';
    const isMutative = ['post', 'put', 'delete'].includes(originalRequest?.method?.toLowerCase());
    const isAuth = originalRequest?.url?.includes('/api/auth/');

    if (isNetworkError && isMutative && !isAuth && !originalRequest._retry) {
      try {
        const queueRaw = await AsyncStorage.getItem('hmis_offline_queue');
        const queue = queueRaw ? JSON.parse(queueRaw) : [];
        
        // Serialize request config
        const serialized = {
          url: originalRequest.url,
          method: originalRequest.method,
          data: originalRequest.data ? JSON.parse(originalRequest.data) : null,
          params: originalRequest.params,
          timestamp: new Date().toISOString()
        };
        
        queue.push(serialized);
        await AsyncStorage.setItem('hmis_offline_queue', JSON.stringify(queue));
        console.log('Action cached offline:', serialized.url);
        
        // Return a mock successful response so client app handles state update
        return Promise.resolve({
          data: { status: 'queued', message: 'Action saved for offline synchronization.' },
          status: 202,
          statusText: 'Accepted',
          headers: {},
          config: originalRequest
        });
      } catch (e) {
        console.error('Failed to write to offline queue', e);
      }
    }
    return Promise.reject(error);
  }
);

// Background Synchronization Worker
export const syncOfflineQueue = async () => {
  try {
    const queueRaw = await AsyncStorage.getItem('hmis_offline_queue');
    if (!queueRaw) return;

    const queue = JSON.parse(queueRaw);
    if (queue.length === 0) return;

    console.log(`Attempting to sync ${queue.length} offline actions...`);
    const remaining = [];

    for (const action of queue) {
      try {
        await apiClient({
          url: action.url,
          method: action.method,
          data: action.data,
          params: action.params,
          headers: { 'X-Sync-Replay': 'true' }
        });
        console.log('Synced offline action successfully:', action.url);
      } catch (e) {
        console.warn('Sync attempt failed for action, keeping in queue:', action.url, e);
        remaining.push(action);
      }
    }

    await AsyncStorage.setItem('hmis_offline_queue', JSON.stringify(remaining));
  } catch (e) {
    console.error('Sync processor execution failed', e);
  }
};

// Start periodic sync polling
if (Platform.OS === 'web') {
  setInterval(syncOfflineQueue, 20000); // 20s poll on Web
} else {
  // Can be called from AppState listeners or intervals
  setInterval(syncOfflineQueue, 30000);
}

export default apiClient;
