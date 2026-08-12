# PILLAR Token Meter — VPS Connectivity Reference

## VPS Host Information

| Property | Value |
|----------|-------|
| Provider | Hostinger VPS #1354320 |
| IP Address | 72.60.104.187 |
| SSH Port | 2222 |
| SSH User | root |
| OS | Ubuntu (Docker Compose) |
| CPU / RAM | 8 vCPU / 31 GB (5.0 GB used, 26 GB available) |
| Disk | 387 GB total, 88 GB used, 299 GB free (23%) |
| FQDN | srv1354320.hstgr.cloud |
| Domain | bayanaihan.net |

## SSH Access

```
Host:     72.60.104.187
Port:     2222
User:     root
Auth:     password
```

**Password:** Stored in `C:\Users\Emil V. Capino\.qoderwork\vps-orchestrator-config.json` under `ssh.password`

**Helper script:** `C:\Users\Emil V. Capino\.qoderwork\workspace\mqyprqle0th9k4nr\vps_exec.py`
- Usage: `python vps_exec.py run "<command>"`
- Uses paramiko for SSH execution

**Direct SSH:** `ssh root@72.60.104.187 -p 2222`

## Hostinger API

| Property | Value |
|----------|-------|
| Endpoint | https://developers.hostinger.com/api/vps/v1 |
| Auth | Bearer token |
| API Token | Stored in `vps-orchestrator-config.json` under `hostinger.api_token` |
| VM ID | 1354320 |

Useful endpoints:
- `GET /virtual-machines` — list VMs, state, IPv4
- `POST /virtual-machines/1354320/start` — start VM
- `GET /virtual-machines/1354320/docker` — Docker Manager status

## PILLAR Deployment Paths

| Path | Purpose |
|------|---------|
| `/opt/pillar-pilot/` | pillar-pilot source code and Dockerfile |
| `/opt/pillar-pilot/docker-compose.vps.yml` | Active compose file for pillar-pilot |
| `/opt/pillar-pilot/.env.vps` | Environment variables (contains secrets) |
| `/opt/pillar-pilot/Dockerfile` | Multi-stage Node.js 20 Alpine build |

## Docker Networks

| Network Name | Type | Purpose | Token Meter Use |
|-------------|------|---------|-----------------|
| `esangguni_esangguni-network` | bridge (external) | Shared network connecting pillar-pilot, lightrag-service, pillar-hub, and others | **JOIN** — token-meter must join this network so pillar-pilot can reach it |
| `pillar-pilot_pillar-network` | bridge | Isolated network for pillar-pilot | Not needed |

## Docker Volumes

| Volume Name | Mounted By | Purpose |
|------------|-----------|---------|
| `pillar-data` | pillar-pilot | SQLite DB at `/data/pillar-pilot.db` |
| `pillar-pilot_pillar-data` | pillar-pilot (compose) | Same, compose-prefixed variant |
| **`pillar-token-data`** | token-meter (NEW) | SQLite DB at `/data/token-meter.db` — **needs to be created** |

## Port Allocation

| Port | Container | Status | Protocol |
|------|-----------|--------|----------|
| 3000 | esangguni-pitogo | In use | HTTP |
| 3030 | tugon-app | In use | HTTP |
| 3031 | crmis | In use | HTTP |
| 3033 | subok-web | In use | HTTP |
| 3034 | pillar-spoke-pitogo | In use | HTTP |
| 3080 | esangguni-landing | In use | HTTP |
| 3081 | esangguni-app | In use | HTTP |
| 3082 | pillar-pilot | In use | HTTP (nginx proxy from pillar.bayanaihan.net) |
| 3083 | pillar-hub | In use | HTTP |
| **3084** | **token-meter** | **AVAILABLE** | **HTTP (internal only, 127.0.0.1 bind)** |
| 3100 | leap100-chatbot | In use | HTTP |
| 3101 | 360growth-landing | In use | HTTP |

**Token meter port: 3084** — bound to `127.0.0.1:3084:3084` (not exposed to internet). No nginx configuration needed — pillar-pilot reaches it via Docker network hostname `token-meter:3084`.

## Nginx Configuration

The token-meter does NOT need nginx. It is an internal service only. pillar-pilot connects to it directly over the shared Docker network.

