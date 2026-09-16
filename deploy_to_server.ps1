# ==============================================================================
# PowerShell Deploy Script: TradingTools to trd.ssotansum.com
# ==============================================================================

param (
    [string]$Server = "trd.ssotansum.com",
    [string]$User = "root",
    [string]$RemotePath = "/var/www/trd.ssotansum.com"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [*] Deploying TradingTools Workstation to $Server" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Test SSH Connection
Write-Host "[1/3] Uploading files via SCP..." -ForegroundColor Yellow
scp -r * "${User}@${Server}:${RemotePath}/"

# 2. Remote Command Execution
Write-Host "[2/3] Restarting backend service & reloading Nginx..." -ForegroundColor Yellow
ssh "${User}@${Server}" "cp ${RemotePath}/tradingtools.service /etc/systemd/system/ && systemctl daemon-reload && systemctl restart tradingtools && systemctl reload nginx"

# 3. Health Check
Write-Host "[3/3] Checking service status..." -ForegroundColor Green
try {
    $resp = Invoke-RestMethod -Uri "https://${Server}/api/health" -TimeoutSec 5
    Write-Host "Service Health: $($resp.status) on $($resp.domain)" -ForegroundColor Green
} catch {
    Write-Host "Note: Verify SSL or access directly at https://${Server}" -ForegroundColor Yellow
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " 🎉 Deployment finished! Visit: https://${Server}" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
