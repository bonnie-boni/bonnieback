import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { router } from 'expo-router';
import { getAuth } from '../src/services/storage';
import { api } from '../src/services/api';

export default function Index() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const auth = await getAuth();
        if (!auth) {
          setChecking(false);
          return;
        }
        // Validate token
        await api.me();
        router.replace('/home');
      } catch {
        setChecking(false);
      }
    })();
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.text}>Checking session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LocalCloud</Text>
      <Text style={styles.subtitle}>Private media backup to your laptop</Text>

      <Pressable style={styles.button} onPress={() => router.push('/pair')}>
        <Text style={styles.buttonText}>Scan QR to Pair</Text>
      </Pressable>

      <Pressable style={[styles.button, styles.secondary]} onPress={() => router.push('/login')}>
        <Text style={styles.buttonText}>I already have a server URL</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 48,
    textAlign: 'center',
  },
  text: {
    color: '#94a3b8',
    marginTop: 16,
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: '#1e293b',
  },
  buttonText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
});
