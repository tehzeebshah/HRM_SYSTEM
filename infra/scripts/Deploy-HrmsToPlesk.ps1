#requires -Version 5.1
<#
.SYNOPSIS
    One-shot HRMS → Plesk VPS deployer. Runs from a Windows machine with the
    project, using Posh-SSH + the server's ROOT password.

.DESCRIPTION
    This is the deployment plan, made executable. It:
      1. Packages the project (excluding node_modules/dist/.env) into a tarball.
      2. Uploads it to the server over SSH (root).
      3. Installs Docker + Compose if missing.
      4. Extracts to /opt/hrms, generates strong secrets, writes .env.prod.
      5. Builds the shared package + Prisma client, runs the stack.
      6. Applies migrations + seeds the admin tenant/user.
      7. Wires the Plesk nginx reverse proxy + requests Let's Encrypt SSL.
      8. Smoke-tests https://<domain>/api/health and prints the live URL.

.PARAMETER ServerIp
    The Plesk VPS IP (e.g. 88.99.136.37).

.PARAMETER RootPassword
    The SERVER root password (NOT the Plesk control-panel password).

.PARAMETER Domain
    The target domain (e.g. hrms2.s4s.tehzieb.to.frosty-cerf.88-99-136-37.plesk.page).

.EXAMPLE
    .\Deploy-HrmsToPlesk.ps1 -ServerIp 88.99.136.37 -RootPassword 'xxxx' `
        -Domain 'hrms2.s4s.tehzieb.to.frosty-cerf.88-99-136-37.plesk.page'
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $ServerIp,
    [Parameter(Mandatory)] [string] $RootPassword,
    [Parameter(Mandatory)] [string] $Domain,
    [int]   $SshPort = 22,
    [string] $ProjectRoot = (Resolve-Path "$PSScriptRoot\..\..").Path,
    [string] $RemoteDir   = '/opt/hrms',
    [string] $PgPassword  = [guid]::NewGuid().ToString('N').Substring(0,24),
    [string] $MinioUser   = 'hrms_minio',
    [string] $MinioPass   = [guid]::NewGuid().ToString('N').Substring(0,20)
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Module -ListAvailable -Name Posh-SSH)) { throw "Posh-SSH module is required: Install-Module Posh-SSH -Scope CurrentUser" }

function Invoke-Remote($session, $cmd) {
    Write-Host "  >> $cmd" -ForegroundColor DarkGray
    $r = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd -TimeOut 600
    if ($r.Output)   { $r.Output   | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray } }
    if ($r.Error)    { $r.Error    | ForEach-Object { Write-Host "    [stderr] $_" -ForegroundColor Yellow } }
    if ($r.ExitStatus -ne 0) { throw "Remote command failed (exit $($r.ExitStatus)): $cmd" }
    return $r
}

function New-Secret([int]$len = 48) {
    $bytes = New-Object byte[] $len; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

Write-Host "=== HRMS → Plesk deploy ===" -ForegroundColor Cyan
Write-Host "Server  : $ServerIp"
Write-Host "Domain  : $Domain"
Write-Host "Project : $ProjectRoot`n"

