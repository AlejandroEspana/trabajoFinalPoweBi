param(
    [Parameter(Mandatory = $true)]
    [string]$HostIp,

    [string]$User = "ubuntu",
    [string]$KeyPath = "..\controller.pem",
    [string]$DbPassword = $(if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { Read-Host "Contraseña para PostgreSQL en AWS" }),
    [int]$HttpPort = 80
)

$ErrorActionPreference = "Stop"
$PlatformDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResolvedKey = (Resolve-Path (Join-Path $PlatformDir $KeyPath) -ErrorAction Stop).Path
$ArchivePath = Join-Path $env:TEMP "aws_platform_deploy.tar.gz"

# Asegurar permisos estrictos en Windows para OpenSSH (.pem)
Write-Host "0/4 Verificando permisos de la llave SSH..." -ForegroundColor Cyan
icacls $ResolvedKey /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null

Write-Host "1/4 Empaquetando aws_platform (sin node_modules ni llaves privadas)..." -ForegroundColor Cyan
if (Test-Path $ArchivePath) { Remove-Item $ArchivePath -Force }
Push-Location $PlatformDir
try {
    tar --exclude="frontend/node_modules" --exclude="frontend/dist" --exclude="backend/**/__pycache__" --exclude=".env" --exclude="*.pem" -czf $ArchivePath .
} finally {
    Pop-Location
}

Write-Host "2/4 Subiendo paquete a ${User}@${HostIp}..." -ForegroundColor Cyan
$SshOpts = @("-i", $ResolvedKey, "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15")
scp @SshOpts $ArchivePath "${User}@${HostIp}:/tmp/aws_platform_deploy.tar.gz"

Write-Host "3/4 Configurando Docker, Swap, ETL PySpark y servicios en EC2..." -ForegroundColor Cyan
$RemoteScript = @'
set -euo pipefail

DB_PASSWORD="$1"
HTTP_PORT="$2"

# 1. Crear swap de 2GB si la instancia tiene poca RAM y no tiene swap
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
SWAP_COUNT=$(swapon --show | wc -l)
if [ "$TOTAL_MEM" -lt 2500 ] && [ "$SWAP_COUNT" -eq 0 ]; then
  echo ">>> Creando archivo swap de 2GB para estabilidad de Docker/PySpark..."
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# 2. Instalar Docker y Docker Compose v2 si no existen
if ! command -v docker >/dev/null 2>&1; then
  echo ">>> Instalando Docker y Docker Compose v2 en Ubuntu..."
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-v2 curl
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER" || true
fi

# 3. Desempaquetar proyecto
mkdir -p ~/academico_aws
rm -rf ~/academico_aws/*
tar -xzf /tmp/aws_platform_deploy.tar.gz -C ~/academico_aws
rm -f /tmp/aws_platform_deploy.tar.gz
cd ~/academico_aws

# 4. Escribir .env
cat > .env <<EOF
POSTGRES_DB=momento3_powerbi
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${DB_PASSWORD}
HTTP_PORT=${HTTP_PORT}
POSTGRES_EXPOSE_PORT=5432
EOF

# 5. Levantar PostgreSQL y ejecutar ETL PySpark + Vistas SQL
echo ">>> Iniciando PostgreSQL..."
sudo docker compose up -d postgres

echo ">>> Construyendo y ejecutando ETL PySpark (Fase 1) + Vistas SQL (Fase 2)..."
sudo docker compose --profile etl build etl
sudo docker compose --profile etl run --rm -T etl </dev/null

# 6. Construir y levantar Backend FastAPI + Frontend Nginx
echo ">>> Construyendo y levantando Backend + Frontend..."
sudo docker compose up -d --build backend frontend

# 7. Verificación de salud
echo ">>> Verificando salud de la API..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${HTTP_PORT}/api/v1/health"; then
    echo ""
    echo ">>> DESPLIEGUE EXITOSO"
    exit 0
  fi
  sleep 2
done
echo "ERROR: La API no respondió a tiempo." >&2
sudo docker compose logs --tail=50 backend frontend
exit 1
'@

$RemoteScriptUnix = $RemoteScript -replace "`r`n", "`n"
$RemoteScriptUnix | ssh @SshOpts "${User}@${HostIp}" "bash -s -- '$DbPassword' '$HttpPort'"
if ($LASTEXITCODE -ne 0) {
    throw "El despliegue remoto falló con código de salida $LASTEXITCODE"
}

Remove-Item $ArchivePath -Force -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "4/4 ¡Despliegue completado!" -ForegroundColor Green
Write-Host "    Frontend Web : http://${HostIp}/" -ForegroundColor Green
Write-Host "    Swagger API  : http://${HostIp}/api/docs" -ForegroundColor Green
