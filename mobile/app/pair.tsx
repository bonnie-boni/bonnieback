import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';

export default function PairScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const parsed = JSON.parse(data);
      if (!parsed.url || !parsed.pairingToken) {
        throw new Error('Invalid QR payload');
      }

      // Navigate to login with the data
      router.replace({
        pathname: '/login',
        params: {
          serverUrl: parsed.url,
          pairingToken: parsed.pairingToken,
        },
      });
    } catch (err) {
      Alert.alert('Invalid QR', 'This does not look like a LocalCloud pairing code.');
      setScanned(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera permission is required to scan the QR code.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>Point the camera at the QR code shown in the TUI</Text>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
      </View>
      {scanned && (
        <Pressable style={styles.button} onPress={() => setScanned(false)}>
          <Text style={styles.buttonText}>Scan again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  hint: {
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
  },
  cameraWrapper: {
    width: 280,
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0ea5e9',
  },
  camera: {
    flex: 1,
  },
  text: {
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
