import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Network from 'expo-network';
import { api } from '../src/services/api';
import { getAuth, clearAuth } from '../src/services/storage';

export default function HomeScreen() {
  const [stats, setStats] = useState<{ fileCount: number; totalMB: number } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [username, setUsername] = useState('');
  const [wifi, setWifi] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const auth = await getAuth();
      if (auth) setUsername(auth.username || '');

      const net = await Network.getNetworkStateAsync();
      setWifi(!!(net.isConnected && net.type === Network.NetworkStateType.WIFI));

      const [s, r] = await Promise.all([api.getStats(), api.getRecent(10)]);
      setStats(s);
      setRecent(r.items || []);
    } catch (err: any) {
      console.warn(err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Unpair device', 'This will remove the stored credentials on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unpair',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}
    >
      <Text style={styles.greeting}>Hello, {username || 'User'}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Storage</Text>
        <Text style={styles.stat}>
          {stats ? `${stats.fileCount} files · ${stats.totalMB} MB` : '—'}
        </Text>
        <Text style={styles.wifi}>
          Network: {wifi ? 'Wi-Fi ✓ (auto-backup allowed)' : 'Not Wi-Fi (auto-backup paused)'}
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => router.push('/library')}>
        <Text style={styles.primaryButtonText}>Select Media to Backup</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent uploads</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No uploads yet</Text>
        ) : (
          recent.map((item) => (
            <Text key={item.id} style={styles.recentItem} numberOfLines={1}>
              {item.original_name} · {Math.round(item.size_bytes / 1024)} KB
            </Text>
          ))
        )}
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => router.push('/settings')}>
        <Text style={styles.secondaryButtonText}>Settings</Text>
      </Pressable>

      <Pressable style={styles.dangerButton} onPress={handleLogout}>
        <Text style={styles.dangerButtonText}>Unpair this device</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20 },
  greeting: { color: '#f8fafc', fontSize: 22, fontWeight: '700', marginBottom: 20 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 8 },
  stat: { color: '#f8fafc', fontSize: 20, fontWeight: '600' },
  wifi: { color: '#64748b', marginTop: 8, fontSize: 13 },
  primaryButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: { color: '#e2e8f0', fontWeight: '500' },
  dangerButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerButtonText: { color: '#f87171' },
  empty: { color: '#64748b' },
  recentItem: { color: '#cbd5e1', marginBottom: 6 },
});
