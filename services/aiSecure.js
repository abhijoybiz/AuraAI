// services/aiSecure.js
// Production-ready AI service that routes all API calls through Supabase Edge Functions
// This replaces the old ai.js service and keeps all API keys secure on the server

import * as FileSystem from 'expo-file-system/legacy';
import { supabase, getSession, isUserWhitelisted } from '../lib/supabase';
import Constants from 'expo-constants';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl;
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey;

// Helper to get authorization header
const getAuthHeader = async () => {
    const session = await getSession();

    if (!session?.access_token) {
        throw new Error('Not authenticated. Please sign in.');
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
        console.error('[aiSecure] Token is expired, attempting refresh...');
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
            throw new Error('Session expired. Please sign in again.');
        }
        return `Bearer ${data.session.access_token}`;
    }

    return `Bearer ${session.access_token}`;
};

// Helper to check whitelist before any action
const ensureWhitelisted = async () => {
    const whitelisted = await isUserWhitelisted();
    if (!whitelisted) {
        throw new Error('Access denied. Your account is not authorized to use this feature.');
    }
};

// Helper to attempt robust JSON parsing
const resilientJSONParse = (jsonString) => {
    if (!jsonString) return null;

    // Attempt 1: Direct Parse
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // Attempt 2: Fix specific invalid Markdown escapes common in LLM output
        // Converts \* -> *, \_ -> _, \` -> `, \' -> '
        const step1 = jsonString.replace(/\\(\*|_|`|')/g, '$1');
        try {
            return JSON.parse(step1);
        } catch (e2) {
            // Attempt 3: Fix literal newlines (dangerous but necessary for bad LLM output)
            // Converts actual newlines to \n escape sequences
            const step2 = step1.replace(/(?:\r\n|\r|\n)/g, '\\n');
            try {
                return JSON.parse(step2);
            } catch (e3) {
                // Attempt 4: Aggressive strip of all "bad" backslashes
                // Deletes any backslash not part of a valid JSON escape: " \ / b f n r t u
                const step3 = jsonString.replace(/\\(?![/\"\\bfnrtu])/g, '');
                try {
                    return JSON.parse(step3);
                } catch (e4) {
                    // Log fatal error details for debugging
                    console.error('CRITICAL: Final JSON Parse Failure');
                    console.error('Attempt 1 (Direct) Error:', e.message);
                    console.error('Attempt 4 (Aggressive) Error:', e4.message);
                    console.error('Bad String Snapshot:', jsonString.substring(0, 100) + '...');
                    console.error('Bad String Full:', jsonString);
                    return null;
                }
            }
        }
    }
};

// Generic function caller for Edge Functions
const callEdgeFunction = async (functionName, body) => {
    if (!SUPABASE_URL) {
        throw new Error('Supabase URL not configured. Check your environment variables.');
    }

    if (!SUPABASE_ANON_KEY) {
        throw new Error('Supabase Anon Key not configured. Check your environment variables.');
    }

    const authHeader = await getAuthHeader();
    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[aiSecure] Error response:', errorData);
        throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    return response.json();
};

export const aiServiceSecure = {
    /**
     * Transcribe audio using Deepgram via Edge Function
     * Audio file is converted to base64 and sent to the server
     */
    async transcribeAudio(uri) {
        await ensureWhitelisted();

        try {
            const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

            const result = await callEdgeFunction('transcribe', { audioBase64 });

            return {
                transcript: result.transcript,
                segments: result.segments || [{ text: result.transcript, start: 0, end: 0 }]
            };
        } catch (error) {
            console.error('Transcription error:', error);
            throw error;
        }
    },

    /**
     * Generate summary of transcript
     */
    async generateSummary(text) {
        await ensureWhitelisted();

        if (!text || text.trim().length === 0) {
            throw new Error('Transcript is empty');
        }

        try {
            const result = await callEdgeFunction('ai-complete', {
                action: 'summary',
                payload: { text }
            });

            return result.content || 'Could not generate summary.';
        } catch (error) {
            console.error('Summary generation error:', error);
            throw error;
        }
    },

    /**
     * Generate flashcards from transcript
     */
    async generateFlashcards(text, count = 5) {
        await ensureWhitelisted();

        if (!text || text.trim().length === 0) {
            throw new Error('Transcript is empty');
        }

        try {
            const result = await callEdgeFunction('ai-complete', {
                action: 'flashcards',
                payload: { text, count }
            });

            // Parse JSON from response
            const content = result.content || '[]';
            const start = content.indexOf('[');
            const end = content.lastIndexOf(']');

            if (start !== -1 && end !== -1) {
                // Use robust parser
                const parsed = resilientJSONParse(content.substring(start, end + 1));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }

            throw new Error('AI did not return valid flashcards');
        } catch (error) {
            console.error('Flashcard generation error:', error);
            throw error;
        }
    },

    /**
     * Generate quiz from transcript
     */
    async generateQuiz(text, count = 5) {
        await ensureWhitelisted();

        if (!text || text.trim().length === 0) {
            throw new Error('Transcript is empty');
        }

        try {
            const result = await callEdgeFunction('ai-complete', {
                action: 'quiz',
                payload: { text, count }
            });

            const content = result.content || '[]';
            const start = content.indexOf('[');
            const end = content.lastIndexOf(']');

            if (start !== -1 && end !== -1) {
                // Use robust parser
                const parsed = resilientJSONParse(content.substring(start, end + 1));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }

            throw new Error('AI did not return a valid quiz');
        } catch (error) {
            console.error('Quiz generation error:', error);
            throw error;
        }
    },

    /**
     * Generate structured notes from transcript
     */
    async generateNotes(text) {
        await ensureWhitelisted();

        if (!text || text.trim().length === 0) {
            throw new Error('Transcript is empty');
        }

        try {
            const result = await callEdgeFunction('ai-complete', {
                action: 'notes',
                payload: { text }
            });

            const content = result.content || '[]';
            const start = content.indexOf('[');
            const end = content.lastIndexOf(']');

            if (start !== -1 && end !== -1) {
                // Use robust parser
                const parsed = resilientJSONParse(content.substring(start, end + 1));
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }

            throw new Error('AI did not return valid notes');
        } catch (error) {
            console.error('Notes generation error:', error);
            throw error;
        }
    },

    /**
     * Chat with AI assistant
     */
    async chat(messages, transcript) {
        await ensureWhitelisted();

        try {
            const cleanedMessages = messages.map(({ role, content }) => ({ role, content }));

            const result = await callEdgeFunction('ai-complete', {
                action: 'chat',
                payload: {
                    messages: cleanedMessages,
                    transcript
                }
            });

            return result.content || "I processed your request but couldn't think of a response.";
        } catch (error) {
            console.error('Chat service error:', error);
            return "An unexpected error occurred. Please check your connection and try again.";
        }
    },

    /**
     * Modify existing notes with AI
     */
    async modifyNotes(currentBlocks, userPrompt) {
        await ensureWhitelisted();

        try {
            const result = await callEdgeFunction('ai-complete', {
                action: 'modify_notes',
                payload: {
                    currentBlocks,
                    userPrompt
                }
            });

            const content = result.content || '[]';
            const start = content.indexOf('[');
            const end = content.lastIndexOf(']');

            if (start !== -1 && end !== -1) {
                // Use robust parser
                const parsed = resilientJSONParse(content.substring(start, end + 1));
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            }

            throw new Error('AI did not return valid modified notes');
        } catch (error) {
            console.error('Notes modification error:', error);
            throw error;
        }
    }
};

// Export default for convenience
export default aiServiceSecure;
