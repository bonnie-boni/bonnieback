# Media Backup App – Detailed Project Plan

**Project Name (working):** LocalCloud Media Backup  
**Goal:** A private, self-hosted media backup system where your laptop acts as the cloud server. The React Native mobile app backs up photos, videos, and documents from the phone to the laptop with one-time QR pairing, auto-backup (Wi-Fi only), original quality, and content-hash deduplication.

---

## 1. Core Decisions (Locked In)

| Area                    | Decision                                                                 |
|-------------------------|--------------------------------------------------------------------------|
| Server language         | Node.js                                                                  |
| Mobile framework        | React Native (Expo recommended for faster development)                   |
| Remote access           | Cloudflare Tunnel (with Let’s Encrypt HTTPS)                             |
| Authentication model    | One owner account per laptop. Multiple devices (phones) under the same account. |
| Pairing                 | QR code contains temporary pairing token + server URL                    |
| Login after pairing     | Username + password (device is then bound to the account)                |
| Auto-backup             | Enabled, **only when on Wi-Fi**                                          |
| Media selection         | Both individual files **and** entire folders/albums. Selection is persisted. |
| Quality                 | Original quality – no compression or transcoding                         |
| Storage layout          | Single parent folder on the laptop (e.g. `~/LocalCloudBackups/`). Files organized inside by date + device. |
| Deduplication           | Content-hash based (SHA-256). Duplicate files are skipped.               |
| Delete sync             | **One-way only**. Deleting a file on the phone does **not** delete it on the server. |
| Server UI (v1)          | Terminal User Interface (TUI)                                            |
| Media types             | Photos, Videos, Documents                                                |
| Progress                | Real-time progress bar + estimated time remaining                        |
| First admin user        | Created manually via TUI or config file                                  |
| HTTPS                   | Let’s Encrypt certificates via Cloudflare Tunnel                         |

---

## 2. High-Level Architecture

```
┌──────────────────────────────┐
│     React Native App         │
│  (Phone – Expo / RN)         │
│                              │
│  • Media library access      │
│  • Folder / file selection   │
│  • QR scanner                │
│  • Secure token storage      │
│  • Upload queue + progress  │
│  • Background Wi-Fi check    │
└──────────────┬───────────────┘
               │ HTTPS (Cloudflare Tunnel)
               │ Resumable / chunked uploads
               │ JWT device token
┌──────────────▼───────────────┐
│     Node.js Server           │
│  (Laptop)                    │
│                              │
│  • Express / Fastify API     │
│  • Pairing + Auth service    │
│  • File storage + hashing    │
│  • SQLite metadata DB        │
│  • TUI (blessed / ink / etc) │
│  • Cloudflare Tunnel client  │
└──────────────────────────────┘
```

---

## 3. User & Device Model

- **One Owner Account** per laptop installation.
  - Username + password (created once via TUI).
  - Password stored as bcrypt hash.
- **Multiple Devices** can be paired to the same account.
  - Each device receives its own long-lived JWT after successful pairing + login.
  - Devices are tracked (name, last seen, platform, storage used by that device).
- Files are owned by the account, not by individual devices. Device metadata is stored only for organization and statistics.

---

## 4. Pairing & Authentication Flow

1. Owner starts the server and opens the TUI.
2. Owner selects “Generate Pairing QR”.
3. Server creates a short-lived pairing token (e.g. 5–10 minutes) and displays a QR code containing:
   ```json
   {
     "url": "https://your-tunnel.example.com",
     "pairingToken": "tmp_abc123xyz..."
   }
   ```
4. User opens the mobile app → taps “Pair Device” → scans the QR.
5. App sends the pairing token to `POST /api/pair`.
6. Server validates the temporary token and responds with a challenge (or directly allows login).
7. User enters **username + password** on the phone.
8. On success the server issues a long-lived **device JWT** (or refresh + access token pair).
9. App stores the JWT + server URL securely (Expo SecureStore / Keychain).
10. Device is now permanently paired until the owner revokes it from the TUI.

Subsequent app launches use the stored JWT. If the token is revoked or expired, the user must re-pair.

---

## 5. Backup Behavior

### Selection
- User can browse the phone’s media library and document folders.
- Select individual items **or** entire albums/folders (Camera, Screenshots, Downloads, WhatsApp, etc.).
- Selection is saved locally and synced to the server as “watched paths/albums”.

### Auto-backup
- Runs only when the device is connected to Wi-Fi.
- Periodically scans the selected folders for new or changed files.
- For each candidate file:
  1. Compute local SHA-256 hash (or request server to check).
  2. Query server: “Do you already have this hash?”
  3. If yes → skip.
  4. If no → add to upload queue.

### Upload
- Chunked / resumable uploads (recommended: tus protocol or custom chunked with `Content-Range`).
- Shows:
  - Overall progress
  - Current file name + size
  - Upload speed
  - Estimated time remaining
- Supports pause / resume / cancel.
- Background uploads are attempted when the app is backgrounded (platform limitations apply, especially on iOS).

### One-way nature
- Server never deletes files based on phone state.
- User can manually delete files from the server later via a future web UI or TUI commands.

---

## 6. Storage Layout on Laptop

```
~/LocalCloudBackups/                  ← Parent folder (configurable)
├── .db/                              ← SQLite database + WAL files
│   └── media.db
├── files/
│   ├── 2025/
│   │   ├── 11/
│   │   │   ├── 18/
│   │   │   │   ├── <sha256>.jpg
│   │   │   │   ├── <sha256>.mp4
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── thumbs/                           ← Optional future thumbnails
```

