// services/secureAuthStorage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const AUTH_CACHE_KEY = '@memry_auth_cache';
const CACHE_EXPIRY_DAYS = 7; // Max offline access duration

/**
 * Cache auth state securely
 */
export const cacheAuthState = async (user, isWhitelisted) => {
  if (!user) {
    await AsyncStorage.removeItem(AUTH_CACHE_KEY);
    return;
  }

  const cache = {
    userId: user.id,
    email: user.email,
    isWhitelisted: isWhitelisted,
    cachedAt: Date.now(),
    expiresAt: Date.now() + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
  };

  await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
};

/**
 * Get cached auth state (for offline use)
 */
export const getCachedAuthState = async () => {
  try {
    const cached = await AsyncStorage.getItem(AUTH_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    
    // Check if cache has expired
    if (Date.now() > data.expiresAt) {
      console.log('[AUTH-CACHE] Cache expired, requiring re-authentication');
      await AsyncStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[AUTH-CACHE] Error reading cache:', error);
    return null;
  }
};

/**
 * Validate cached session when coming back online
 */
export const validateCachedSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Session invalid, clear cache
      await AsyncStorage.removeItem(AUTH_CACHE_KEY);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[AUTH-CACHE] Validation error:', error);
    return false;
  }
};

/**
 * Clear auth cache (for logout)
 */
export const clearAuthCache = async () => {
  await AsyncStorage.removeItem(AUTH_CACHE_KEY);
};