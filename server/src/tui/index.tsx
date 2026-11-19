#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import QRCode from 'qrcode';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { createPairingToken, listDevices, revokeDevice, getUserById } from '../services/auth.js';
import { getStorageStats, listRecentMedia } from '../services/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Screen = 'menu' | 'qr' | 'devices' | 'stats' | 'recent' | 'help';

function App() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('menu');
  const [serverProcess, setServerProcess] = useState<ChildProcess | null>(null);
  const [serverRunning, setServerRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrText, setQrText] = useState('');
  const [devices, setDevices] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);

  // Load admin user id (first user)
  const admin = db.prepare('SELECT id, username FROM users LIMIT 1').get() as { id: string; username: string } | undefined;

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      if (screen !== 'menu') {
        setScreen('menu');
        setMessage('');
        return;
      }
      if (serverProcess) serverProcess.kill();
      exit();
    }

    if (screen === 'menu') {
      if (input === '1') toggleServer();
      if (input === '2') generateQR();
      if (input === '3') showDevices();
      if (input === '4') showStats();
      if (input === '5') showRecent();
      if (input === 'h') setScreen('help');
    }

    if (screen === 'devices' && input === 'r') {
      // revoke selected later – for now just refresh
      showDevices();
    }
  });

  function toggleServer() {
    if (serverRunning && serverProcess) {
      serverProcess.kill();
      setServerProcess(null);
      setServerRunning(false);
      setMessage('Server stopped');
      return;
    }

    const child = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: path.join(__dirname, '../..'),
      stdio: 'ignore',
      detached: false,
      env: { ...process.env },
    });

    child.on('exit', () => {
      setServerRunning(false);
      setServerProcess(null);
    });

    setServerProcess(child);
    setServerRunning(true);
    setMessage(`Server starting on port ${config.port}...`);
  }

  async function generateQR() {
    if (!admin) {
      setMessage('No admin user found. Run npm run db:migrate first.');
      return;
    }

    const token = createPairingToken(admin.id);

    // For development we use localhost. In production use a reachable URL
    // (Cloudflare tunnel / LAN IP). 127.0.0.1 never works from a phone.
    const PUBLIC_URL = process.env.PUBLIC_URL;
    const baseUrl =
      PUBLIC_URL ||
      (process.env.LOCALCLOUD_ENV === 'android-emulator'
        ? `http://10.0.2.2:${config.port}`
        : process.env.LOCALCLOUD_ENV === 'ios'
        ? `http://127.0.0.1:${config.port}`
        : `http://localhost:${config.port}`);
    const tunnelUrl = process.env.CLOUDFLARE_TUNNEL_URL;
    const payload = JSON.stringify({
      url: tunnelUrl || baseUrl,
      pairingToken: token,
    });

    setQrText(payload);

    try {
      // Generate terminal-friendly QR (we just show the JSON + instructions)
      const terminalQR = await QRCode.toString(payload, { type: 'terminal', small: true });
      setQrDataUrl(terminalQR);
      setScreen('qr');
      setMessage(`Pairing token valid for ${config.pairingTokenTtlSeconds / 60} minutes`);
    } catch (err) {
      setMessage('Failed to generate QR');
    }
  }

  function showDevices() {
    if (!admin) return;
    const list = listDevices(admin.id);
    setDevices(list);
    setScreen('devices');
  }

  function showStats() {
    if (!admin) return;
    const s = getStorageStats(admin.id);
    setStats(s);
    setScreen('stats');
  }

  function showRecent() {
    if (!admin) return;
    const items = listRecentMedia(admin.id, 15);
    setRecent(items);
    setScreen('recent');
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">LocalCloud Media Backup – TUI</Text>
      </Box>

      {screen === 'menu' && (
        <Box flexDirection="column">
          <Text>Server status: {serverRunning ? <Text color="green">RUNNING</Text> : <Text color="red">STOPPED</Text>}</Text>
          <Text>Port: {config.port}</Text>
          <Text>Backup root: {config.backupRoot}</Text>
          <Text> </Text>
          <Text>[1] Start / Stop server</Text>
          <Text>[2] Generate pairing QR</Text>
          <Text>[3] List devices</Text>
          <Text>[4] Storage stats</Text>
          <Text>[5] Recent uploads</Text>
          <Text>[h] Help</Text>
          <Text>[q] Quit</Text>
          {message ? <Box marginTop={1}><Text color="yellow">{message}</Text></Box> : null}
        </Box>
      )}

      {screen === 'qr' && (
        <Box flexDirection="column">
          <Text bold>Scan this with the mobile app</Text>
          <Text dimColor>(or copy the JSON below)</Text>
          <Text> </Text>
          <Text>{qrDataUrl}</Text>
          <Text> </Text>
          <Text dimColor>Raw payload:</Text>
          <Text wrap="truncate">{qrText}</Text>
          <Text> </Text>
          <Text color="gray">Press Esc to go back</Text>
          {message ? <Text color="yellow">{message}</Text> : null}
        </Box>
      )}

      {screen === 'devices' && (
        <Box flexDirection="column">
          <Text bold>Paired Devices</Text>
          <Text> </Text>
          {devices.length === 0 ? (
            <Text dimColor>No devices paired yet.</Text>
          ) : (
            devices.map((d) => (
              <Text key={d.id}>
                • {d.name} ({d.platform || 'unknown'}) – last seen: {d.last_seen_at || 'never'}
                {d.revoked_at ? ' [REVOKED]' : ''}
              </Text>
            ))
          )}
          <Text> </Text>
          <Text color="gray">Press Esc to go back</Text>
        </Box>
      )}

      {screen === 'stats' && stats && (
        <Box flexDirection="column">
          <Text bold>Storage Statistics</Text>
          <Text> </Text>
          <Text>Files: {stats.fileCount}</Text>
          <Text>Total size: {stats.totalMB} MB ({stats.totalBytes} bytes)</Text>
          <Text> </Text>
          <Text color="gray">Press Esc to go back</Text>
        </Box>
      )}

      {screen === 'recent' && (
        <Box flexDirection="column">
          <Text bold>Recent Uploads</Text>
          <Text> </Text>
          {recent.length === 0 ? (
            <Text dimColor>No uploads yet.</Text>
          ) : (
            recent.map((m) => (
              <Text key={m.id}>
                {m.uploaded_at} – {m.original_name} ({Math.round(m.size_bytes / 1024)} KB)
              </Text>
            ))
          )}
          <Text> </Text>
          <Text color="gray">Press Esc to go back</Text>
        </Box>
      )}

      {screen === 'help' && (
        <Box flexDirection="column">
          <Text bold>Help</Text>
          <Text> </Text>
          <Text>1. Run `npm run db:migrate` once to create the admin user.</Text>
          <Text>2. Start the server with [1].</Text>
          <Text>3. Generate a QR with [2] and scan it from the mobile app.</Text>
          <Text>4. Login with the admin username/password on the phone.</Text>
          <Text> </Text>
          <Text>For remote access, run cloudflared tunnel and set PUBLIC_URL.</Text>
          <Text> </Text>
          <Text color="gray">Press Esc to go back</Text>
        </Box>
      )}
    </Box>
  );
}

render(<App />);
