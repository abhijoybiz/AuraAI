---
description: Production deployment workflow for Memry app to Android (APK/AAB) and iOS (IPA)
---

# Production Deployment Workflow

This workflow guides you through deploying the Memry app to production.

## Prerequisites

Before starting, ensure you have:
- [ ] Supabase project created and configured
- [ ] EAS CLI installed (`npm install -g eas-cli`)
- [ ] Expo account created (`npx expo login`)
- [ ] For iOS: Apple Developer account ($99/year)
- [ ] For Android: Google Play Developer account ($25 one-time)

---

## Phase 1: Supabase Setup

### 1.1 Configure Database

1. Go to your Supabase dashboard → SQL Editor
2. Run the SQL from `supabase-schema.sql` (or the SQL provided in the setup guide)
3. Verify tables are created: `users`, `lectures`, `ai_usage`

### 1.2 Set Edge Function Secrets

```bash
cd "c:\Users\DELL\Desktop\ai-project\Expo App"

# Login to Supabase CLI
npx supabase login

# Link to your project (get ref from dashboard URL: app.supabase.com/project/YOUR_PROJECT_REF)
npx supabase link --project-ref YOUR_PROJECT_REF

# Set secrets (these are NEVER exposed to the client)
npx supabase secrets set DEEPGRAM_API_KEY=your_deepgram_api_key_here
npx supabase secrets set GROQ_API_KEY=your_groq_api_key_here
```

### 1.3 Deploy Edge Functions

```bash
# Deploy the transcribe function
npx supabase functions deploy transcribe

# Deploy the AI completion function  
npx supabase functions deploy ai-complete
```

### 1.4 Whitelist Your First User

1. Sign up in the app with your email
2. Go to Supabase Dashboard → Table Editor → users
3. Find your user and set `is_whitelisted` to `true`

---

## Phase 2: Environment Configuration

### 2.1 Create Production Environment File

Create a new file `.env.production`:

```
APP_ENV=production
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Important**: The SUPABASE_ANON_KEY is safe to include in your app bundle. It only allows public operations protected by Row Level Security.

### 2.2 Configure EAS Secrets

For secure builds, store secrets in EAS:

```bash
# Login to EAS
eas login

# Set production secrets
eas secret:create --scope project --name SUPABASE_URL --value "https://YOUR_PROJECT_REF.supabase.co"
eas secret:create --scope project --name SUPABASE_ANON_KEY --value "your_supabase_anon_key"
```

---

## Phase 3: Build Configuration

### 3.1 Update App Identifiers

Edit `app.config.js` and update:
- `expo.ios.bundleIdentifier`: e.g., `com.yourcompany.memry`
- `expo.android.package`: e.g., `com.yourcompany.memry`
- `expo.extra.eas.projectId`: Your EAS project ID

### 3.2 Configure Build Profiles

The `eas.json` file includes three profiles:
- **development**: For local testing with dev client
- **preview**: Generates APK for internal testing
- **production**: Generates AAB (Android) and IPA (iOS) for store submission

---

## Phase 4: Build for Android

### 4.1 Preview Build (APK for testing)

// turbo
```bash
cd "c:\Users\DELL\Desktop\ai-project\Expo App"
eas build --platform android --profile preview
```

This generates an APK you can install directly on devices for testing.

### 4.2 Production Build (AAB for Play Store)

```bash
eas build --platform android --profile production
```

This generates an Android App Bundle (AAB) required for Google Play Store.

### 4.3 Submit to Play Store

```bash
eas submit --platform android --latest
```

Or manually upload the AAB at https://play.google.com/console

---

## Phase 5: Build for iOS

### 5.1 Configure Apple Credentials

```bash
# EAS will guide you through Apple Developer setup
eas build:configure
```

### 5.2 Preview Build (for TestFlight)

```bash
eas build --platform ios --profile preview
```

### 5.3 Production Build (for App Store)

```bash
eas build --platform ios --profile production
```

### 5.4 Submit to App Store

```bash
eas submit --platform ios --latest
```

---

## Phase 6: Post-Deployment

### 6.1 Verify Edge Functions

Test each edge function from the Supabase dashboard:
1. Go to Edge Functions in dashboard
2. Click on each function
3. Check logs for any errors

### 6.2 Monitor Usage

Check the `ai_usage` table in Supabase to track:
- Number of transcriptions
- AI generation calls
- User activity

### 6.3 Add More Whitelisted Users

```sql
UPDATE public.users
SET is_whitelisted = TRUE
WHERE email IN ('user1@example.com', 'user2@example.com');
```

---

## Troubleshooting

### Build Fails

1. Check EAS build logs: `eas build:list`
2. View specific build: `eas build:view BUILD_ID`
3. Common issues:
   - Missing native modules: Run `npx expo prebuild`
   - Credential issues: Run `eas credentials`

### Edge Function Errors

1. Check function logs in Supabase dashboard
2. Test locally: `npx supabase functions serve`
3. Verify secrets are set: `npx supabase secrets list`

### Auth Issues

1. Check Supabase Auth settings (enable email provider)
2. Verify RLS policies are correct
3. Test with a known whitelisted user

---

## Quick Reference

| Task | Command |
|------|---------|
| Build Android APK | `eas build -p android --profile preview` |
| Build Android AAB | `eas build -p android --profile production` |
| Build iOS | `eas build -p ios --profile production` |
| Submit to Play Store | `eas submit -p android --latest` |
| Submit to App Store | `eas submit -p ios --latest` |
| Deploy Edge Functions | `npx supabase functions deploy` |
| View Secrets | `npx supabase secrets list` |
