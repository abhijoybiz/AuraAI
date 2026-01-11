// services/lectureStorage.js
// Unified lecture storage service that syncs between local AsyncStorage and Supabase cloud
// This bridges the gap between @memry_cards (local) and lectures table (cloud)

import { supabase, generateUUID } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';

const LOCAL_CARDS_KEY = '@memry_cards';
const LOCAL_FILTERS_KEY = '@memry_filters';

/**
 * Robust base64 to ArrayBuffer converter (Pure JS for RN compatibility)
 */
function base64ToArrayBuffer(base64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes = new Uint8Array(Math.floor(base64.length * 0.75));
    let i, j = 0;

    // Simple lookup table would be faster, but this is robust for small files
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
 * Prevents "RangeError: Date value out of bounds"
 */
const safeIsoDate = (dateVal) => {
    try {
        if (!dateVal) return new Date().toISOString();
        const d = new Date(dateVal);
        // Check if date is valid
        if (isNaN(d.getTime())) {
            return new Date().toISOString();
        }
        return d.toISOString();
    } catch (e) {
        console.error('[DATE HELP] Critical date parse error:', e);
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
const mapLocalToCloud = (card, userId) => ({
    id: card.id,
    user_id: userId,
    title: card.title || 'Untitled',
    duration: card.duration || '00:00',
    // Map local filterIds array to the cloud category string
    category: (card.filterIds && card.filterIds.length > 0) ? card.filterIds.join(',') : null,
    is_favorite: card.isFavorite || false,
    transcript: card.transcript ? JSON.stringify(card.transcript) : null,
    segments: card.segments || null,
    summary: card.summary || null,
    flashcards: card.flashcards || null,
    quiz: card.quiz || null,
    notes: card.notes || null,
    journey_map: card.journeyMap || null,
    audio_url: card.uri || card.audioUri || null,
    created_at: safeIsoDate(card.date), // Use safe helper
    updated_at: new Date().toISOString(),
});

/**
 * Maps Supabase lecture format to local card format
 */
const mapCloudToLocal = (lecture) => ({
    id: lecture.id,
    title: lecture.title,
    date: formatDisplayDate(lecture.created_at),
    duration: lecture.duration,
    // Safely map the cloud category string back to the local filterIds array
    filterIds: lecture.category ? lecture.category.split(',') : [],
    isFavorite: lecture.is_favorite || false,
    transcript: lecture.transcript ? (typeof lecture.transcript === 'string' ? JSON.parse(lecture.transcript) : lecture.transcript) : [],
    segments: lecture.segments,
    summary: lecture.summary,
    flashcards: lecture.flashcards,
    quiz: lecture.quiz,
    notes: lecture.notes,
    journeyMap: lecture.journey_map,
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
 * Sync a single lecture to cloud
 * This is called after any local update to persist to Supabase
 */
/**
 * Uploads a local audio file to Supabase Storage
 */
export const uploadAudioForLecture = async (localUri, lectureId) => {
    try {
        if (!localUri || localUri.startsWith('http')) {
            return localUri;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('No user session');

        // Read file as Base64
        // check if file exists first to avoid noisy errors
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (!fileInfo.exists) {
            console.warn(`[CLOUD STORAGE] Local file missing, skipping upload: ${localUri}`);
            return null;
        }

        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: 'base64',
        });

        // Construct path: user_id/lecture_id.m4a
        const path = `${session.user.id}/${lectureId}.m4a`;

        // Upload
        const { data, error } = await supabase.storage
            .from('lecture_audio')
            .upload(path, base64ToArrayBuffer(base64), {
                contentType: 'audio/m4a',
                upsert: true
            });

        if (error) throw error;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('lecture_audio')
            .getPublicUrl(path);

        console.log('[CLOUD STORAGE] Uploaded audio:', publicUrl);
        return publicUrl;

    } catch (error) {
        console.error('[CLOUD STORAGE] Upload failed:', error);
        return null; // Return null to indicate failure, but don't block metadata sync completely
    }
};

/**
 * Sync a single lecture to cloud
 * This is called after any local update to persist to Supabase
 */
export const syncLectureToCloud = async (card) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        return { success: false, reason: 'not_authenticated' };
    }

    const online = await isOnline();
    if (!online) {
        return { success: false, reason: 'offline' };
    }

    // Guard: Supabase requires UUID for primary key
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(card.id)) {
        return { success: false, reason: 'invalid_id_format' };
    }

    // Upload audio if needed (checks if it's a local file)
    let publicAudioUrl = card.uri;
    if (card.uri && !card.uri.startsWith('http')) {
        console.log('[CLOUD SYNC] Uploading audio for', card.id);
        const uploadedUrl = await uploadAudioForLecture(card.uri, card.id);
        if (uploadedUrl) {
            publicAudioUrl = uploadedUrl;
        }
    }

    try {
        const cloudData = mapLocalToCloud({ ...card, uri: publicAudioUrl }, user.id);

        // Check if lecture exists
        const { data: existing, error: selectError } = await supabase
            .from('lectures')
            .select('id')
            .eq('id', card.id)
            .maybeSingle();

        if (selectError && selectError.code !== 'PGRST116') {
            console.error('[CLOUD SYNC] Select error:', selectError);
            throw selectError;
        }

        if (existing) {
            // Update existing
            const { error: updateError } = await supabase
                .from('lectures')
                .update({
                    title: cloudData.title,
                    duration: cloudData.duration,
                    category: cloudData.category,
                    is_favorite: cloudData.is_favorite,
                    transcript: cloudData.transcript,
                    segments: cloudData.segments,
                    summary: cloudData.summary,
                    flashcards: cloudData.flashcards,
                    quiz: cloudData.quiz,
                    notes: cloudData.notes,
                    journey_map: cloudData.journey_map,
                    audio_url: cloudData.audio_url,
                    updated_at: cloudData.updated_at,
                })
                .eq('id', card.id);

            if (updateError) {
                console.error('[CLOUD SYNC] Update error:', updateError);
                throw updateError;
            }
        } else {
            // Insert new
            const { error: insertError } = await supabase
                .from('lectures')
                .insert(cloudData);

            if (insertError) {
                console.error('[CLOUD SYNC] Insert error:', insertError);
                throw insertError;
            }
        }

        return { success: true };
    } catch (error) {
        console.error('[CLOUD SYNC] Failed:', error);
        return { success: false, reason: 'error', error };
    }
};

/**
 * Sync all local lectures to cloud
 * Called on app startup or after regaining connectivity
 */
export const syncAllLecturesToCloud = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { success: false, synced: 0 };

    const online = await isOnline();
    if (!online) {
        return { success: false, synced: 0 };
    }

    try {
        const storedCards = await AsyncStorage.getItem(LOCAL_CARDS_KEY);
        if (!storedCards) return { success: true, synced: 0 };

        const cards = JSON.parse(storedCards);
        let synced = 0;
        let skipped = 0;
        let preparing = 0;

        for (const card of cards) {
            // Only sync ready cards (not preparing)
            if (card.status === 'ready') {
                const result = await syncLectureToCloud(card);
                if (result.success) synced++;
                else skipped++;
            } else {
                preparing++;
            }
        }

        return { success: true, synced };
    } catch (error) {
        console.error('[CLOUD SYNC] Bulk sync failed:', error);
        return { success: false, synced: 0, error };
    }
};

