// Load environment variables directly from .env.local
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
let DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// If not available from process.env, read directly from .env.local
if (!DEEPGRAM_API_KEY || !OPENROUTER_API_KEY) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();

        if (key.trim() === 'DEEPGRAM_API_KEY') {
          DEEPGRAM_API_KEY = value.replace(/^["'](.+)["']$/, '$1');
        } else if (key.trim() === 'OPENROUTER_API_KEY') {
          OPENROUTER_API_KEY = value.replace(/^["'](.+)["']$/, '$1');
        }
      }
    });
  } catch (error) {
    console.error('Error reading .env.local:', error);
  }
}

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
      package: "com.anonymous.expoapp"
    },
    web: {
      favicon: "./assets/logo.png"
    },
    extra: {
      deepgramApiKey: DEEPGRAM_API_KEY,
      openrouterApiKey: OPENROUTER_API_KEY
    }
  }
};