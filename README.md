# LocalCloud Media Backup

Private self-hosted media backup system. Your laptop acts as the cloud server. React Native app backs up photos, videos, and documents with QR pairing, auto-backup (Wi-Fi only), original quality, and content-hash deduplication.

## Project Structure

```
localcloud-media-backup/
├── server/                 # Node.js backend + TUI
├── mobile/                 # React Native (Expo) app
├── shared/                 # Shared types (optional)
├── plan.md                 # Full project plan
└── README.md
```

---

## Prerequisites

- **Node.js 20+**
- **npm** or **pnpm** / **yarn**
- **Cloudflare account** (free) for Tunnel
- **Expo Go** app on your phone (for development) or Android Studio / Xcode
- A domain (optional) or use Cloudflare quick tunnels for testing

---

## 1. Server Setup

```bash
cd server
cp .env.example .env
# Edit .env with your values (see below)
pnpm install
pnpm run db:migrate        # Creates SQLite database
pnpm run tui               # Start the Terminal UI
```

### Server `.env` (fill these in)

```env
PORT=3847
HOST=0.0.0.0
JWT_SECRET=change-this-to-a-long-random-string
BACKUP_ROOT=./data/backups
DATABASE_PATH=./data/media.db
PAIRING_TOKEN_TTL_SECONDS=600
DEVICE_TOKEN_TTL_DAYS=365
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-on-first-run
CLOUDFLARE_TUNNEL_TOKEN=          # Optional: from Cloudflare Zero Trust
```

### Useful Server Commands

| Command              | Description                              |
|----------------------|------------------------------------------|
| `npm run dev`        | Start API server (hot reload)            |
| `npm run tui`        | Start the Terminal User Interface        |
| `npm run start`      | Start API in production mode             |
| `npm run db:migrate` | Initialize / migrate SQLite database     |
| `npm run db:reset`   | Reset database (destructive)             |

### TUI Features (v1)

- Start / Stop the HTTP server
- Generate pairing QR code
- Create / reset admin user
- List paired devices
- Revoke a device
- View storage usage
- View recent uploads
- Basic configuration

---

## 2. Mobile App Setup (Expo)

```bash
cd mobile
cp .env.example .env
pnpm install
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

### Mobile `.env`

```env
# Usually left empty in development – the QR code supplies the server URL
EXPO_PUBLIC_DEFAULT_SERVER_URL=
```

### Mobile Commands

| Command                | Description                          |
|------------------------|--------------------------------------|
| `npx expo start`       | Start Metro bundler                  |
| `npx expo start --clear` | Clear cache and start              |
| `npx expo run:android` | Build & run on Android device/emulator |
| `npx expo run:ios`     | Build & run on iOS (Mac only)        |

---

## 3. Cloudflare Tunnel (Remote Access)

### Option A – Quick Tunnel (easiest for testing)

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
cloudflared tunnel --url http://localhost:3847
```

It will give you a public `https://xxxx.trycloudflare.com` URL. Use that when generating the QR in the TUI.

### Option B – Named Tunnel (recommended for permanent use)

1. Create a tunnel in Cloudflare Zero Trust dashboard.
2. Copy the tunnel token.
3. Put it in `server/.env` as `CLOUDFLARE_TUNNEL_TOKEN=...`
4. The server can start `cloudflared` automatically (see `server/src/services/tunnel.ts`).

---

## 4. First-Time Flow

1. Start the TUI: `cd server && npm run tui`
2. Create the admin user (if not already created via `.env`).
3. Start the server from the TUI.
4. Generate a pairing QR code.
5. On your phone: open the app → Scan QR → enter username + password.
6. Select folders / files you want to back up.
7. Enable auto-backup (works only on Wi-Fi).

---

## 5. Development Notes

- **Hash-based storage**: Files are stored as `SHA-256.hash` under date folders. Original name + metadata live in SQLite.
- **Deduplication**: Before upload the app asks the server if the hash already exists.
- **One-way backup**: Deleting media on the phone never deletes it on the server.
- **Wi-Fi only auto-backup**: The app checks network type before starting background scans.

---

## 6. Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Server    | Node.js, Fastify, better-sqlite3, JWT, bcrypt |
| TUI       | ink (React for CLI)                 |
| Mobile    | Expo (React Native), expo-router    |
| Uploads   | Chunked + resumable (custom + tus-ready) |
| Tunnel    | cloudflared                         |

---

## 7. Next Steps After Scaffolding

- Implement full tus protocol or improve chunked uploader
- Background fetch improvements (especially Android)
- Web UI for browsing media on the laptop
- Thumbnails generation
- Better device naming and management

---

## License

Private / personal use. Modify as you like.