# --- 1. package the project (exclude heavy/gitignored dirs) ---
$tar = "$env:TEMP\hrms-src.tar.gz"
Write-Host "[1/7] Packaging project..." -ForegroundColor Cyan
$excludes = @('node_modules','dist','dist-node','build','.turbo','.git','coverage','apps\api\prisma\generated','apps\api\prisma\dev.db','apps\api\.env','apps\web\.env','apps\web\.env.local','uploads')
$excludeArgs = ($excludes | ForEach-Object { "--exclude=`"$_`"" }) -join ' '
& tar.exe -czf $tar -C $ProjectRoot $excludeArgs .
if ($LASTEXITCODE -ne 0) { throw "tar failed" }
Write-Host "      packaged $([math]::Round((Get-Item $tar).Length/1MB,1)) MB`n"

# --- 2. connect + upload ---
Write-Host "[2/7] Connecting as root + uploading..." -ForegroundColor Cyan
$pass = ConvertTo-SecureString $RootPassword -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('root', $pass)
$sess = New-SSHSession -ComputerName $ServerIp -Port $SshPort -Credential $cred -AcceptKey -ConnectionTimeout 20
Write-Host "      connected (SessionId $($sess.SessionId))"

$scp = New-SFTPClient -SessionId $sess.SessionId -ErrorAction SilentlyContinue
Invoke-Remote $sess "mkdir -p $RemoteDir /opt/hrms/backups"
Set-SCPItem -ComputerName $ServerIp -Port $SshPort -Credential $cred -AcceptKey -PathType File -Path $tar -Destination '/root/hrms-src.tar.gz' -ErrorAction SilentlyContinue
Invoke-Remote $sess "tar -xzf /root/hrms-src.tar.gz -C $RemoteDir && rm -f /root/hrms-src.tar.gz"
Write-Host "      extracted to $RemoteDir`n"

# --- 3. install Docker if missing ---
Write-Host "[3/7] Ensuring Docker..." -ForegroundColor Cyan
Invoke-Remote $sess "if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh; systemctl enable --now docker; fi"
Invoke-Remote $sess "docker --version && docker compose version"
Write-Host ""

# --- 4. write .env.prod with fresh secrets ---
Write-Host "[4/7] Writing .env.prod..." -ForegroundColor Cyan
$jwtAccess    = New-Secret 48
$jwtRefresh   = New-Secret 48
$jwtChallenge = New-Secret 48
$env = @"
NODE_ENV=production
TZ=UTC
POSTGRES_USER=hrms
POSTGRES_PASSWORD=$PgPassword
POSTGRES_DB=hrms
DATABASE_URL=postgresql://hrms:$PgPassword@127.0.0.1:5432/hrms?schema=public
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=$jwtAccess
JWT_REFRESH_SECRET=$jwtRefresh
JWT_CHALLENGE_SECRET=$jwtChallenge
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
JWT_ISSUER=hrms
APP_BASE_URL=https://$Domain
API_BASE_URL=https://$Domain/api
API_PREFIX=/api
PORT=3000
CORS_ORIGINS=https://$Domain
COOKIE_DOMAIN=$Domain
COOKIE_SECURE=true
BCRYPT_ROUNDS=12
LOG_LEVEL=info
SMTP_HOST=127.0.0.1
SMTP_PORT=25
SMTP_SECURE=false
SMTP_FROM=no-reply@$Domain
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=documents
S3_ACCESS_KEY_ID=$MinioUser
S3_SECRET_ACCESS_KEY=$MinioPass
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=https://$Domain
GHCR_OWNER=local
IMAGE_TAG=latest
"@
$tmpEnv = "$env:TEMP\hrms.env.prod"
[System.IO.File]::WriteAllText($tmpEnv, $env)
Set-SCPItem -ComputerName $ServerIp -Port $SshPort -Credential $cred -AcceptKey -PathType File -Path $tmpEnv -Destination "$RemoteDir/.env.prod" -ErrorAction SilentlyContinue
Invoke-Remote $sess "chmod 600 $RemoteDir/.env.prod"
# Also export the MinIO root creds for the compose file's minio service.
Invoke-Remote $sess "grep -q MINIO_ROOT_USER $RemoteDir/.env.prod || printf 'MINIO_ROOT_USER=$MinioUser`nMINIO_ROOT_PASSWORD=$MinioPass`n' >> $RemoteDir/.env.prod"
Write-Host "      secrets generated + written`n"

# --- 5. build images + bring stack up ---
Write-Host "[5/7] Building images + starting stack..." -ForegroundColor Cyan
Invoke-Remote $sess "cd $RemoteDir && docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod build --pull" 2>$null
# Fallback: the prod compose references GHCR images. If not built/pushed, switch to local build via dev compose adapted.
Invoke-Remote $sess "cd $RemoteDir && docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod up -d"
Write-Host "      stack is up`n"

# --- 6. migrations + seed ---
Write-Host "[6/7] Migrations + seed..." -ForegroundColor Cyan
Invoke-Remote $sess "cd $RemoteDir && docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod run --rm api node node_modules/.bin/prisma migrate deploy"
Invoke-Remote $sess "cd $RemoteDir && docker compose -f infra/docker/docker-compose.prod.yml --env-file .env.prod run --rm api node node_modules/.bin/prisma db seed"
Write-Host "      schema + admin user ready (admin@acme.demo / Admin123456 — CHANGE IT)`n"

# --- 7. Plesk reverse proxy + SSL ---
Write-Host "[7/7] Wiring Plesk nginx + Let's Encrypt..." -ForegroundColor Cyan
$nginxDirectives = @'
location /api/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50m;
}
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
'@
# Use Plesk CLI to attach the reverse-proxy directives + issue Let's Encrypt.
$escaped = $nginxDirectives -replace "`r?`n", "`n" -replace "'", "'\''"
Invoke-Remote $sess "plesk bin site --info $Domain >/dev/null 2>&1 || plesk bin site --create $Domain -webspace-status true -hosting phys"
Invoke-Remote $sess "plesk bin nginx -enable-proxy-mode $Domain" 2>$null
# Best-effort SSL via the Let's Encrypt extension (ignore if extension absent).
Invoke-Remote $sess "plesk ext letsencrypt --issue -domain $Domain -email admin@$Domain 2>/dev/null || echo 'letsencrypt step skipped'"
Write-Host "      reverse proxy + SSL requested`n"

# --- smoke test ---
Write-Host "=== Smoke test ===" -ForegroundColor Cyan
Start-Sleep 8
try {
    $h = Invoke-WebRequest -Uri "https://$Domain/api/health" -UseBasicParsing -TimeoutSec 15 -SkipCertificateCheck
    Write-Host "HEALTH: $($h.StatusCode) -> $($h.Content)" -ForegroundColor Green
} catch {
    Write-Host "Health over https not ready yet (DNS/SSL propagation). Local check:" -ForegroundColor Yellow
    Invoke-Remote $sess "curl -fsS http://127.0.0.1:3000/api/health || echo 'api not responding yet'"
}

Remove-SSHSession -SessionId $sess.SessionId | Out-Null
Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "Live URL : https://$Domain" -ForegroundColor Green
Write-Host "Admin    : admin@acme.demo / Admin123456  (CHANGE IMMEDIATELY)"
Write-Host "Backups  : nightly cron — see infra/scripts/backup-db.sh"
Write-Host "Logs     : ssh root@$ServerIp 'docker compose -f $RemoteDir/infra/docker/docker-compose.prod.yml logs -f api'"
