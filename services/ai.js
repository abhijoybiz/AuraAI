// services/ai.js
// Smart AI Gateway - Automatically switches between Dev and Secure Production services
import Constants from 'expo-constants';
import { aiServiceDev } from './aiDev';
import { aiServiceSecure } from './aiSecure';

const appEnv = Constants.expoConfig?.extra?.appEnv || 'development';
const isProduction = appEnv === 'production';

/**
 * The unified AI service.
 * 
 * In development: Uses local API keys (aiDev.js) for speed.
 * In production: Routes via Supabase Edge Functions (aiSecure.js) for security.
 */
export const aiService = isProduction ? aiServiceSecure : aiServiceDev;

// Also export as default for components that use default imports
export default aiService;
