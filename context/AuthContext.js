// context/AuthContext.js - Updated with offline support

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isUserWhitelisted } from '../lib/supabase';
import { pullLecturesFromCloud, syncAllLecturesToCloud, migrateLegacyData } from '../services/lectureStorage';
import {
  cacheAuthState,
  getCachedAuthState,
  clearAuthCache,
  validateCachedSession
} from '../services/secureAuthStorage';
import NetInfo from '@react-native-community/netinfo';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [error, setError] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const handleAuthStateChange = async (newSession, forceOnline = false) => {
    setSession(newSession);
    const newUser = newSession?.user ?? null;
    setUser(newUser);

    if (newUser) {
      try {
        const whitelisted = await isUserWhitelisted(newUser);
        setIsWhitelisted(whitelisted);

        // Cache auth state for offline use
        await cacheAuthState(newUser, whitelisted);

        // Background sync for whitelisted users
        if (whitelisted && !isOfflineMode) {
          (async () => {
            try {
              await migrateLegacyData();
              await pullLecturesFromCloud();
              await syncAllLecturesToCloud();
            } catch (e) {
              console.error('[AUTH] Sync failed:', e);
            }
          })();
        }
      } catch (e) {
        console.error('[AUTH] Whitelist check failed:', e);
        // If online and whitelist check fails, deny access for security
        if (forceOnline) {
          setIsWhitelisted(false);
        }
      }
    } else {
      setIsWhitelisted(false);
      await clearAuthCache();
    }

    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Check network state first
        const netState = await NetInfo.fetch();
        const isOnline = netState.isConnected && netState.isInternetReachable !== false;

        if (isOnline) {
          // Online: Normal Supabase auth flow
          console.log('[AUTH] Online mode - checking Supabase session');

          const { data: { session: initialSession } } = await supabase.auth.getSession();

          if (isMounted) {
            setIsOfflineMode(false);
            await handleAuthStateChange(initialSession, true);
          }
        } else {
          // Offline: Use cached auth state
          console.log('[AUTH] Offline mode - using cached auth');

          const cachedAuth = await getCachedAuthState();

          if (cachedAuth) {
            // Create a minimal user object from cache
            const offlineUser = {
              id: cachedAuth.userId,
              email: cachedAuth.email,
            };

            if (isMounted) {
              setIsOfflineMode(true);
              setUser(offlineUser);
              setIsWhitelisted(cachedAuth.isWhitelisted);
              setLoading(false);
              console.log('[AUTH] Restored session from cache (offline mode)');
            }
          } else {
            // No cached session - user must authenticate online first
            if (isMounted) {
              setIsOfflineMode(true);
              setUser(null);
              setIsWhitelisted(false);
              setLoading(false);
              setError('No cached session. Please connect to the internet to sign in.');
            }
          }
        }
      } catch (error) {
        console.error('[AUTH] Init error:', error);

        // Fallback to cached auth on any error
        try {
          const cachedAuth = await getCachedAuthState();
          if (cachedAuth && isMounted) {
            setUser({ id: cachedAuth.userId, email: cachedAuth.email });
            setIsWhitelisted(cachedAuth.isWhitelisted);
            setIsOfflineMode(true);
          }
        } catch (cacheError) {
          console.error('[AUTH] Cache fallback failed:', cacheError);
        }

        if (isMounted) setLoading(false);
      }
    };

    initialize();

    // Listen for auth state changes (when online)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        if (isMounted) {
          await handleAuthStateChange(currentSession, true);
          setIsOfflineMode(false);
        }
      }
    });

    // Listen for network state changes
    const unsubscribeNetInfo = NetInfo.addEventListener(async (state) => {
      const isOnline = state.isConnected && state.isInternetReachable !== false;

      if (isOnline && isOfflineMode && isMounted) {
        // Coming back online - revalidate session
        console.log('[AUTH] Network restored - revalidating session');
        const isValid = await validateCachedSession();

        if (isValid) {
          // Re-initialize properly
          const { data: { session } } = await supabase.auth.getSession();
          await handleAuthStateChange(session, true);
          setIsOfflineMode(false);
        } else {
          // Session invalid - force re-auth
          setUser(null);
          setIsWhitelisted(false);
          await clearAuthCache();
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      unsubscribeNetInfo();
    };
  }, []);

  const signIn = async (email, password) => {
    // Check if online first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return { data: null, error: { message: 'No internet connection. Please connect to sign in.' } };
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await clearAuthCache(); // Clear cached auth
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setIsWhitelisted(false);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (email, password, fullName = '') => {
    // Check if online first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return { data: null, error: { message: 'No internet connection. Please connect to sign up.' } };
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      setError(error.message);
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset password (sends email)
   */
  const resetPassword = async (email) => {
    // Check if online first
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return { error: { message: 'No internet connection. Please connect to reset password.' } };
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      setError(error.message);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    isWhitelisted,
    isOfflineMode,
    error,
    signUp,
    signIn,
    signOut,
    resetPassword,
    clearError: () => setError(null),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;