/**
 * Pull lectures from cloud and merge with local
 * This is called on login to get user's cloud data
 */
export const pullLecturesFromCloud = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { success: false, pulled: 0 };

    const online = await isOnline();
    if (!online) return { success: false, pulled: 0 };

    try {
        const { data: cloudLectures, error } = await supabase
            .from('lectures')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!cloudLectures || cloudLectures.length === 0) {
            return { success: true, pulled: 0 };
        }

        // Get existing local cards
        const storedCards = await AsyncStorage.getItem(LOCAL_CARDS_KEY);
        const localCards = storedCards ? JSON.parse(storedCards) : [];
        const localIdsSet = new Set(localCards.map(c => c.id));

        // Merge: Update existing and add new
        const mergedCards = localCards.map(localCard => {
            const cloudMatch = cloudLectures.find(c => c.id === localCard.id);
            if (cloudMatch) {
                // Cloud version exists - update local with cloud data
                // We preserve local-only state if needed, but for now cloud wins for sync fields
                const mapped = mapCloudToLocal(cloudMatch);
                return { ...localCard, ...mapped };
            }
            return localCard;
        });

        // Add completely new cards from cloud
        const existingIds = new Set(localCards.map(c => c.id));
        const newCards = cloudLectures
            .filter(l => !existingIds.has(l.id))
            .map(mapCloudToLocal);

        const finalCards = [...newCards, ...mergedCards];

        // Sort by date desc
        finalCards.sort((a, b) => new Date(b.date) - new Date(a.date));

        await AsyncStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify(finalCards));

        return { success: true, pulled: newCards.length, updated: cloudLectures.length };
    } catch (error) {
        console.error('[CLOUD PULL] Failed:', error);
        return { success: false, pulled: 0, error };
    }
};

/**
 * Delete a lecture from cloud
 */
export const deleteLectureFromCloud = async (lectureId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { success: false };

    const online = await isOnline();
    if (!online) return { success: false, reason: 'offline' };

    try {
        const { error } = await supabase
            .from('lectures')
            .delete()
            .eq('id', lectureId)
            .eq('user_id', user.id);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('[CLOUD DELETE] Failed:', error);
        return { success: false, error };
    }
};

