# Netlify Deployment Setup

## Fixed Issues
✅ Content Security Policy updated to allow Google Fonts

## Required: Set Environment Variables in Netlify

Your app needs Supabase environment variables to work. Set these in Netlify:

### Step 1: Go to Netlify Environment Variables
1. Log in to https://app.netlify.com
2. Select your site
3. Go to **Site settings** → **Environment variables**

### Step 2: Add These Variables

Add the following environment variables (copy from your `.env` file):

```
VITE_SUPABASE_URL=https://pgzlpwnumdoulxqssxsb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnemxwd251bWRvdWx4cXNzeHNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDI4MTcsImV4cCI6MjA4NzUxODgxN30.toZE8ApaAJ6QqHrOvNwR2paYL2p-E6X3OppQjWyqbNk

VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51T6WUl45ttokNjrVFKmY04bTOJOrTbYlAH1ZUg3O5hdfGrTAKtBhdcLtKyUnohyq8y3iqeiAjbJN5izh6g5dwke200LAh1DsyS

VITE_SENTRY_DSN=https://7122a4f30d8337a87b18307da7c02bb8@o4511037882040321.ingest.us.sentry.io/4511037886562304
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_RELEASE=v1.0.0

VITE_STRIPE_PRICE_ENTRANCE_FEE=price_1T6WoF45ttokNjrVwokwerS8
VITE_STRIPE_PRICE_SAVANAH=price_1T6Wcg45ttokNjrVhPKoV6ZT
VITE_STRIPE_PRICE_DON_JULIO=price_1T6WbZ45ttokNjrVLO5nGbBF
VITE_STRIPE_PRICE_HENESSEY=price_1T6WaB45ttokNjrVyTwTGkh2
VITE_STRIPE_PRICE_CORONA=price_1T6WaB45ttokNjrVyTwTGkh2

VITE_STRIPE_PRICE_STARTER_VENUE_PLAN_MONTHLY=price_1TAbjC45ttokNjrV8dLIYcoc
VITE_STRIPE_PRICE_STARTER_VENUE_PLAN_YEARLY=price_1TAboj45ttokNjrVXTivqPix

VITE_STRIPE_PRICE_GROWTH_VENUE_PLAN_MONTHLY=price_1TAbmK45ttokNjrVtT0u2Gns
VITE_STRIPE_PRICE_GROWTH_VENUE_PLAN_YEARLY=price_1TAbpL45ttokNjrVFhSVccur

VITE_STRIPE_PRICE_PRO_VENUE_PLAN_MONTHLY=price_1TAbnB45ttokNjrVrPnISvZo
VITE_STRIPE_PRICE_PRO_VENUE_PLAN_YEARLY=price_1TAbq045ttokNjrVVfS81Ja9

VITE_STRIPE_PRICE_ENTERPRISE_VENUE_PLAN_MONTHLY=price_1TAbnb45ttokNjrVXDIQHWHG
VITE_STRIPE_PRICE_ENTERPRISE_VENUE_PLAN_YEARLY=price_1TAbqS45ttokNjrVvEZJk6a8
```

### Step 3: Redeploy
After adding the variables:
1. Go to **Deploys** tab
2. Click **Trigger deploy** → **Deploy site**

OR just push your code again and it will automatically redeploy.

## What Was Fixed

### 1. Content Security Policy (CSP)
Updated `netlify.toml` to allow:
- ✅ Google Fonts stylesheets (`https://fonts.googleapis.com`)
- ✅ Google Fonts files (`https://fonts.gstatic.com`)

### 2. Environment Variables
The "Missing Supabase environment variables" error occurs because Netlify doesn't have access to your local `.env` file. You must set them manually in Netlify's dashboard.

## Test After Deployment
1. Wait for deployment to complete
2. Visit your site
3. Check browser console - both errors should be gone
4. Try logging in to verify Supabase connection works
