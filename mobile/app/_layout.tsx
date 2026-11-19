import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'LocalCloud' }} />
        <Stack.Screen name="pair" options={{ title: 'Pair Device' }} />
        <Stack.Screen name="login" options={{ title: 'Login' }} />
        <Stack.Screen name="home" options={{ title: 'Backup', headerBackVisible: false }} />
        <Stack.Screen name="library" options={{ title: 'Select Media' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