- Files are stored by **content hash** (SHA-256) as the filename. This makes deduplication trivial and collision-resistant.
- Original filename, path, MIME type, size, taken-at, device ID, upload timestamp, etc. are stored in the SQLite database.
- A single physical file can be referenced by multiple logical entries if needed in the future.

---

## 7. Server TUI Requirements (v1)

The terminal interface should support at minimum:

- Start / Stop / Restart the HTTP server
- Show current status (running, tunnel status, uptime)
- Generate new pairing QR code (and display it in terminal or open in browser)
- Create the initial admin user (or reset password)
- List paired devices (name, last seen, platform, approx. storage used)
- Revoke a device
- View storage usage (total + per device)
- View recent uploads (last N files with timestamp, size, device)
- Basic configuration (change parent backup folder, port, etc.)
- View logs / live log tail

Recommended libraries:
- `ink` (React for CLI) or `blessed` / `neo-blessed` for richer TUI
- `qrcode-terminal` or `qrcode` for QR display

---

## 8. API Surface (High Level)

### Public / Pairing
- `POST /api/pair` – exchange temporary pairing token
- `POST /api/login` – username + password → device JWT

### Authenticated (Bearer JWT)
- `GET  /api/me` – current user + device info
- `GET  /api/devices` – list devices (owner only)
- `DELETE /api/devices/:id` – revoke device
- `POST /api/uploads/check` – batch check hashes (dedup)
- `POST /api/uploads` – initiate upload (returns upload URL / ID)
- `PATCH /api/uploads/:id` – upload chunk (or tus protocol)
- `POST /api/uploads/:id/complete`
- `GET  /api/media` – list backed-up media (with filters, pagination)
- `GET  /api/media/:id` – metadata + download URL
- `GET  /api/stats` – storage usage, recent activity

---

## 9. Mobile App Screens (v1)

1. **Onboarding / Pairing Screen** – QR scanner + status
2. **Login Screen** – username + password (shown after successful QR scan)
3. **Home / Dashboard** – backup status, last sync, storage used, quick actions
4. **Library / Selection Screen** – browse phone media + documents, multi-select files and folders
5. **Upload Queue** – active, paused, completed, failed items with progress
6. **Settings**
   - Auto-backup toggle + Wi-Fi only (locked)
   - Selected folders management
   - Device name
   - Logout / Unpair
   - Server info

---

## 10. Technology Recommendations

### Server
- Runtime: Node.js 20+
- Framework: Fastify or Express
- Database: better-sqlite3 or Prisma + SQLite
- Auth: jsonwebtoken + bcrypt
- File uploads: `@tus/server` (recommended) or custom multer + range support
- TUI: ink + ink-qrcode or blessed
- Tunnel: `cloudflared` binary (managed by the server process or systemd)
- Hashing: Node crypto (SHA-256)

### Mobile
- Expo (managed workflow) for speed, or bare React Native
- Key libraries:
  - `expo-camera` / `expo-barcode-scanner` (QR)
  - `expo-media-library`
  - `expo-document-picker` + `expo-file-system`
  - `expo-secure-store`
  - `expo-network` (Wi-Fi detection)
  - `react-native-background-actions` or Expo background fetch (limited)
  - Upload: tus-js-client or custom axios with progress

---

## 11. Security Considerations

- All traffic over HTTPS via Cloudflare Tunnel + Let’s Encrypt.
- Pairing tokens are short-lived and single-use.
- Device JWTs have reasonable expiry + refresh mechanism (or long-lived with revocation list).
- Passwords hashed with bcrypt (cost factor ≥ 12).
- File paths on disk never trust client-supplied names (hash-based storage).
- Rate limiting on login and pairing endpoints.
- TUI should require local access only (or additional protection later).

---

## 12. Development Phases (Suggested)

### Phase 1 – Foundation
- Server skeleton + SQLite schema
- TUI basic commands (start/stop, create user, generate QR)
- Pairing + login flow
- Cloudflare Tunnel integration
- Mobile: QR scan → login → store token

### Phase 2 – Core Backup
- Media + document selection UI
- Hash checking endpoint
- Chunked / resumable upload
- Progress + ETA
- Basic auto-backup (foreground + Wi-Fi check)

### Phase 3 – Polish & Multi-device
- Device management in TUI
- Upload queue persistence
- Better error handling & retries
- Storage stats
- Background upload improvements

### Phase 4 – Future
- Web UI for browsing/deleting media on the laptop
- Thumbnails / previews
- Search
- Selective restore to phone
- Multiple owner accounts (if ever needed)

---

## 13. What Will Be Needed to Build This

### Skills / Knowledge
- Node.js + TypeScript (strongly recommended)
- React Native / Expo
- REST API design
- Basic cryptography (hashing, JWT)
- SQLite
- Terminal UI libraries
- Cloudflare Tunnel setup

### Tools & Accounts
- Node.js 20+
- Expo CLI / EAS (for builds)
- Cloudflare account (free tier is enough for Tunnel)
- A domain (optional but nicer) or use trycloudflare.com temporary tunnels for development
- Android Studio / Xcode for device testing (or Expo Go for early development)

### Hardware
- Laptop that stays on (or at least runs the server when needed)
- Phone for testing (Android is easier for background work)

---

## 14. Open Implementation Details (to decide during coding)

- Exact resumable upload protocol (tus vs custom)
- JWT lifetime and refresh strategy
- How aggressively to scan for new media
- Whether to support Live Photos / Motion Photos specially
- Naming of the parent backup folder and config location
- Whether the TUI should also serve a simple status web page

---

**Next Step:**  
Once you approve this plan (or request changes), we can start scaffolding the actual monorepo structure, database schema, and the first vertical slice (pairing + TUI + basic server).

Reply with any adjustments you want to the plan, or say “approved – start scaffolding” and we begin implementation.