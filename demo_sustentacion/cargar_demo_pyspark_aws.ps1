param(
    [string]$HostIp = "3.14.12.13",
    [switch]$Restaurar
)

$ErrorActionPreference = "Stop"
$DemoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$KeyPath = Join-Path $DemoDir "..\controller.pem"
$CsvFile = if ($Restaurar) {
    Join-Path $DemoDir "xAPI-Edu-Data_original.csv"
} else {
    Join-Path $DemoDir "xAPI-Edu-Data_actualizado_demo.csv"
}

Write-Host "Subiendo $(Split-Path -Leaf $CsvFile) a AWS EC2 (${HostIp}) y ejecutando ETL PySpark..." -ForegroundColor Cyan
$SshOpts = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new")
scp @SshOpts $CsvFile "ubuntu@${HostIp}:/tmp/demo_upload.csv"
ssh @SshOpts "ubuntu@${HostIp}" "cd ~/academico_aws && sudo docker compose --profile etl run --rm -T -v /tmp/demo_upload.csv:/workspace/xAPI-Edu-Data.csv:ro etl </dev/null && rm -f /tmp/demo_upload.csv"
Write-Host "¡Listo! PostgreSQL, la Web (CloudFront) y Power BI (al pulsar Actualizar) ya reflejan los nuevos datos." -ForegroundColor Green
