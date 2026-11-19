import * as SecureStore from 'expo-secure-store';

const KEYS = {
  SERVER_URL: 'server_url',
  TOKEN: 'auth_token',
  DEVICE_ID: 'device_id',
  USERNAME: 'username',
};

export async function saveAuth(data: {
  serverUrl: string;
  token: string;
  deviceId: string;
  username: string;
}) {
  await SecureStore.setItemAsync(KEYS.SERVER_URL, data.serverUrl);
  await SecureStore.setItemAsync(KEYS.TOKEN, data.token);
  await SecureStore.setItemAsync(KEYS.DEVICE_ID, data.deviceId);
  await SecureStore.setItemAsync(KEYS.USERNAME, data.username);
}

export async function getAuth() {
  const [serverUrl, token, deviceId, username] = await Promise.all([
    SecureStore.getItemAsync(KEYS.SERVER_URL),
    SecureStore.getItemAsync(KEYS.TOKEN),
    SecureStore.getItemAsync(KEYS.DEVICE_ID),
    SecureStore.getItemAsync(KEYS.USERNAME),
  ]);

  if (!serverUrl || !token) return null;
  return { serverUrl, token, deviceId, username };
}

export async function clearAuth() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.SERVER_URL),
    SecureStore.deleteItemAsync(KEYS.TOKEN),
    SecureStore.deleteItemAsync(KEYS.DEVICE_ID),
    SecureStore.deleteItemAsync(KEYS.USERNAME),
  ]);
}
