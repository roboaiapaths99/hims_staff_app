import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert 
} from 'react-native';
import { colors } from '../theme/colors';
import apiClient from '../api/client';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ArrowLeft, Beaker, AlertTriangle, CheckCircle } from 'lucide-react-native';

export const LabResultsScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { visitId } = route.params || {};

  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (visitId) {
      fetchVisitLabResults();
    } else {
      setIsLoading(false);
    }
  }, [visitId]);

  const fetchVisitLabResults = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/api/labs/results', {
        params: { visit_id: visitId }
      });
      setResults(res.data);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to retrieve laboratory investigation results.');
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
        <Text style={styles.headerTitle}>Patient Lab Investigations</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Fetching lab database...</Text>
        </View>
      ) : !visitId || results.length === 0 ? (
        <View style={styles.center}>
          <Beaker size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No laboratory results filed for this visit.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          {results.map((order: any) => (
            <View key={order.id} style={styles.orderCard}>
              <Text style={styles.orderTitle}>Order ID: {order.lab_order_id.slice(-8).toUpperCase()}</Text>
              
              <View style={styles.resultsList}>
                {order.results?.map((r: any, idx: number) => (
                  <View key={idx} style={styles.resultRow}>
                    <View style={styles.resultInfo}>
                      <Text style={styles.testName}>{r.test_name}</Text>
                      <Text style={styles.normalRange}>Ref: {r.normal_range} {r.unit}</Text>
                    </View>
                    <View style={styles.valueCol}>
                      <Text style={[styles.resultValue, r.abnormal_flag && styles.abnormalText]}>
                        {r.result_value} {r.unit}
                      </Text>
                      {r.abnormal_flag && (
                        <View style={styles.alertBadge}>
                          <AlertTriangle size={10} color={colors.danger} />
                          <Text style={styles.alertText}>CRITICAL</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {order.pdf_url && (
                <View style={styles.pdfBadge}>
                  <CheckCircle size={14} color={colors.success} />
                  <Text style={styles.pdfText}>Scanned report PDF linked securely.</Text>
                </View>
              )}
            </View>
          ))}
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
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
  },
  resultsList: {
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  resultInfo: {
    flex: 1,
  },
  testName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },
  normalRange: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  valueCol: {
    alignItems: 'flex-end',
  },
  resultValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.success,
  },
  abnormalText: {
    color: colors.danger,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  alertText: {
    fontSize: 8,
    color: colors.danger,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  pdfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  pdfText: {
    fontSize: 11,
    color: colors.success,
    marginLeft: 6,
    fontWeight: 'bold',
  },
});
