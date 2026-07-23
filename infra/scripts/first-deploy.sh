#!/usr/bin/env bash
# One-time server setup for the HRMS stack on the Plesk VPS.
# Run as the `deploy` user after cloning / copying the repo onto the box.
# Idempotent: safe to re-run.
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/hrms}"
COMPOSE_SRC="${COMPOSE_SRC:-./infra/docker/docker-compose.prod.yml}"
ENV_TEMPLATE="${ENV_TEMPLATE:-./infra/docker/.env.prod.template}"

echo "==> Preparing $INSTALL_DIR"
sudo mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/backups" "$INSTALL_DIR/scripts"
sudo chown -R "$USER:$USER" "$INSTALL_DIR"

# 1. Copy the prod compose file + ops scripts in place.
cp -f "$COMPOSE_SRC" "$INSTALL_DIR/docker-compose.prod.yml"
cp -f ./infra/scripts/*.sh "$INSTALL_DIR/scripts/"
chmod +x "$INSTALL_DIR/scripts/"*.sh

# 2. Drop a .env.prod from the template if one doesn't already exist.
if [[ ! -f "$INSTALL_DIR/.env.prod" ]]; then
  if [[ -f "$ENV_TEMPLATE" ]]; then
    cp "$ENV_TEMPLATE" "$INSTALL_DIR/.env.prod"
  else
    echo "!! No .env.prod and no template. Create $INSTALL_DIR/.env.prod manually (see docs/DEPLOYMENT.md)."
  fi
  echo "!! Edit $INSTALL_DIR/.env.prod and fill in real secrets before continuing."
  chmod 600 "$INSTALL_DIR/.env.prod"
fi

# 3. Log in to GHCR (needs GHCR_TOKEN in the environment).
if [[ -n "${GHCR_TOKEN:-}" && -n "${GHCR_OWNER:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_OWNER" --password-stdin
else
  echo "!! GHCR_TOKEN / GHCR_OWNER not set — run 'docker login ghcr.io' manually."
fi

echo ""
echo "==> Setup complete. Next steps:"
echo "  cd $INSTALL_DIR"
echo "  # review .env.prod"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.prod pull"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api node node_modules/.bin/prisma migrate deploy"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api node node_modules/.bin/prisma db seed"
echo "  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d"
echo ""
echo "Then add the Plesk nginx directives (docs/DEPLOYMENT.md §4) + issue Let's Encrypt."
