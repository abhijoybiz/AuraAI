// context/AuthContext.js
// Authentication context for managing user state across the app

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isUserWhitelisted } from '../lib/supabase';
import { pullLecturesFromCloud, syncAllLecturesToCloud, migrateLegacyData } from '../services/lectureStorage';

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

    useEffect(() => {
        let isMounted = true;

        const handleAuthStateChange = async (newSession) => {
            if (!isMounted) return;

            setSession(newSession);
            const newUser = newSession?.user ?? null;
            setUser(newUser);

            if (newUser) {
                try {
                    const whitelisted = await isUserWhitelisted(newUser);
                    if (isMounted) {
                        setIsWhitelisted(whitelisted);

                        // Background sync for whitelisted users
                        if (whitelisted) {
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
                    }
                } catch (e) {
                    console.error('[AUTH] Whitelist check failed:', e);
                }
            } else {
                if (isMounted) setIsWhitelisted(false);
            }

            if (isMounted) setLoading(false);
        };

        // Initialize
        const initialize = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                await handleAuthStateChange(initialSession);
            } catch (error) {
                console.error('[AUTH] Init failed:', error);
                if (isMounted) setLoading(false);
            }
        };

        initialize();

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            // Only re-handle if not the initial load (which initialize() handles)
            // or if the event is significant (SIGNED_IN, SIGNED_OUT)
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
                await handleAuthStateChange(currentSession);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    /**
     * Sign up with email and password
     */
    const signUp = async (email, password, fullName = '') => {
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
     * Sign in with email and password
     */
    const signIn = async (email, password) => {
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
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
     * Sign out
     */
    const signOut = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Reset password (sends email)
     */
    const resetPassword = async (email) => {
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
