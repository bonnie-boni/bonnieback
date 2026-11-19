import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../src/services/api';
import { saveAuth } from '../src/services/storage';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ serverUrl?: string; pairingToken?: string }>();
  // Normalize the QR-provided URL immediately so the input shows a valid https:// URL.
  const [serverUrl, setServerUrl] = useState(() => {
    const raw = params.serverUrl || '';
    if (!raw) return raw;
    let url = raw.trim();
    if (url.startsWith('http://')) {
      url = 'https://' + url.slice('http://'.length);
    } else if (!url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url.replace(/\/+$/, '');
  });
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Normalize and upgrade the server URL so it is always a reachable
  // https:// URL (prevents the classic 127.0.0.1:PORT connect failure on Android).
  function normalizeServerUrl(input: string): string {
    let url = input.trim();

    // If it already has a scheme, promote http -> https for network access.
    if (url.startsWith('http://')) {
      url = 'https://' + url.slice('http://'.length);
    } else if (!url.startsWith('https://')) {
      url = 'https://' + url;
    }
    return url.replace(/\/+$/, '');
  }

  const resolvedServerUrl = normalizeServerUrl(serverUrl);

  const handleLogin = async () => {
    if (!resolvedServerUrl || !username.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill server URL, username and password.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.login(resolvedServerUrl, {
        username: username.trim(),
        password,
        deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android Phone',
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        pairingToken: params.pairingToken,
      });

      await saveAuth({
        serverUrl: resolvedServerUrl,
        token: result.token,
        deviceId: result.device.id,
        username: result.user.username,
      });

      router.replace('/home');
    } catch (err: any) {
      Alert.alert('Login failed', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Server URL</Text>
      <TextInput
        style={styles.input}
        value={serverUrl}
        onChangeText={setServerUrl}
        placeholder="https://xxxx.trycloudflare.com"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!params.serverUrl}
      />

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder="admin"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor="#64748b"
        secureTextEntry
      />

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Login & Pair</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
  },
  label: {
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0ea5e9',
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
