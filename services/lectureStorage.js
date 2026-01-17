// services/lectureStorage.js
// Cloud-first lecture storage service using Supabase
// Local persistence is removed to ensure cross-device consistency

import { supabase, generateUUID } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Robust base64 to ArrayBuffer converter (Pure JS for RN compatibility)
 */
function base64ToArrayBuffer(base64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes = new Uint8Array(Math.floor(base64.length * 0.75));
    let i, j = 0;

    const lookup = new Uint8Array(256);
    for (i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    for (i = 0; i < base64.length; i += 4) {
        const buffer = (lookup[base64.charCodeAt(i)] << 18) |
            (lookup[base64.charCodeAt(i + 1)] << 12) |
            (lookup[base64.charCodeAt(i + 2)] << 6) |
            lookup[base64.charCodeAt(i + 3)];

        bytes[j++] = (buffer >> 16) & 0xFF;
        if (base64[i + 2] !== '=') bytes[j++] = (buffer >> 8) & 0xFF;
        if (base64[i + 3] !== '=') bytes[j++] = buffer & 0xFF;
    }
    return bytes.buffer;
}

/**
 * Safely parses a date string or object into a valid ISO string.
 */
const safeIsoDate = (dateVal) => {
    try {
        if (!dateVal) return new Date().toISOString();
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return new Date().toISOString();
        return d.toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
};

/**
 * Formats a date for display
 */
const formatDisplayDate = (dateVal) => {
    try {
        if (!dateVal) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return 'Unknown Date';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return 'Unknown Date';
    }
};

/**
 * Maps local card format to Supabase lectures table format
 */
const mapLocalToCloud = (card, userId) => {
    const rawUri = card.uri || card.audioUri || null;
    const isCloudUri = rawUri && rawUri.startsWith('http');

    return {
        id: card.id,
        user_id: userId,
        title: card.title || 'Untitled',
        duration: card.duration || '00:00',
        category: (card.filterIds && card.filterIds.length > 0) ? card.filterIds.join(',') : null,
        is_favorite: card.isFavorite || false,
        transcript: card.transcript ? JSON.stringify(card.transcript) : null,
        segments: card.segments || null,
        summary: card.summary || null,
        flashcards: card.flashcards || null,
        quiz: card.quiz || null,
        notes: card.notes || null,
        journey_map: card.journeyMap || null,
        chat_history: card.chatHistory ? JSON.stringify(card.chatHistory) : null,
        audio_url: isCloudUri ? rawUri : null,
        created_at: safeIsoDate(card.date),
        updated_at: new Date().toISOString(),
    };
};

/**
 * Maps Supabase lecture format to local card format
 */
const mapCloudToLocal = (lecture) => ({
    id: lecture.id,
    title: lecture.title,
    date: formatDisplayDate(lecture.created_at),
    duration: lecture.duration,
    filterIds: lecture.category ? lecture.category.split(',') : [],
    isFavorite: lecture.is_favorite || false,
    transcript: lecture.transcript ? (typeof lecture.transcript === 'string' ? JSON.parse(lecture.transcript) : lecture.transcript) : [],
    segments: lecture.segments,
    summary: lecture.summary,
    flashcards: lecture.flashcards,
    quiz: lecture.quiz,
    notes: lecture.notes,
    journeyMap: lecture.journey_map,
    chatHistory: lecture.chat_history ? (typeof lecture.chat_history === 'string' ? JSON.parse(lecture.chat_history) : lecture.chat_history) : [],
    uri: lecture.audio_url,
    audioUri: lecture.audio_url,
    source: 'cloud',
    status: 'ready',
    progress: 1,
});

/**
 * Check if network is available
 */
const isOnline = async () => {
    try {
        const state = await NetInfo.fetch();
        return state.isConnected && state.isInternetReachable !== false;
    } catch {
        return false;
    }
};

/**
 * Validates and returns a proper cloud audio URL
 * Returns null if the URL is a local file URI
 */
const validateCloudAudioUrl = (uri) => {
    if (!uri) return null;
    // Only accept HTTPS URLs (cloud URLs)
    if (uri.startsWith('https://')) return uri;
    if (uri.startsWith('http://')) return uri;
    // Local file URIs are not valid for cross-device sync
    return null;
};

/**
 * Uploads a local audio file to Supabase Storage
 * Includes retry logic and comprehensive error handling
 */
export const uploadAudioForLecture = async (localUri, lectureId, retryCount = 0) => {
    const MAX_RETRIES = 2;

    try {
        // If already a cloud URL, validate and return
        if (!localUri) {
            console.log('[CLOUD STORAGE] No URI provided');
            return null;
        }

        if (localUri.startsWith('http')) {
            console.log('[CLOUD STORAGE] Already a cloud URL:', localUri.substring(0, 50) + '...');
            return localUri;
        }

        console.log('[CLOUD STORAGE] Starting upload for lecture:', lectureId);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            console.error('[CLOUD STORAGE] No user session available');
            throw new Error('No user session');
        }

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) {
            console.error('[CLOUD STORAGE] Local file does not exist:', localUri);
            return null;
        }

        console.log('[CLOUD STORAGE] File size:', fileInfo.size, 'bytes');

        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        if (!base64 || base64.length === 0) {
            console.error('[CLOUD STORAGE] Failed to read file as base64');
            return null;
        }

        // Determine file extension from URI
        const extension = localUri.includes('.m4a') ? 'm4a' :
            localUri.includes('.wav') ? 'wav' :
                localUri.includes('.mp3') ? 'mp3' : 'm4a';

        const contentType = extension === 'wav' ? 'audio/wav' :
            extension === 'mp3' ? 'audio/mpeg' : 'audio/m4a';

        const path = `${session.user.id}/${lectureId}.${extension}`;
        console.log('[CLOUD STORAGE] Uploading to path:', path);

        const { error } = await supabase.storage
            .from('lecture_audio')
            .upload(path, base64ToArrayBuffer(base64), {
                contentType: contentType,
                upsert: true
            });

        if (error) {
            console.error('[CLOUD STORAGE] Upload error:', error.message);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('lecture_audio')
            .getPublicUrl(path);

        console.log('[CLOUD STORAGE] Upload successful. Public URL:', publicUrl.substring(0, 50) + '...');
        return publicUrl;
    } catch (error) {
        console.error('[CLOUD STORAGE] Upload failed:', error.message);

        // Retry logic for transient failures
        if (retryCount < MAX_RETRIES) {
            console.log(`[CLOUD STORAGE] Retrying upload (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return uploadAudioForLecture(localUri, lectureId, retryCount + 1);
        }

        return null;
    }
};

/**
 * Direct Cloud Sync: Saves/Updates a lecture directly in Supabase
 * CRITICAL: Ensures audio is uploaded to cloud storage before syncing
 */
export const syncLectureToCloud = async (card) => {
    console.log('[CLOUD SYNC] Starting sync for lecture:', card.id, 'Title:', card.title);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        console.error('[CLOUD SYNC] Not authenticated');
        return { success: false, reason: 'not_authenticated' };
    }

    if (!(await isOnline())) {
        console.warn('[CLOUD SYNC] Device is offline, sync deferred');
        return { success: false, reason: 'offline' };
    }

    // Title Uniqueness Check (Local check should happen in UI, but this is a safety guard)
    const { data: duplicate } = await supabase
        .from('lectures')
        .select('id')
        .eq('user_id', user.id)
        .eq('title', card.title)
        .neq('id', card.id)
        .maybeSingle();

    if (duplicate) {
        console.warn('[CLOUD SYNC] Duplicate title detected:', card.title);
        return { success: false, reason: 'duplicate_title' };
    }

    // CRITICAL: Handle audio upload - ensure we never save local file:// URIs to cloud
    let publicAudioUrl = null;
    const rawUri = card.uri || card.audioUri;

    if (rawUri) {
        if (rawUri.startsWith('http')) {
            // Already a cloud URL
            publicAudioUrl = rawUri;
            console.log('[CLOUD SYNC] Audio already in cloud');
        } else {
            // Local file - must upload to cloud storage
            console.log('[CLOUD SYNC] Uploading local audio file to cloud...');
            const uploadedUrl = await uploadAudioForLecture(rawUri, card.id);

            if (uploadedUrl) {
                publicAudioUrl = uploadedUrl;
                console.log('[CLOUD SYNC] Audio uploaded successfully');
            } else {
                console.error('[CLOUD SYNC] Audio upload failed! Audio will not be available on other devices.');
                // We still sync the lecture, but audio won't work cross-device
                // The local URI is intentionally NOT saved to prevent broken references
            }
        }
    } else {
        console.log('[CLOUD SYNC] No audio URI provided');
    }

    try {
        const cloudData = mapLocalToCloud({ ...card, uri: publicAudioUrl }, user.id);
        console.log('[CLOUD SYNC] Saving to database with audio_url:', publicAudioUrl ? 'SET' : 'NULL');

        const { error } = await supabase
            .from('lectures')
            .upsert(cloudData, { onConflict: 'id' });

        if (error) throw error;

        console.log('[CLOUD SYNC] Sync successful for lecture:', card.id);
        return { success: true, cloudUrl: publicAudioUrl };
    } catch (error) {
        console.error('[CLOUD SYNC] Failed:', error);
        return { success: false, reason: 'error', error };
    }
};

/**
 * Fetch all lectures for current user directly from cloud
 */
export const fetchLecturesFromCloud = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return [];

    try {
        const { data, error } = await supabase
            .from('lectures')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapCloudToLocal);
    } catch (error) {
        console.error('[CLOUD FETCH] Failed:', error);
        return [];
    }
};

/**
 * Delete a lecture from cloud
 */
export const deleteLectureFromCloud = async (lectureId) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { success: false };

    try {
        const { error } = await supabase
            .from('lectures')
            .delete()
            .eq('id', lectureId)
            .eq('user_id', session.user.id);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('[CLOUD DELETE] Failed:', error);
        return { success: false, error };
    }
};

/**
 * Sync Filters (Cloud-only)
 */
export const syncFiltersToCloud = async (filters) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !(await isOnline())) return;

    try {
        const customFilters = filters.filter(f => !f.isDefault).map(f => ({
            id: f.id,
            user_id: user.id,
            name: f.name,
            icon: f.icon,
            updated_at: new Date().toISOString()
        }));

        if (customFilters.length === 0) return;

        await supabase.from('filters').upsert(customFilters, { onConflict: 'id' });
    } catch (e) {
        console.error('[FILTERS] Sync failed:', e);
    }
};

/**
 * Pull Filters from Cloud
 */
export const fetchFiltersFromCloud = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    try {
        const { data, error } = await supabase
            .from('filters')
            .select('*')
            .eq('user_id', session.user.id);

        if (error) throw error;
        return (data || []).map(f => ({
            id: f.id,
            name: f.name,
            icon: f.icon,
            isDefault: false
        }));
    } catch (e) {
        console.error('[FILTERS] Pull failed:', e);
        return [];
    }
};

/**
 * Fetch user preferences from cloud (Supabase metadata)
 */
export const fetchUserPreferences = async () => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return {};
        return user.user_metadata?.app_prefs || {};
    } catch (e) {
        console.error('[PREFS] Fetch failed:', e);
        return {};
    }
};

/**
 * Update a specific user preference in the cloud
 */
export const updateUserPreference = async (key, value) => {
    try {
        const { data: { user }, error: getError } = await supabase.auth.getUser();
        if (getError || !user) return { success: false };

        const currentPrefs = user.user_metadata?.app_prefs || {};
        const updatedPrefs = { ...currentPrefs, [key]: value };

        const { error: updateError } = await supabase.auth.updateUser({
            data: { app_prefs: updatedPrefs }
        });

        if (updateError) throw updateError;
        return { success: true };
    } catch (e) {
        console.error('[PREFS] Update failed:', e);
        return { success: false, error: e };
    }
};

/**
 * Coordinator for full sync of all user data
 */
export const syncAllData = async () => {
    if (!(await isOnline())) return { success: false, reason: 'offline' };

    try {
        console.log('[SYNC] Starting full data sync...');
        const [lectures, filters, prefs] = await Promise.all([
            fetchLecturesFromCloud(),
            fetchFiltersFromCloud(),
            fetchUserPreferences()
        ]);

        console.log('[SYNC] Full sync successful');
        return {
            success: true,
            data: { lectures, filters, prefs }
        };
    } catch (error) {
        console.error('[SYNC] Full sync failed:', error);
        return { success: false, error };
    }
};

export default {
    fetchLecturesFromCloud,
    syncLectureToCloud,
    deleteLectureFromCloud,
    syncFiltersToCloud,
    fetchFiltersFromCloud,
    fetchUserPreferences,
    updateUserPreference,
    syncAllData,
    isOnline,
};