Current pillar nginx config is at `/etc/nginx/sites-available/pillar` and proxies all pillar subdomains (pillar, ella, obra, yala) to `127.0.0.1:3082`. The admin token dashboard at `/admin/tokens` is served by pillar-pilot itself, which proxies API calls internally to the token-meter.

SSL certificates are managed by Let's Encrypt / Certbot at `/etc/letsencrypt/live/pillar.bayanaihan.net/`.

## Environment Variable Addition

Add to `/opt/pillar-pilot/.env.vps` before rebuilding pillar-pilot:

```
TOKEN_METER_URL=http://token-meter:3084
```

This tells pillar-pilot's `recordTokenUsage()` utility where to fire-and-forget token events.

## Deployment Sequence

### Phase 1: Deploy token-meter (zero downtime to pillar-pilot)

```bash
# 1. SSH into VPS
ssh root@72.60.104.187 -p 2222

# 2. Create token-meter source directory
mkdir -p /opt/token-meter/src

# 3. Upload source files (from local Windows via SCP)
#    Files to upload: Dockerfile, package.json, src/server.js, src/db.js, src/routes/*.js

# 4. Add token-meter to docker-compose.vps.yml
#    (Append service definition to /opt/pillar-pilot/docker-compose.vps.yml)

# 5. Build and start ONLY the token-meter service
cd /opt/pillar-pilot
docker compose -f docker-compose.vps.yml up -d --build token-meter

# 6. Verify health
curl http://127.0.0.1:3084/health
```

### Phase 2: Deploy pillar-pilot changes (brief restart)

```bash
# 7. Upload modified source files to /opt/pillar-pilot/
#    Modified: src/lib/ai/llm.ts, src/lib/ai/token-meter.ts (new),
#    src/app/api/chat/route.ts, src/app/api/obra/*.ts,
#    src/app/admin/tokens/page.tsx (new), src/app/api/admin/tokens/ (new)

# 8. Add TOKEN_METER_URL to .env.vps
echo "TOKEN_METER_URL=http://token-meter:3084" >> .env.vps

# 9. Rebuild pillar-pilot (~2-3 minutes downtime)
docker compose -f docker-compose.vps.yml up -d --build pillar

# 10. Verify
curl http://127.0.0.1:3082/api/health
curl http://127.0.0.1:3084/api/stats
```

### Rollback

```bash
# Remove TOKEN_METER_URL from .env.vps
# Revert source files, rebuild pillar-pilot
# token-meter can remain running — it is harmless if pillar-pilot doesn't call it
```

## Resource Budget for token-meter

| Resource | Limit | Expected Usage |
|----------|-------|----------------|
| CPU | 0.25 core | ~0.01 core idle |
| RAM | 256 MB | ~40-60 MB idle |
| PIDs | 50 | ~10 processes |
| Disk | Dynamic | ~100 KB/month at current volume |

## File Upload Method (Windows → VPS)

No rsync on Windows. Use one of these patterns:

1. **Tar + SSH cat** (preferred for directories):
   ```bash
   tar czf - token-meter/ | ssh root@72.60.104.187 -p 2222 "cat > /root/token-meter.tar.gz"
   ssh root@72.60.104.187 -p 2222 "mkdir -p /opt/token-meter && tar xzf /root/token-meter.tar.gz -C /opt/token-meter --strip-components=1"
   ```

2. **SCP individual files**:
   ```bash
   scp -P 2222 <local-file> root@72.60.104.187:/opt/token-meter/src/
   ```

3. **Python paramiko** (via vps_exec.py helper):
   ```bash
   python vps_exec.py run "cat > /opt/token-meter/src/server.js" < server.js
   ```

## Current Running Containers (24 total)

pillar-pilot, lightrag-service, lightrag-admin, lightrag-pitogo, lightrag-province, pillar-hub, pillar-hub-postgres, pillar-spoke-pitogo, esangguni-app, esangguni-landing, esangguni-pitogo, crmis, crmis-postgres, postgres-lightrag, postgres-lightrag-pitogo, postgres-esangguni-pitogo, postgres-pillar-pitogo, tugon-app, tugon-db, subok-web, leap100-chatbot, become-postgres, 360growth-landing, vps-controller