/**
 * Sync Filters to Cloud
 */
export const syncFiltersToCloud = async (filters) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { success: false };
    if (!(await isOnline())) return { success: false };

    try {
        // Filter out defaults (they are hardcoded)
        const customFilters = filters.filter(f => !f.isDefault).map(f => ({
            id: f.id,
            user_id: user.id,
            name: f.name,
            icon: f.icon,
            updated_at: new Date().toISOString()
        }));

        if (customFilters.length === 0) return { success: true };

        const { error } = await supabase
            .from('filters')
            .upsert(customFilters, { onConflict: 'id' });

        if (error) {
            if (error.code === 'PGRST205') {
                console.warn('[FILTERS] Remote table missing. Skipping sync.');
                return { success: false, reason: 'table_missing' };
            }
            throw error;
        }
        console.log('[FILTERS] Synced to cloud');
        return { success: true };
    } catch (e) {
        if (e.reason === 'table_missing') return { success: false };
        console.error('[FILTERS] Sync failed:', e);
        return { success: false, error: e };
    }
};

/**
 * Pull Filters from Cloud
 */
export const pullFiltersFromCloud = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { success: false };
    if (!(await isOnline())) return { success: false };

    try {
        const { data: cloudFilters, error } = await supabase
            .from('filters')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            if (error.code === 'PGRST205') {
                console.warn('[FILTERS] Remote table missing. Skipping pull.');
                return { success: false, reason: 'table_missing' };
            }
            throw error;
        }

        // Merge with local
        const storedFilters = await AsyncStorage.getItem(LOCAL_FILTERS_KEY);
        const localFilters = storedFilters ? JSON.parse(storedFilters) : [];

        // Simple merge: Cloud wins if ID matches, else add new
        const localMap = new Map(localFilters.map(f => [f.id, f]));

        if (cloudFilters) {
            cloudFilters.forEach(cf => {
                localMap.set(cf.id, {
                    id: cf.id,
                    name: cf.name,
                    icon: cf.icon,
                    isDefault: false
                });
            });
        }

        const merged = Array.from(localMap.values());
        await AsyncStorage.setItem(LOCAL_FILTERS_KEY, JSON.stringify(merged));

        return { success: true, filters: merged };
    } catch (e) {
        console.error('[FILTERS] Pull failed:', e);
        return { success: false, error: e };
    }
};

/**
 * Sync All Data (Lectures + Filters)
 */
export const syncAllData = async () => {
    console.log('[SYNC] Starting full sync...');
    const lectures = await syncAllLecturesToCloud();
    const pulledLectures = await pullLecturesFromCloud();

    // For filters, we first read current, then sync
    const storedFilters = await AsyncStorage.getItem(LOCAL_FILTERS_KEY);
    if (storedFilters) {
        await syncFiltersToCloud(JSON.parse(storedFilters));
    }
    const pulledFilters = await pullFiltersFromCloud();

    return {
        lectures: { sent: lectures.synced, received: pulledLectures.pulled },
        filters: { success: pulledFilters.success }
    };
};

/**
 * Migrates legacy "rec_..." IDs to UUIDs
 * This ensures compatibility with Supabase primary keys
 */
export const migrateLegacyData = async () => {
    try {
        const storedCards = await AsyncStorage.getItem(LOCAL_CARDS_KEY);
        if (!storedCards) return;

        const cards = JSON.parse(storedCards);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        let modified = false;

        const migratedCards = await Promise.all(cards.map(async (card) => {
            if (!uuidRegex.test(card.id)) {
                const oldId = card.id;
                const newId = generateUUID();

                // Migrate chat history if exists
                try {
                    const chatKey = `@memry_chat_${oldId}`;
                    const chatData = await AsyncStorage.getItem(chatKey);
                    if (chatData) {
                        await AsyncStorage.setItem(`@memry_chat_${newId}`, chatData);
                        await AsyncStorage.removeItem(chatKey);
                    }
                } catch (e) {
                    console.error('[MIGRATION] Chat migration failed:', e);
                }

                modified = true;
                return { ...card, id: newId };
            }
            return card;
        }));

        if (modified) {
            await AsyncStorage.setItem(LOCAL_CARDS_KEY, JSON.stringify(migratedCards));
        }
    } catch (e) {
        console.error('[MIGRATION] ❌ Critical failure:', e);
    }
};

export default {
    syncAllData,
    syncLectureToCloud,
    syncAllLecturesToCloud,
    syncFiltersToCloud,
    pullFiltersFromCloud,
    pullLecturesFromCloud,
    deleteLectureFromCloud,
    isOnline,
};
