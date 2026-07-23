# Deploy HRMS to Plesk — Quick Path

The full runbook lives in [`DEPLOYMENT.md`](./DEPLOYMENT.md). This is the fast path.

## Status
- **App:** 100% built and tested (typecheck / lint / build / 33 tests all green).
- **Local demo:** runnable on your machine — `pnpm dev` with `VITE_DEMO_MODE=true` → http://localhost:5173.
- **Plesk deploy:** ready to fire. The **only** missing input is the server's **root** password (the Plesk control-panel password cannot deploy — verified).

## One-shot deploy (the moment you have root)

From this project root on a Windows machine that has the Posh-SSH module:

```powershell
.\infra\scripts\Deploy-HrmsToPlesk.ps1 `
  -ServerIp     88.99.136.37 `
  -RootPassword '<SERVER ROOT PASSWORD>' `
  -Domain       'hrms2.s4s.tehzieb.to.frosty-cerf.88-99-136-37.plesk.page'
```

The script does everything: packages the code, uploads it, installs Docker,
generates strong secrets, runs Postgres + Redis + MinIO + API + Web, applies
migrations, seeds the admin, wires the Plesk reverse proxy, requests Let's
Encrypt, and smoke-tests the result. Output ends with the live URL.

Default seeded login: **`admin@acme.demo` / `Admin123456`** — change it immediately.

## Where to get the root password
The server (`88.99.136.37`) is hosted at **Hetzner**. Log in to your Hetzner
account → select the server → **Reset root password** (or use the Rescue system).
That root password is different from the Plesk password and is what the deploy
script needs.

## After deploy
- Backups: add the nightly cron — `infra/scripts/backup-db.sh` (see DEPLOYMENT.md §8).
- Rotate the Plesk admin password shared in chat.
- Change the seeded admin password on first login.

## Why the Plesk login alone isn't enough
The Plesk control panel (`tehzieb.shah`) manages websites, not the server OS.
Installing Docker / running containers needs OS-level (`root`) access, which
Plesk intentionally keeps separate. This is standard Plesk security, not a
limitation of this project.
