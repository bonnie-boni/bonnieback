import { getAuth } from './storage';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Normalize the stored server URL so it is always a reachable
// http(s) URL.  This prevents the classic "fetch failed:
// java.net.ConnectException / 127.0.0.1:PORT" when the saved URL is
// http://127.0.0.1:PORT (which never routes from a phone) or has stray
// whitespace / trailing slashes.
function normalizeServerUrl(input: string): string {
  let url = input.trim();

  // If it already has a scheme, keep it as-is (the server may be
  // http:// for local WiFi or https:// when TLS is enabled).
  if (url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
    return url;
  }

  // Bare host:port or host:port/path
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  serverUrlOverride?: string
): Promise<T> {
  const auth = await getAuth();
  let base = serverUrlOverride || (auth?.serverUrl || '');
  if (!base) throw new Error('No server URL configured');

  // Normalize and upgrade the URL so it is reachable from the phone.
  base = normalizeServerUrl(base);

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error || text;
    } catch {}
    throw new ApiError(res.status, message);
  }

  return res.json();
}

export const api = {
  login: (serverUrl: string, body: {
    username: string;
    password: string;
    deviceName: string;
    platform?: string;
    pairingToken?: string;
  }) =>
    request<{
      token: string;
      user: { id: string; username: string };
      device: { id: string; name: string; platform: string | null };
    }>('/api/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }, serverUrl),

  me: () => request<{ user: any; deviceId: string }>('/api/me'),

  checkHashes: (hashes: string[]) =>
    request<{ existing: Record<string, boolean> }>('/api/uploads/check', {
      method: 'POST',
      body: JSON.stringify({ hashes }),
    }),

  uploadFile: async (
    uri: string,
    filename: string,
    mimeType: string,
    extraFields?: Record<string, string>,
    onProgress?: (pct: number) => void
  ) => {
    const auth = await getAuth();
    if (!auth) throw new Error('Not authenticated');

    const form = new FormData();
    form.append('file', {
      uri,
      name: filename,
      type: mimeType,
    } as any);

    if (extraFields) {
      Object.entries(extraFields).forEach(([k, v]) => form.append(k, v));
    }

    // Note: fetch progress is limited in RN. For real progress use XMLHttpRequest or a library.
    const res = await fetch(`${normalizeServerUrl(auth.serverUrl).replace(/\/$/, '')}/api/uploads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text);
    }

    return res.json();
  },

  getStats: () => request<{ fileCount: number; totalBytes: number; totalMB: number }>('/api/stats'),

  getRecent: (limit = 20) =>
    request<{ items: any[] }>(`/api/media/recent?limit=${limit}`),
};
