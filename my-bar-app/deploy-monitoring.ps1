# Monitoring & Alerts - Deployment Script
# Run this script to deploy monitoring changes to Supabase Edge Functions

Write-Host "🔍 Monitoring & Alerts Deployment Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Supabase CLI is installed
Write-Host "Checking Supabase CLI..." -ForegroundColor Yellow
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseInstalled) {
    Write-Host "❌ Supabase CLI not installed" -ForegroundColor Red
    Write-Host "Install from: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Supabase CLI found" -ForegroundColor Green
Write-Host ""

# Check if logged in
Write-Host "Checking Supabase login..." -ForegroundColor Yellow
try {
    $loginCheck = supabase projects list 2>&1
    Write-Host "✅ Logged in to Supabase" -ForegroundColor Green
} catch {
    Write-Host "❌ Not logged in to Supabase" -ForegroundColor Red
    Write-Host "Run: supabase login" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Display environment variables checklist
Write-Host "📋 Environment Variables Checklist" -ForegroundColor Cyan
Write-Host "Before deploying, ensure these are set in Supabase Dashboard:" -ForegroundColor White
Write-Host "  Go to: Project Settings → Edge Functions → Environment Variables" -ForegroundColor Gray
Write-Host ""
Write-Host "  Required:" -ForegroundColor Yellow
Write-Host "    ✓ SENTRY_DSN" -ForegroundColor White
Write-Host "    ✓ ENVIRONMENT (production/staging/development)" -ForegroundColor White
Write-Host "    ✓ STRIPE_SECRET_KEY" -ForegroundColor White
Write-Host "    ✓ STRIPE_WEBHOOK_SECRET" -ForegroundColor White
Write-Host "    ✓ SUPABASE_URL" -ForegroundColor White
Write-Host "    ✓ SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Have you set all required environment variables? (y/n)"
if ($continue -ne 'y') {
    Write-Host "⏸️ Deployment cancelled. Set environment variables first." -ForegroundColor Yellow
    exit 0
}
Write-Host ""

# Deploy Edge Functions
Write-Host "🚀 Deploying Edge Functions with Monitoring..." -ForegroundColor Cyan
Write-Host ""

# Deploy stripe-webhook
Write-Host "Deploying stripe-webhook..." -ForegroundColor Yellow
try {
    supabase functions deploy stripe-webhook --no-verify-jwt
    Write-Host "✅ stripe-webhook deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to deploy stripe-webhook: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Deploy create-checkout-session
Write-Host "Deploying create-checkout-session..." -ForegroundColor Yellow
try {
    supabase functions deploy create-checkout-session --no-verify-jwt
    Write-Host "✅ create-checkout-session deployed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to deploy create-checkout-session: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Deploy request-data-deletion (if it exists)
if (Test-Path "supabase/functions/request-data-deletion/index.ts") {
    Write-Host "Deploying request-data-deletion..." -ForegroundColor Yellow
    try {
        supabase functions deploy request-data-deletion --no-verify-jwt
        Write-Host "✅ request-data-deletion deployed successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to deploy request-data-deletion: $_" -ForegroundColor Red
        Write-Host "Continuing anyway..." -ForegroundColor Yellow
    }
    Write-Host ""
}

# Display next steps
Write-Host "✨ Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. ✅ Test monitoring with:" -ForegroundColor White
Write-Host "     - Add MonitoringDashboard to your admin panel" -ForegroundColor Gray
Write-Host "     - Click 'Send Test Alert' buttons" -ForegroundColor Gray
Write-Host "     - Check Sentry dashboard for alerts" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. ✅ Configure Sentry Alert Rules:" -ForegroundColor White
Write-Host "     - Go to: https://sentry.io → Alerts → Create Alert" -ForegroundColor Gray
Write-Host "     - Set up email/Slack notifications" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. ✅ Enable Stripe Webhook Alerts:" -ForegroundColor White
Write-Host "     - Go to: Stripe Dashboard → Webhooks → Your endpoint" -ForegroundColor Gray
Write-Host "     - Enable 'Send me an email when this endpoint is failing'" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. ✅ Review Supabase Logs:" -ForegroundColor White
Write-Host "     - Go to: Supabase Dashboard → Logs → Edge Functions" -ForegroundColor Gray
Write-Host "     - Check for any deployment errors" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "  - Setup Guide: MONITORING_ALERTS_SETUP.md" -ForegroundColor Gray
Write-Host "  - Quick Reference: MONITORING_SUMMARY.md" -ForegroundColor Gray
Write-Host ""
Write-Host "🎉 Monitoring system is now active!" -ForegroundColor Green
