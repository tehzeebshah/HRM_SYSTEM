# AGENTS.md — HRMS working reference

Authoritative commands and conventions for anyone (human or agent) working on
this repo. Read this first.

## Stack
- **Monorepo**: pnpm workspaces + Turborepo. Node 20+.
- **API**: `apps/api` — Express + TypeScript + Prisma + Zod.
- **Web**: `apps/web` — React + Vite + Tailwind + TanStack Query.
- **Shared**: `packages/shared` — zod schemas, enums, DTOs (consumed by both apps).
- **DB**: PostgreSQL 16. **Cache/queue**: Redis 7. **Storage**: MinIO (S3).

## Day-1 commands (run from repo root)

```bash
pnpm install                 # install all workspace deps
pnpm --filter @hrms/shared build   # build the shared package (do this once first)
pnpm db:generate             # regenerate the Prisma client
pnpm --filter @hrms/api exec prisma migrate deploy   # apply migrations
pnpm db:seed                 # seed demo tenant + admin
pnpm dev                     # run api + web in watch (needs Docker data services up)
```

Data services (Postgres / Redis / MinIO / Mailhog):
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

## Quality gates — ALWAYS run before declaring a task done

```bash
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint        # ESLint across all packages (warnings OK, errors must be 0)
pnpm build       # api (tsc) + web (vite)
pnpm test        # vitest (unit/integration)
```

Exit code 0 for all four is the definition of "green". Do not commit if any fail.

## Module conventions

Backend modules live under `apps/api/src/modules/<name>/` with a fixed shape:
`<name>.service.ts` (business logic + Prisma) · `<name>.controller.ts`
(HTTP handlers, `asyncHandler` wrapped) · `<name>.routes.ts` (Router +
`validate()` + RBAC guards). Register each router in `src/app.ts`.

**Cross-cutting rules**:
- Every tenant-scoped query MUST filter by `tenantId` (from `req.tenantId` /
  `req.auth.tenantId`). Never trust client-supplied tenant ids.
- Mutating endpoints attach `audit(entity, action)` middleware.
- RBAC: `requireRoles(...)` / `requirePermissions(...)` / `requireAuth`.
- Validation: define the zod schema in `packages/shared/src/schemas/`, then
  `validate({ body: schema })` on the route. Types are inferred with `z.infer`.
- `req.params.id` and `req.tenantId` are `string | undefined` under
  `noUncheckedIndexedAccess` — assert with `!` inside authenticated handlers.

Frontend pages live under `apps/web/src/pages/`; add a typed client in
`src/lib/<thing>-api.ts`, wire the route + role guard in `src/router.tsx`, and
add a sidebar entry in `src/components/layout/AppShell.tsx` if user-facing.

## Shared package rebuild

`@hrms/shared` is consumed as built CJS by the API and as raw TS source by the
web (Vite compiles it inline — see its `exports` map). **After changing anything
in `packages/shared/src/`, rebuild before typechecking/building the API:**
```bash
pnpm --filter @hrms/shared build
```

## Prisma

- Schema: `apps/api/prisma/schema.prisma` (38 models).
- Generated client: `apps/api/prisma/generated` (gitignored; regenerated on build).
- Migrations: `apps/api/prisma/migrations`. Baseline is `0_init`.
- After a schema change: `pnpm --filter @hrms/api exec prisma migrate dev --name <desc>`
  (needs a running Postgres — use the dev compose), then `pnpm db:generate`.

## Deployment

See `docs/DEPLOYMENT.md` for the full Plesk runbook. CI: `.github/workflows/`
(`ci.yml` = test/build, `deploy.yml` = build images → GHCR → SSH deploy). All
containers bind to `127.0.0.1`; Plesk's nginx reverse-proxies public traffic.

## Do NOT
- Commit `.env`, `.env.prod`, or secrets.
- Use the Plesk admin password shared in chat — rotate it.
- Skip the quality gates. They are the contract.
