import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import { api } from '../src/services/api';

type Asset = MediaLibrary.Asset;

export default function LibraryScreen() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });

  useEffect(() => {
    (async () => {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          setLoading(false);
          return;
        }
      }
      await loadAssets();
    })();
  }, [permission]);

  async function loadAssets() {
    setLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: 100,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setAssets(result.assets);
    } catch (err) {
      console.warn(err);
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pickDocuments() {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;

    // Treat documents as selected items for upload
    await uploadDocuments(result.assets);
  }

  async function uploadDocuments(docs: DocumentPicker.DocumentPickerAsset[]) {
    setUploading(true);
    setProgress({ current: 0, total: docs.length, name: '' });

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      setProgress({ current: i + 1, total: docs.length, name: doc.name });
      try {
        await api.uploadFile(doc.uri, doc.name, doc.mimeType || 'application/octet-stream');
      } catch (err: any) {
        console.warn('Upload failed', doc.name, err.message);
      }
    }

    setUploading(false);
    Alert.alert('Done', `Finished processing ${docs.length} document(s).`);
  }

  async function startBackup() {
    if (selected.size === 0) {
      Alert.alert('Nothing selected', 'Select some photos/videos first.');
      return;
    }

    const net = await Network.getNetworkStateAsync();
    if (!(net.isConnected && net.type === Network.NetworkStateType.WIFI)) {
      Alert.alert(
        'Wi-Fi required',
        'Auto and manual backups are restricted to Wi-Fi to avoid mobile data usage. Connect to Wi-Fi and try again.'
      );
      return;
    }

    const toUpload = assets.filter((a) => selected.has(a.id));
    setUploading(true);
    setProgress({ current: 0, total: toUpload.length, name: '' });

    // First check hashes that already exist (dedup)
    // For simplicity in this scaffold we skip client-side hashing
    // and let the server deduplicate after upload.

    let success = 0;
    for (let i = 0; i < toUpload.length; i++) {
      const asset = toUpload[i];
      setProgress({ current: i + 1, total: toUpload.length, name: asset.filename });

      try {
        // Get a local URI we can upload
        const info = await MediaLibrary.getAssetInfoAsync(asset);
        const uri = info.localUri || asset.uri;

        await api.uploadFile(
          uri,
          asset.filename,
          asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          {
            originalPath: asset.uri,
            takenAt: asset.creationTime ? new Date(asset.creationTime).toISOString() : '',
            width: String(asset.width || ''),
            height: String(asset.height || ''),
            durationMs: asset.duration ? String(Math.round(asset.duration * 1000)) : '',
          }
        );
        success++;
      } catch (err: any) {
        console.warn('Failed', asset.filename, err.message);
      }
    }

    setUploading(false);
    setSelected(new Set());
    Alert.alert('Backup finished', `Successfully uploaded ${success} of ${toUpload.length} items.`);
  }

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Media library permission is required.</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.count}>{selected.size} selected</Text>
        <Pressable onPress={pickDocuments}>
          <Text style={styles.link}>+ Documents</Text>
        </Pressable>
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ padding: 4 }}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable style={styles.item} onPress={() => toggle(item.id)}>
              <Image source={{ uri: item.uri }} style={styles.thumb} />
              {isSelected && (
                <View style={styles.checkmark}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>
                </View>
              )}
              {item.mediaType === 'video' && (
                <View style={styles.videoBadge}>
                  <Text style={styles.videoText}>VIDEO</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        {uploading ? (
          <View style={styles.progressBox}>
            <ActivityIndicator color="#38bdf8" />
            <Text style={styles.progressText}>
              {progress.current}/{progress.total} – {progress.name}
            </Text>
          </View>
        ) : (
          <Pressable
            style={[styles.button, selected.size === 0 && styles.buttonDisabled]}
            onPress={startBackup}
            disabled={selected.size === 0}
          >
            <Text style={styles.buttonText}>
              Backup {selected.size > 0 ? `${selected.size} items` : ''}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#f8fafc', marginBottom: 16 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  count: { color: '#94a3b8' },
  link: { color: '#38bdf8', fontWeight: '600' },
  item: {
    flex: 1 / 3,
    aspectRatio: 1,
    margin: 2,
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%', borderRadius: 4 },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#0ea5e9',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  videoText: { color: '#fff', fontSize: 10 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  progressBox: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressText: { color: '#e2e8f0', flex: 1 },
});
