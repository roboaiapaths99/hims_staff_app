import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  ActivityIndicator, Platform, Alert 
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { PhoneOff } from 'lucide-react-native';

export const TelehealthScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { sessionId } = route.params || {};

  const [isLoading, setIsLoading] = useState(true);

  // Points to public Jitsi lobby page
  const FRONTEND_HOST = Platform.select({
    android: 'http://10.0.2.2:5173',
    default: 'http://localhost:5173'
  });

  const jitsiUrl = `${FRONTEND_HOST}/patient/teleconsultation/${sessionId}`;

  const handleEndCall = () => {
    Alert.alert('Leave Consultation', 'Are you sure you want to exit the video call room?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', onPress: () => navigation.goBack(), style: 'destructive' }
    ]);
  };

  if (!sessionId) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Invalid Telemedicine session ID.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.webContainer}>
        <WebView
          source={{ uri: jitsiUrl }}
          style={styles.webview}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          originWhitelist={['*']}
          permissionDialogTitle={'Camera & Microphone Access'}
          permissionDialogMessage={'We need camera and microphone permissions to connect your video call.'}
        />
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Initializing Jitsi video feed...</Text>
          </View>
        )}
      </View>

      {/* Floating control bar */}
      <View style={styles.controlBar}>
        <TouchableOpacity style={styles.endCallButton} onPress={handleEndCall}>
          <PhoneOff size={22} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  webContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: 'bold',
  },
  controlBar: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: colors.danger,
    borderRadius: 32,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  }
});
export default TelehealthScreen;
