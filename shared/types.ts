// Shared types between mobile and server (optional reference)

export interface PairingPayload {
  url: string;
  pairingToken: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
  device: {
    id: string;
    name: string;
    platform: string | null;
  };
}

export interface MediaItem {
  id: string;
  content_hash: string;
  original_name: string;
  size_bytes: number;
  mime_type: string | null;
  uploaded_at: string;
}
