// app.config.js
// Expo-compatible configuration file
// Environment variables are injected at build time via process.env

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8081';

// Optional debug logs (safe to remove later)
console.log('Loading app.config.js...');
console.log('DEEPGRAM_API_KEY:', DEEPGRAM_API_KEY ? '✓ Loaded' : '✗ Missing');
console.log('GROQ_API_KEY:', GROQ_API_KEY ? '✓ Loaded' : '✗ Missing');
console.log('API_BASE_URL:', API_BASE_URL);

module.exports = {
  expo: {
    name: "Memry",
    slug: "memry",
    version: "1.0.0",
    orientation: "portrait",

    icon: "./assets/logo.png",

    userInterfaceStyle: "light",

    splash: {
      image: "./assets/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },

    assetBundlePatterns: [
      "**/*"
    ],

    ios: {
      supportsTablet: true
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/logo.png",
        backgroundColor: "#ffffff"
      },
      navigationBar: {
        visible: "leanback",
        backgroundColor: "#00000000"
      },
      package: "com.anonymous.expoapp"
    },

    web: {
      favicon: "./assets/logo.png"
    },

    extra: {
      deepgramApiKey: DEEPGRAM_API_KEY,
      groqApiKey: GROQ_API_KEY,
      apiBaseUrl: API_BASE_URL
    }
  }
};
