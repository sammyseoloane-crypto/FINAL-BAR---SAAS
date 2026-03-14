#!/bin/bash

#################################################
# Automated Database Backup Script
# For Multi-Tenant Nightclub Management System
#################################################

# Configuration
BACKUP_DIR="/opt/nightclub-backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d-%H%M%S)
S3_BUCKET="s3://nightclub-production-backups"

# Supabase credentials (load from environment or config file)
# IMPORTANT: Never commit credentials to git
# Set these in your environment or use AWS Secrets Manager
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-your-project-ref}"
SUPABASE_DB_PASSWORD="${SUPABASE_DB_PASSWORD}"
SUPABASE_DB_HOST="db.${SUPABASE_PROJECT_REF}.supabase.co"
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME="postgres"
SUPABASE_DB_USER="postgres"

# Email notifications
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@nightclub.app}"
SEND_EMAIL_NOTIFICATIONS=true

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# Determine backup type based on day
DAY_OF_WEEK=$(date +%u)  # 1-7 (Mon-Sun)
DAY_OF_MONTH=$(date +%d)

if [ "$DAY_OF_MONTH" = "01" ]; then
    BACKUP_TYPE="monthly"
    BACKUP_SUBDIR="$BACKUP_DIR/monthly"
elif [ "$DAY_OF_WEEK" = "7" ]; then
    BACKUP_TYPE="weekly"
    BACKUP_SUBDIR="$BACKUP_DIR/weekly"
else
    BACKUP_TYPE="daily"
    BACKUP_SUBDIR="$BACKUP_DIR/daily"
fi

BACKUP_FILE="$BACKUP_SUBDIR/nightclub-$BACKUP_TYPE-$DATE.sql"
BACKUP_FILE_COMPRESSED="$BACKUP_FILE.gz"

echo "=========================================="
echo "Starting $BACKUP_TYPE database backup"
echo "Date: $(date)"
echo "=========================================="

# Function to send email notification
send_notification() {
    local subject="$1"
    local body="$2"
    
    if [ "$SEND_EMAIL_NOTIFICATIONS" = true ]; then
        echo "$body" | mail -s "$subject" "$ADMIN_EMAIL"
    fi
}

# Function to log errors
log_error() {
    local error_msg="$1"
    echo "ERROR: $error_msg" >&2
    send_notification "Backup Failed: Nightclub Database" "$error_msg"
}

# Set PostgreSQL password for pg_dump
export PGPASSWORD="$SUPABASE_DB_PASSWORD"

# Create backup with pg_dump
echo "Creating database dump..."
if pg_dump \
    -h "$SUPABASE_DB_HOST" \
    -p "$SUPABASE_DB_PORT" \
    -U "$SUPABASE_DB_USER" \
    -d "$SUPABASE_DB_NAME" \
    --clean \
    --if-exists \
    --verbose \
    --no-owner \
    --no-acl \
    -f "$BACKUP_FILE" 2>&1; then
    
    echo "✓ Database dump created successfully"
    
    # Compress the backup
    echo "Compressing backup..."
    if gzip "$BACKUP_FILE"; then
        echo "✓ Backup compressed successfully"
        
        # Get file size
        BACKUP_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
        echo "Backup size: $BACKUP_SIZE"
        
        # Upload to S3 (if configured)
        if command -v aws &> /dev/null; then
            echo "Uploading to S3..."
            if aws s3 cp "$BACKUP_FILE_COMPRESSED" "$S3_BUCKET/$BACKUP_TYPE/" 2>&1; then
                echo "✓ Backup uploaded to S3"
            else
                log_error "Failed to upload backup to S3"
            fi
        fi
        
        # Verify backup integrity
        echo "Verifying backup integrity..."
        if gunzip -t "$BACKUP_FILE_COMPRESSED" 2>&1; then
            echo "✓ Backup integrity verified"
            
            # Clean up old backups
            echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
            find "$BACKUP_DIR/$BACKUP_TYPE" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
            echo "✓ Old backups cleaned up"
            
            # Success notification
            SUCCESS_MSG="Database backup completed successfully
            
Type: $BACKUP_TYPE
Date: $(date)
File: $(basename "$BACKUP_FILE_COMPRESSED")
Size: $BACKUP_SIZE
Location: $BACKUP_FILE_COMPRESSED
S3: $S3_BUCKET/$BACKUP_TYPE/$(basename "$BACKUP_FILE_COMPRESSED")

Retention: $RETENTION_DAYS days"
            
            echo "$SUCCESS_MSG"
            send_notification "Backup Successful: Nightclub Database" "$SUCCESS_MSG"
            
        else
            log_error "Backup integrity verification failed!"
            exit 1
        fi
        
    else
        log_error "Failed to compress backup file"
        exit 1
    fi
    
else
    log_error "Failed to create database dump"
    exit 1
fi

# Additional: Backup critical tables to separate files
echo "Creating table-specific backups for critical data..."

CRITICAL_TABLES=(
    "transactions"
    "table_reservations"
    "bottle_orders"
    "bar_tabs"
    "guest_list_entries"
    "promoter_commissions"
    "customer_vip_status"
    "products"
    "profiles"
)

for table in "${CRITICAL_TABLES[@]}"; do
    TABLE_BACKUP="$BACKUP_SUBDIR/table-$table-$DATE.sql.gz"
    
    if pg_dump \
        -h "$SUPABASE_DB_HOST" \
        -p "$SUPABASE_DB_PORT" \
        -U "$SUPABASE_DB_USER" \
        -d "$SUPABASE_DB_NAME" \
        --table="public.$table" \
        --data-only \
        --no-owner \
        --no-acl | gzip > "$TABLE_BACKUP" 2>&1; then
        
        echo "✓ Backed up table: $table"
    else
        echo "⚠ Warning: Failed to backup table: $table"
    fi
done

# Unset password variable for security
unset PGPASSWORD

echo "=========================================="
echo "Backup process completed"
echo "Total time: $SECONDS seconds"
echo "=========================================="

exit 0
