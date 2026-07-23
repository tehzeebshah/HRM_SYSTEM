# HRMS — Deployment Runbook (Plesk VPS, Docker-native)

This document covers the full operational procedure for deploying the HRMS stack
to the Plesk-managed VPS, as agreed in the architecture plan.

> **Stack on the host**: Plesk Obsidian owns ports `80/443/8443`. The HRMS app
> runs entirely in Docker containers bound to `127.0.0.1`. Plesk's nginx
> reverse-proxies public traffic. SSL is terminated by Let's Encrypt via Plesk.

---

## 0. Security (do this FIRST)

1. **Rotate the Plesk admin password** that was shared in chat — it is now
   considered compromised. Use a password manager; never store it in code.
2. Create a dedicated deploy user on the VPS (do not use the Plesk admin for CI):
   ```bash
   adduser deploy
   usermod -aG docker deploy
   mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
   # paste the public half of the GitHub Actions SSH key:
   nano /home/deploy/.ssh/authorized_keys
   chmod 600 /home/deploy/.ssh/authorized_keys
   chown -R deploy:deploy /home/deploy/.ssh
   ```
3. Harden SSH (`/etc/ssh/sshd_config`):
   ```
   PermitRootLogin no
   PasswordAuthentication no
   ```
   Then `systemctl restart sshd`.
4. Configure the **Plesk Firewall**: allow `22` (restrict to your office IP if
   possible), `80`, `443`, `8443` (Plesk admin — restrict by IP). **Deny**
   `3000/5432/6379/8080/9000/9001` from the public internet.
5. Confirm **fail2ban** is enabled (Plesk → Tools & Settings → IP Address Banning).

---

## 1. One-time Plesk setup

1. **Extensions** (Tools & Settings → Updates and Extensions): ensure **Docker**
   and **Let's Encrypt** are installed.
2. **Subscription / Domain**: the staging target is
   `hrms2.s4s.tehzeeb.to.frosty-cerf.88-99-136-37.plesk.page`.
   - SSL/TLS → Let's Encrypt: issue a certificate for the apex **and** `www`.
   - Hosting & DNS → enable "redirect www → apex" so the not-secured `www`
     variant is harmless.
3. Add the reverse-proxy directives (see **§4** below) under
   **Apache & nginx Settings → Additional nginx directives** for the domain.

---

## 2. Network topology

| Service      | Container port | Host bind            | Public? |
|--------------|----------------|----------------------|---------|
| web (nginx)  | 8080           | `127.0.0.1:8080`     | via Plesk `/` |
| api (Express)| 3000           | `127.0.0.1:3000`     | via Plesk `/api` |
| postgres     | 5432           | `127.0.0.1:5432`     | no      |
| redis        | 6379           | `127.0.0.1:6379`     | no      |
| minio API    | 9000           | `127.0.0.1:9000`     | via `files.` subdomain (later) |
| minio console| 9001           | `127.0.0.1:9001`     | no      |

Single-domain routing keeps cookies/CORS/SSL trivial:
```
https://<domain>/          → 127.0.0.1:8080  (SPA)
https://<domain>/api/      → 127.0.0.1:3000  (API)
```

---

## 3. Server-side layout

The stack lives under `/opt/hrms`:

```
/opt/hrms/
├── docker-compose.prod.yml   # copied from infra/docker/
├── .env.prod                 # secrets (chmod 600, owned by deploy)
└── backups/                  # nightly pg_dump target
```

The images are pulled from GHCR (`ghcr.io/<owner>/hrms-api:<tag>` and
`hrms-web:<tag>`) — **never built on the server** (keeps the VPS light).

---

## 4. Plesk nginx directives

Websites & Domains → `<domain>` → Apache & nginx Settings →
**Additional nginx directives**:

```nginx
# API
location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
    client_max_body_size 50m;
}

# SPA frontend
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Keep **"Proxy mode" = On**. The web container's nginx serves the SPA with a
`try_files $uri /index.html` fallback so client-side routes resolve.

---

## 5. CI/CD pipeline (GitHub Actions → GHCR → SSH deploy)

`.github/workflows/deploy.yml` (committed in the repo):

1. On push to `main`: lint + typecheck + test + build.
2. Build `hrms-api` and `hrms-web` images, tag with `${{ github.sha }}` and
   `latest`, push to GHCR.
3. SSH into the VPS as `deploy`, then:
   ```
   cd /opt/hrms
   docker compose -f docker-compose.prod.yml --env-file .env.prod pull
   docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api pnpm prisma migrate deploy
   docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
   ```
4. Health gate: `curl -fsS https://<domain>/api/health` must return 200.

