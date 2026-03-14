# PowerShell script to automate database backups
# Save as: scripts\backup-database.ps1

param(
    [string]$BackupDir = "D:\backups\bar-saas",
    [switch]$Compress,
    [switch]$UploadToCloud
)

$ErrorActionPreference = "Stop"

# Configuration
$Date = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "backup_$Date.dump"
$LogFile = Join-Path $BackupDir "backup_log.txt"

# Ensure backup directory exists
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

# Function to log messages
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

Write-Log "=== Starting Database Backup ==="

# Load environment variables from .env
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# Set database password
$env:PGPASSWORD = $env:SUPABASE_DB_PASSWORD

if (!$env:PGPASSWORD) {
    Write-Log "ERROR: SUPABASE_DB_PASSWORD not set in .env file"
    Write-Log "Please add: SUPABASE_DB_PASSWORD=your_password"
    exit 1
}

# Create backup
Write-Log "Creating backup: $BackupFile"

try {
    $pgDumpArgs = @(
        "-h", $env:SUPABASE_DB_HOST,
        "-p", "5432",
        "-U", "postgres",
        "-d", "postgres",
        "-F", "c",
        "-f", $BackupFile
    )
    
    & pg_dump $pgDumpArgs
    
    if ($LASTEXITCODE -eq 0) {
        $FileSize = (Get-Item $BackupFile).Length / 1MB
        Write-Log "[SUCCESS] Backup created successfully (Size: $([Math]::Round($FileSize, 2)) MB)"
    } else {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Log "[ERROR] Backup failed: $_"
    exit 1
}

# Compress backup if requested
if ($Compress) {
    Write-Log "Compressing backup..."
    try {
        Compress-Archive -Path $BackupFile -DestinationPath "$BackupFile.zip" -Force
        Remove-Item $BackupFile
        $BackupFile = "$BackupFile.zip"
        $CompressedSize = (Get-Item $BackupFile).Length / 1MB
        Write-Log "[SUCCESS] Backup compressed (Size: $([Math]::Round($CompressedSize, 2)) MB)"
    } catch {
        Write-Log "[ERROR] Compression failed: $_"
    }
}

# Upload to cloud if requested
if ($UploadToCloud) {
    Write-Log "Uploading to cloud storage..."
    
    # Check if AWS CLI is available
    $awsInstalled = Get-Command aws -ErrorAction SilentlyContinue
    
    if ($awsInstalled -and $env:AWS_S3_BUCKET) {
        try {
            $s3Path = "s3://$($env:AWS_S3_BUCKET)/backups/$(Split-Path $BackupFile -Leaf)"
            aws s3 cp $BackupFile $s3Path
            
            if ($LASTEXITCODE -eq 0) {
                Write-Log "[SUCCESS] Backup uploaded to AWS S3: $s3Path"
            } else {
                throw "AWS S3 upload failed"
            }
        } catch {
            Write-Log "[ERROR] Cloud upload failed: $_"
        }
    } elseif (Get-Command az -ErrorAction SilentlyContinue) {
        # Azure Blob Storage upload (if Azure CLI is installed)
        Write-Log "[INFO] AWS not configured. Skipping upload."
        Write-Log "  To enable: Install AWS CLI and set AWS_S3_BUCKET in .env"
    } else {
        Write-Log "[INFO] No cloud storage configured. Skipping upload."
    }
}

# Clean up old backups (keep last 30 days)
Write-Log "Cleaning up old backups..."
$OldBackups = Get-ChildItem $BackupDir -Filter "backup_*.dump*" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }

foreach ($OldBackup in $OldBackups) {
    try {
        Remove-Item $OldBackup.FullName -Force
        Write-Log "[SUCCESS] Deleted old backup: $($OldBackup.Name)"
    } catch {
        Write-Log "[ERROR] Failed to delete $($OldBackup.Name): $_"
    }
}

# Summary
Write-Log "=== Backup Complete ==="
Write-Log "Backup file: $BackupFile"
$BackupCount = (Get-ChildItem $BackupDir -Filter 'backup_*.dump*').Count
Write-Log "Total backups in directory: $BackupCount"

# Example: Send notification (uncomment to enable)
# Invoke-RestMethod -Uri "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" `
#     -Method Post `
#     -Body '{"text":"Database backup completed successfully"}' `
#     -ContentType 'application/json'

Write-Host "`n[SUCCESS] Backup completed successfully!" -ForegroundColor Green
exit 0
