// lib/supabase.js
// Supabase client configuration for production

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// These are safe to expose - they only identify your project
// All security is handled by Row Level Security (RLS) on the server
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase configuration missing. Check your environment variables.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Important for React Native
    },
});

// Helper function to get current session
export const getSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Error getting session:', error);
        return null;
    }
    return session;
};

// Helper function to get current user
export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Error getting user:', error);
        return null;
    }
    return user;
};

// Check if user is whitelisted with a safety timeout
export const isUserWhitelisted = async (providedUser = null) => {
    const user = providedUser || await getCurrentUser();
    if (!user) return false;

    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Whitelist check timed out')), 5000)
    );

    try {
        const fetchPromise = (async () => {
            const { data, error } = await supabase
                .from('users')
                .select('is_whitelisted, is_active')
                .eq('id', user.id)
                .single();

            if (error) {
                console.error('Error checking whitelist:', error);
                return false;
            }

            return data?.is_whitelisted && data?.is_active;
        })();

        // Race the network fetch against a 5-second timeout
        return await Promise.race([fetchPromise, timeoutPromise]);
    } catch (e) {
        console.error('Whitelist check failed or timed out:', e.message);
        // On timeout or failure, we default to false for security, 
        // but we've unblocked the loading state.
        return false;
    }
};

/**
 * Standard UUID v4 generator
 * Used to ensure local IDs match Supabase UUID column requirements
 */
export const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
