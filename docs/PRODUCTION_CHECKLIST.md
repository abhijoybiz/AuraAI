# 🚀 Memry App - Production Deployment Checklist

Use this checklist before every production release to ensure nothing is missed.

---

## 🔐 Security Checks

### API Keys & Secrets
- [ ] **CRITICAL**: Verify NO API keys are in the frontend bundle
  - Run: `npx expo export` and search for any API keys in the output
  - Check `app.config.js` - API keys should be `undefined` in production
- [ ] All sensitive keys are stored in Supabase Edge Function secrets
  - [ ] `DEEPGRAM_API_KEY` set in Edge Functions
  - [ ] `GROQ_API_KEY` set in Edge Functions
- [ ] Supabase Anon Key is present (this is safe to expose)
- [ ] No `.env` files are committed to git

### Authentication & Access Control
- [ ] Email authentication enabled in Supabase
- [ ] Email confirmation required for new signups
- [ ] Whitelist system working correctly
- [ ] Non-whitelisted users see "Access Denied" screen
- [ ] Password reset flow tested

### Database Security
- [ ] Row Level Security (RLS) enabled on ALL tables
- [ ] All RLS policies tested with non-admin users
- [ ] Users can ONLY access their own data
- [ ] Whitelist check included in sensitive operations

---

## 🏗️ Build Configuration

### App Identifiers
- [ ] `bundleIdentifier` (iOS) is correct and unique
- [ ] `package` (Android) is correct and unique
- [ ] App version updated in `app.config.js`
- [ ] Build number incremented

### Icons & Splash
- [ ] App icon is 1024x1024 PNG (no transparency for iOS)
- [ ] Adaptive icon configured for Android
- [ ] Splash screen configured with correct background color

### Permissions
- [ ] Microphone permission description updated
- [ ] Only necessary permissions requested
- [ ] Permission descriptions are user-friendly

---

## 🔌 Backend & Edge Functions

### Supabase Setup
- [ ] Database schema applied (`supabase-schema.sql`)
- [ ] All tables created: `users`, `lectures`, `ai_usage`
- [ ] Indexes created for performance
- [ ] Triggers set up (auto-create user profile, updated_at)

### Edge Functions
- [ ] `transcribe` function deployed and tested
- [ ] `ai-complete` function deployed and tested
- [ ] All functions return proper CORS headers
- [ ] Error handling returns meaningful messages
- [ ] Usage logging working (check `ai_usage` table)

### Function Secrets
- [ ] `DEEPGRAM_API_KEY` secret set
- [ ] `GROQ_API_KEY` secret set
- [ ] Secrets verified: `npx supabase secrets list`

---

## 📱 App Functionality

### Core Features
- [ ] User signup/signin working
- [ ] Audio recording working
- [ ] Transcription via Edge Function working
- [ ] Summary generation working
- [ ] Flashcard generation working
- [ ] Quiz generation working
- [ ] Notes generation working
- [ ] Chat functionality working

### Data Persistence
- [ ] Lectures saved to Supabase cloud
- [ ] Local cache working (offline access)
- [ ] Data syncs correctly between devices
- [ ] Delete properly removes from cloud and local

### Error Handling
- [ ] Network errors show user-friendly messages
- [ ] API errors don't expose technical details
- [ ] Loading states displayed appropriately
- [ ] Empty states handled gracefully

---

## ⚡ Performance

### App Size
- [ ] Bundle size is reasonable (< 50MB APK)
- [ ] No unused dependencies
- [ ] Images are optimized

### API Efficiency
- [ ] Large audio files handled properly
- [ ] Pagination implemented for lists
- [ ] No unnecessary API calls

### Memory
- [ ] No memory leaks in long-running features
- [ ] Images properly unloaded when not visible
- [ ] Audio resources released after use

---

## 🧪 Testing

### Device Testing
- [ ] Tested on Android (minimum API level)
- [ ] Tested on iOS (minimum version)
- [ ] Tested on different screen sizes
- [ ] Tested on slow network connection

### User Flows
- [ ] New user signup → whitelist check → denied screen
- [ ] Whitelisted user → full app access
- [ ] Record → Transcribe → Generate materials → Save
- [ ] View saved lectures → Edit → Delete

### Edge Cases
- [ ] Very long recordings (> 30 minutes)
- [ ] Very short recordings (< 10 seconds)
- [ ] Empty transcript handling
- [ ] Session expiration handling
- [ ] App backgrounding/foregrounding

---

## 📋 Store Submission

### Common Requirements
- [ ] Privacy Policy URL ready
- [ ] Terms of Service URL ready
- [ ] Support email/URL configured
- [ ] App screenshots prepared (all required sizes)
- [ ] App description written
- [ ] Keywords/categories selected

### Google Play Store
- [ ] AAB (not APK) generated for submission
- [ ] Target API level meets requirements
- [ ] Content rating questionnaire completed
- [ ] Data safety form completed
- [ ] Internal/closed testing done first

### Apple App Store
- [ ] App Store Connect app created
- [ ] Apple Developer membership active
- [ ] Push notification certificates (if needed)
- [ ] Sign in with Apple (if using social login)
- [ ] TestFlight testing completed

---

## 🚨 Common Mistakes to Avoid

### Security
❌ Hardcoding API keys in source code
❌ Leaving debug logs with sensitive data
❌ Disabling RLS for convenience
❌ Using service role key in client app

### Builds
❌ Forgetting to increment version/build number
❌ Using development profile for production
❌ Not testing production build locally first
❌ Ignoring native module warnings

### Supabase
❌ Not deploying Edge Functions before testing
❌ Missing CORS headers in Edge Functions
❌ Forgetting to set secrets after re-deploy
❌ Not testing RLS policies as regular user

### User Experience
❌ No loading indicators
❌ Cryptic error messages
❌ Broken back navigation
❌ No offline handling

---

## 📊 Post-Launch Monitoring

- [ ] Set up error tracking (Sentry, Bugsnag, etc.)
- [ ] Monitor Supabase usage dashboard
- [ ] Check Edge Function logs regularly
- [ ] Set up alerts for:
  - [ ] High error rates
  - [ ] API quota limits
  - [ ] Unusual usage patterns

---

## ✅ Final Sign-Off

| Check | Date | Verified By |
|-------|------|-------------|
| Security Review | | |
| Functionality Test | | |
| Performance Test | | |
| Store Requirements | | |
| Production Build Test | | |

**Release Version**: _______________
**Release Date**: _______________
**Approved By**: _______________
