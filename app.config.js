// Load environment variables
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Debug logging
console.log('Loading app.config.js...');
console.log('DEEPGRAM_API_KEY:', DEEPGRAM_API_KEY ? '✓ Loaded' : '✗ Missing');
console.log('OPENROUTER_API_KEY:', OPENROUTER_API_KEY ? '✓ Loaded' : '✗ Missing');

module.exports = {
  expo: {
    name: "Expo App",
    slug: "expo-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
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
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      deepgramApiKey: DEEPGRAM_API_KEY,
      openrouterApiKey: OPENROUTER_API_KEY
    }
  }
};