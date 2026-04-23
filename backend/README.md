# Food Pod Backend

Bun + Hono + better-sqlite3 backend for the Food Pod prototype.  
Binds `127.0.0.1:8787` (systemd) and is reverse-proxied by nginx on pear-sandbox.

---

## Local development

```bash
cd backend
bun install
bun run start
```

Optional env vars (defaults work for local dev):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | HTTP port |
| `HOST` | `127.0.0.1` | Bind address |
| `FOODPOD_DB_PATH` | `./data/foodpod.db` | SQLite database path |
| `FOODPOD_MEDIA_ROOT` | `/srv/foodpod/media` | Media file root |
| `GEMINI_API_KEY` | — | Gemini (E2) |
| `ELEVENLABS_API_KEY` | — | ElevenLabs (E2) |

Smoke test after `bun run start`:

```bash
curl http://localhost:8787/api/health
# → {"ok":true,"ts":...}

curl http://localhost:8787/api/pods/pod_demo_01
# → {"id":"pod_demo_01","status":"collecting","targetCount":7,"capturedCount":0,...}

curl -F image=@/etc/hostname http://localhost:8787/api/pods/pod_demo_01/images
# → {"imageId":"...","sequenceNumber":1,"capturedCount":1}
```

---

## Deploy to pear-sandbox (E3 does this — steps for reference)

### 1. Copy files to VM

```bash
gcloud compute scp --recurse backend/ pear-sandbox:/home/ubuntu/foodpod-backend \
  --zone us-central1-a --tunnel-through-iap \
  --impersonate-service-account <SA_EMAIL>
```

### 2. Install Bun on VM (first time only)

```bash
gcloud compute ssh pear-sandbox --zone us-central1-a --tunnel-through-iap -- \
  'curl -fsSL https://bun.sh/install | bash'
```

### 3. Install dependencies

```bash
gcloud compute ssh pear-sandbox --zone us-central1-a --tunnel-through-iap -- \
  'cd /home/ubuntu/foodpod-backend && bun install'
```

### 4. Write secrets

```bash
sudo mkdir -p /etc/foodpod
sudo tee /etc/foodpod/env > /dev/null << 'ENV'
GEMINI_API_KEY=<value>
ELEVENLABS_API_KEY=<value>
ENV
sudo chmod 0600 /etc/foodpod/env
```

### 5. systemd unit (`/etc/systemd/system/foodpod.service`)

```ini
[Unit]
Description=Food Pod Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/foodpod-backend
EnvironmentFile=/etc/foodpod/env
Environment=PORT=8787
Environment=HOST=127.0.0.1
Environment=FOODPOD_DB_PATH=/srv/foodpod/foodpod.db
Environment=FOODPOD_MEDIA_ROOT=/srv/foodpod/media
ExecStart=/home/ubuntu/.bun/bin/bun run src/server.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable foodpod
sudo systemctl start foodpod
sudo systemctl status foodpod
```

### 6. nginx location block (add inside `server {}` block)

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 20M;
}

location /media/ {
    alias /srv/foodpod/media/;
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/pods/:id` | Pod state + recent snaps + episode if ready |
| POST | `/api/pods/:id/images` | Upload meal image (multipart `image` field) |
| POST | `/api/pods/:id/complete` | Trigger generation pipeline (E2) |
| GET | `/api/pods/:id/episode` | Episode audio + metadata, 404 if not ready |

---

## Architecture notes

- **E1** (this file): scaffold, SQLite, all endpoints, seed data.
- **E2**: `src/pipeline.ts` — Gemini + ElevenLabs generation. Replace stub body only; keep signature.
- **E3**: VM deploy automation.

SQLite WAL mode enabled; single-process, no connection pool needed.
