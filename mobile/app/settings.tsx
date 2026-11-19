import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert } from 'react-native';
import { getAuth, clearAuth } from '../src/services/storage';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [autoBackup, setAutoBackup] = useState(true); // conceptual for now

  useEffect(() => {
    (async () => {
      const auth = await getAuth();
      if (auth) {
        setServerUrl(auth.serverUrl);
        setUsername(auth.username || '');
      }
    })();
  }, []);

  const handleUnpair = () => {
    Alert.alert('Unpair', 'Remove credentials from this device?', [
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
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.rowLabel}>Username</Text>
        <Text style={styles.rowValue}>{username}</Text>
        <Text style={styles.rowLabel}>Server</Text>
        <Text style={styles.rowValue} numberOfLines={2}>{serverUrl}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auto-backup (Wi-Fi only)</Text>
          <Switch
            value={autoBackup}
            onValueChange={setAutoBackup}
            trackColor={{ true: '#0ea5e9' }}
          />
        </View>
        <Text style={styles.hint}>
          Auto-backup only runs when the device is connected to Wi-Fi. Background scanning will be improved in a later version.
        </Text>
      </View>

      <Pressable style={styles.danger} onPress={handleUnpair}>
        <Text style={styles.dangerText}>Unpair this device</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: '#e2e8f0', marginBottom: 4 },
  rowValue: { color: '#94a3b8', marginBottom: 12 },
  hint: { color: '#64748b', fontSize: 13, marginTop: 8 },
  danger: { marginTop: 12, alignItems: 'center', padding: 14 },
  dangerText: { color: '#f87171' },
});