**GitHub secrets** (repo → Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `PLESK_HOST` | `88.99.136.37` |
| `PLESK_SSH_USER` | `deploy` |
| `PLESK_SSH_KEY` | private key matching `/home/deploy/.ssh/authorized_keys` |
| `GHCR_OWNER` | your GitHub user/org |
| `GHCR_TOKEN` | PAT with `write:packages` |
| `DEPLOY_DOMAIN` | staging or prod domain (for the health gate) |
| Runtime env | `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_CHALLENGE_SECRET`, `SMTP_*`, `S3_*`, `MINIO_*`, etc. |

`.env.prod` itself is generated on the server (from the template below) and
**never** committed or shipped by CI.

---

## 6. `.env.prod` template (on the server, `/opt/hrms/.env.prod`)

```env
NODE_ENV=production
TZ=UTC

POSTGRES_USER=hrms
POSTGRES_PASSWORD=<strong-random>
POSTGRES_DB=hrms
DATABASE_URL=postgresql://hrms:<strong-random>@127.0.0.1:5432/hrms?schema=public

REDIS_URL=redis://127.0.0.1:6379

JWT_ACCESS_SECRET=<openssl rand -base64 64>
JWT_REFRESH_SECRET=<openssl rand -base64 64>
JWT_CHALLENGE_SECRET=<openssl rand -base64 64>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
JWT_ISSUER=hrms

APP_BASE_URL=https://<domain>
API_BASE_URL=https://<domain>/api
API_PREFIX=/api
PORT=3000

CORS_ORIGINS=https://<domain>
COOKIE_DOMAIN=<domain>
COOKIE_SECURE=true

BCRYPT_ROUNDS=12
LOG_LEVEL=info

SMTP_HOST=<your smtp host>
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=<user>
SMTP_PASS=<pass>
SMTP_FROM=no-reply@<domain>

S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=documents
S3_ACCESS_KEY_ID=<minio root user>
S3_SECRET_ACCESS_KEY=<minio root password>
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=https://files.<domain>

GHCR_OWNER=<github owner or org>
IMAGE_TAG=latest
```

Generate strong secrets with: `openssl rand -base64 64`

---

## 7. First deployment (step by step)

```bash
# On the VPS, as deploy:
sudo mkdir -p /opt/hrms /opt/hrms/backups
sudo chown -R deploy:deploy /opt/hrms
cd /opt/hrms

# 1. Drop the prod compose file + nginx config (copy from the repo's infra/docker/)
#    docker-compose.prod.yml is the one in infra/docker/docker-compose.prod.yml

# 2. Create .env.prod from §6 and lock it down
chmod 600 .env.prod

# 3. Pull images + run migrations + start
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api \
  node node_modules/.bin/prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api \
  node node_modules/.bin/prisma db seed
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 4. Smoke test
curl -fsS http://127.0.0.1:3000/api/health
```

Then in Plesk: add the nginx directives (§4), issue Let's Encrypt, and visit
`https://<domain>`. Log in with the seeded admin (`admin@acme.demo` /
`Admin123456`) — **change this password immediately**.

---

## 8. Backups

Nightly DB dump (host cron as `deploy`):
```
0 2 * * * docker exec hrms-prod-postgres-1 pg_dump -U hrms hrms | gzip > /opt/hrms/backups/db-$(date +\%F).sql.gz && find /opt/hrms/backups -name 'db-*.sql.gz' -mtime +14 -delete
```
Schedule a **Plesk Backup Manager** weekly subscription backup that captures
`/opt/hrms/volumes/` and `/opt/hrms/backups/` to off-box storage.
Retention: 7 daily dumps + 4 weekly snapshots. Run a **restore drill** before
go-live.

---

## 9. Operations

- **Logs**: `docker compose -f docker-compose.prod.yml logs -f --tail=200 api`
- **Health**: `/api/health` reports DB/Redis status; point UptimeRobot at it.
- **Errors**: Sentry DSN per environment (add `SENTRY_DSN` to `.env.prod`).
- **Rollback**:
  ```bash
  cd /opt/hrms
  # edit .env.prod: IMAGE_TAG=<previous-sha>  (or pass IMAGE_TAG=<sha> inline)
  docker compose -f docker-compose.prod.yml --env-file .env.prod pull
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
  ```
  App rollback is image-level only; DB rollback requires a backup restore
  (migrations are forward-only).

---

## 10. Staging vs production

| | Staging | Production |
|---|---|---|
| Domain | `hrms2…plesk.page` | custom domain |
| Compose project | `hrms-staging` | `hrms-prod` |
| Ports | `127.0.0.1:3001/8081/9002` | `127.0.0.1:3000/8080/9000` |
| DB volume | `pgdata-staging` | `pgdata` |
| Deploy trigger | `staging` branch | `main` branch |
| Image tag | `:staging` | `:latest` + `:sha` |

Both run side-by-side on the same VPS (resource limits prevent contention).

---

## Pre-go-live checklist

- [ ] Plesk admin password rotated
- [ ] `deploy` SSH user, key-only, root disabled
- [ ] Firewall blocks 3000/5432/6379/8080/9000/9001
- [ ] All container ports bound to `127.0.0.1`
- [ ] JWT secrets ≥ 64 chars, refresh tokens rotated + revocable
- [ ] PII fields flagged for app-layer encryption
- [ ] helmet + strict CORS + HSTS via Plesk nginx
- [ ] fail2ban on
- [ ] Off-box backups verified with a restore drill
- [ ] Seeded admin password changed
