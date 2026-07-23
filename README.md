# HRMS — Human Resource Management System

A multi-tenant, modular HRMS built with Node.js/Express + React, PostgreSQL, Redis, and MinIO — containerized for deployment on a Plesk-managed VPS.

## Stack

| Layer | Technology |
|---|---|
| API | Node 20 · Express · TypeScript · Prisma · Zod · BullMQ |
| Web | React 18 · Vite · TypeScript · TailwindCSS · TanStack Query |
| Data | PostgreSQL 16 · Redis 7 · MinIO (S3-compatible) |
| Auth | JWT (access + rotating refresh) · bcrypt · TOTP MFA · RBAC |
| Ops | Docker Compose · GitHub Actions · Plesk |

## Repository layout

```
apps/
  api/          REST API (vertical-slice modules)
  web/          React SPA
packages/
  shared/       Zod schemas, enums, DTOs (shared api↔web)
  config/       Shared tsconfig presets
infra/
  docker/       Dockerfiles, compose files, nginx config
docs/           ADRs, ERD, deployment runbook
.github/        CI workflows
```

## Modules (v1 scope)

- ✅ **Auth** — login, JWT, rotating refresh cookies, TOTP MFA, invitations, password reset
- ✅ **System** — tenants, multi-tenancy, RBAC, audit log
- ⏳ Employees & Organization · Attendance & Leave · Payroll · Performance · Recruitment/ATS · Assets · Engagement · Reports

## Getting started (local)

### Prerequisites
- Node 20+, pnpm 9+
- Docker (for the data services)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Start data services (Postgres, Redis, MinIO, Mailhog)
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
MinIO console: http://127.0.0.1:9001 (login `hrms_minio` / `hrms_minio_dev_password`)
Mailhog UI: http://127.0.0.1:8025

### 3. Configure environment
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 4. Database
```bash
pnpm db:generate          # generate Prisma client
pnpm --filter @hrms/api exec prisma migrate dev --name init
pnpm db:seed              # demo tenant + admin user
```
Seeded admin: `admin@acme.demo` / `Admin123456`

### 5. Run the apps (parallel)
```bash
pnpm dev
```
- API: http://localhost:3000
- Web: http://localhost:5173 (proxies `/api` → API)

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run api + web in watch mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | ESLint across the monorepo |
| `pnpm typecheck` | TypeScript typecheck |
| `pnpm test` | Run unit tests |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate` | Create + apply a dev migration |
| `pnpm db:seed` | Seed baseline data |

## Deployment

See `docs/DEPLOYMENT.md` for the full Plesk deployment runbook (Docker-native, GitHub Actions → GHCR → SSH deploy).

Production containers bind to `127.0.0.1` only; Plesk's nginx reverse-proxies public traffic with Let's Encrypt TLS.

## Security notes

- Refresh tokens stored hashed; rotated on every use; revocable via Redis blacklist.
- TOTP MFA secret encrypted at rest (AES-256-GCM).
- All tenant-scoped data is filtered by `tenantId` — never trust client-supplied tenant.
- Account lockout after repeated failed logins; rate-limited auth endpoints.
