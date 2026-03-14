# ============================================================
# POPULATE SAMPLE DASHBOARD DATA - Helper Script
# ============================================================
# This script will:
# 1. Prompt for your tenant ID
# 2. Create a customized SQL file with your tenant ID
# 3. Run the SQL to populate sample data
# ============================================================

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Sample Dashboard Data Loader" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is available
$supabaseAvailable = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseAvailable) {
    Write-Host "ERROR: Supabase CLI not found!" -ForegroundColor Red
    Write-Host "Please install it first: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Getting your tenant ID..." -ForegroundColor Green
Write-Host ""
Write-Host "Running query to fetch tenant IDs..." -ForegroundColor Gray

# Run the GET_TENANT_ID query
$getTenantQuery = @"
SELECT 
  id as tenant_id,
  name as tenant_name,
  created_at
FROM tenants
ORDER BY created_at DESC
LIMIT 5;
"@

Write-Host ""
Write-Host "Available tenants:" -ForegroundColor Yellow
supabase db query $getTenantQuery

Write-Host ""
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Prompt for tenant ID
Write-Host "Please enter your Tenant ID (UUID format):" -ForegroundColor Green
Write-Host "Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890" -ForegroundColor Gray
$tenantId = Read-Host "Tenant ID"

# Validate UUID format
$uuidPattern = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
if ($tenantId -notmatch $uuidPattern) {
    Write-Host ""
    Write-Host "ERROR: Invalid UUID format!" -ForegroundColor Red
    Write-Host "Please provide a valid UUID like: a1b2c3d4-e5f6-7890-abcd-ef1234567890" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Creating customized SQL file..." -ForegroundColor Green

# Read the template file
$templatePath = ".\supabase\SAMPLE_DASHBOARD_DATA.sql"
$outputPath = ".\supabase\SAMPLE_DASHBOARD_DATA_READY.sql"

if (-not (Test-Path $templatePath)) {
    Write-Host "ERROR: Template file not found at $templatePath" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $templatePath -Raw

# Replace all placeholders
$sqlContent = $sqlContent -replace 'YOUR-TENANT-ID-HERE', $tenantId

# Save the customized file
$sqlContent | Out-File -FilePath $outputPath -Encoding UTF8

Write-Host "✓ Created customized file: $outputPath" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Running SQL to insert sample data..." -ForegroundColor Green
Write-Host ""

# Run the SQL file
supabase db query --file $outputPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   ✓ Sample data loaded successfully!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now visit your Club Dashboard to see the data!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The customized SQL file has been saved to:" -ForegroundColor Gray
    Write-Host "  $outputPath" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "ERROR: Failed to run SQL (exit code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host ""
    Write-Host "You can manually run the SQL file:" -ForegroundColor Yellow
    Write-Host "  supabase db query --file $outputPath" -ForegroundColor Gray
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
