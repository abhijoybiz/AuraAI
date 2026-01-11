// app.config.js
// Expo configuration file with environment-based settings
// 
// IMPORTANT: For production builds, set these environment variables:
// - SUPABASE_URL: Your Supabase project URL
// - SUPABASE_ANON_KEY: Your Supabase anonymous/public key (safe to expose)
// - APP_ENV: 'development' or 'production'
//
// For development (local testing with insecure keys):
// - DEEPGRAM_API_KEY: Only for dev mode testing
// - GROQ_API_KEY: Only for dev mode testing

const APP_ENV = process.env.APP_ENV || 'development';
const IS_PROD = APP_ENV === 'production';

// Supabase configuration (required for production)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Legacy keys: ONLY load these if we are strictly in development mode
// If IS_PROD is true, we set these to null so they are NEVER bundled into the APK/IPA
const DEEPGRAM_API_KEY = IS_PROD ? null : process.env.DEEPGRAM_API_KEY;
const GROQ_API_KEY = IS_PROD ? null : process.env.GROQ_API_KEY;

// API base URL (for legacy backend if still used)
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

// Debug logging
console.log('========================================');
console.log('🚀 Memry App Config');
console.log(`Environment: ${APP_ENV.toUpperCase()}`);
console.log(`Mode: ${IS_PROD ? '🔒 SECURE (Edge Functions)' : '🛠️ DEV (Local Keys)'}`);
console.log('----------------------------------------');
console.log('SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
console.log('LOCAL_KEYS_IN_BUNDLE:', IS_PROD ? '🚫 HIDDEN' : '⚠️ INJECTED');
console.log('========================================');

// App versioning
const APP_VERSION = '1.0.0';
const BUILD_NUMBER = process.env.BUILD_NUMBER || '1';

module.exports = {
  expo: {
    name: "Memry",
    slug: "memry",
    version: APP_VERSION,
    runtimeVersion: {
      policy: "appVersion"
    },
    orientation: "portrait",

    icon: "./assets/logo.png",

    userInterfaceStyle: "automatic",

    plugins: [
      [
        "expo-navigation-bar",
        {
          backgroundColor: "#FFFFFF",
          barStyle: "dark",
          visibility: "visible",
          behavior: "inset-touch"
        }
      ]
    ],

    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#0f172a"
    },

    assetBundlePatterns: [
      "**/*"
    ],

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.memry.app",
      buildNumber: BUILD_NUMBER,
      infoPlist: {
        NSMicrophoneUsageDescription: "Memry needs access to your microphone to record lectures for transcription.",
        UIBackgroundModes: ["audio"]
      }
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/logo.png",
        backgroundColor: "#0f172a"
      },
      navigationBar: {
        visible: true,
        backgroundColor: "#FFFFFF",
        barStyle: "dark-content",
      },
      softwareKeyboardLayoutMode: "resize",
      package: "com.memry.app",
      versionCode: parseInt(BUILD_NUMBER, 10),
      permissions: [
        "RECORD_AUDIO",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    },

    web: {
      favicon: "./assets/logo.png"
    },

    // Extra configuration passed to the app
    extra: {
      // App metadata
      appEnv: APP_ENV,
      isProduction: IS_PROD,

      // Supabase (REQUIRED for production)
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,

      // Legacy API keys (DEV ONLY - removed in production builds)
      deepgramApiKey: DEEPGRAM_API_KEY,
      groqApiKey: GROQ_API_KEY,

      // Legacy backend URL
      apiBaseUrl: API_BASE_URL,

      // EAS Build configuration
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "a00c48e8-46c4-4e80-be83-b58d2c40e7f9"
      }
    },

    // Update configuration
    updates: {
      fallbackToCacheTimeout: 0,
      url: "https://u.expo.dev/a00c48e8-46c4-4e80-be83-b58d2c40e7f9"
    },

    // Owner for EAS
    owner: process.env.EXPO_OWNER || "abhijoybiz"
  }
};
