// services/storageCloud.js
// Cloud storage service using Supabase - replaces local-only AsyncStorage
// Maintains backward compatibility with existing storage.js interface

import { supabase, getCurrentUser } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LECTURES_KEY = 'memry_ai_lectures';
const FILTERS_KEY = 'memry_ai_filters';

// Helper to sync local changes to cloud
const syncToCloud = async (lectures) => {
    const user = await getCurrentUser();
    if (!user) return; // Skip cloud sync if not authenticated

    try {
        // This is a simple sync - in production you might want more sophisticated conflict resolution
        for (const lecture of lectures) {
            const { data: existing } = await supabase
                .from('lectures')
                .select('id')
                .eq('id', lecture.id)
                .single();

            if (existing) {
                // Update existing lecture
                await supabase
                    .from('lectures')
                    .update({
                        title: lecture.title,
                        duration: lecture.duration,
                        category: lecture.category,
                        is_favorite: lecture.isFavorite,
                        transcript: lecture.transcript,
                        segments: lecture.segments,
                        summary: lecture.summary,
                        flashcards: lecture.flashcards,
                        quiz: lecture.quiz,
                        notes: lecture.notes,
                        journey_map: lecture.journeyMap,
                        audio_url: lecture.audioUri,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', lecture.id);
            } else {
                // Insert new lecture
                await supabase
                    .from('lectures')
                    .insert({
                        id: lecture.id,
                        user_id: user.id,
                        title: lecture.title,
                        duration: lecture.duration,
                        category: lecture.category,
                        is_favorite: lecture.isFavorite || false,
                        transcript: lecture.transcript,
                        segments: lecture.segments,
                        summary: lecture.summary,
                        flashcards: lecture.flashcards,
                        quiz: lecture.quiz,
                        notes: lecture.notes,
                        journey_map: lecture.journeyMap,
                        audio_url: lecture.audioUri,
                        created_at: lecture.date || new Date().toISOString()
                    });
            }
        }
    } catch (error) {
        console.error('Cloud sync error:', error);
        // Don't throw - local storage should still work even if cloud fails
    }
};

// Helper to sync from cloud to local
const syncFromCloud = async () => {
    const user = await getCurrentUser();
    if (!user) return null;

    try {
        const { data, error } = await supabase
            .from('lectures')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Convert cloud format to local format
        return data?.map(lecture => ({
            id: lecture.id,
            title: lecture.title,
            duration: lecture.duration,
            category: lecture.category,
            isFavorite: lecture.is_favorite,
            transcript: lecture.transcript,
            segments: lecture.segments,
            summary: lecture.summary,
            flashcards: lecture.flashcards,
            quiz: lecture.quiz,
            notes: lecture.notes,
            journeyMap: lecture.journey_map,
            audioUri: lecture.audio_url,
            date: lecture.created_at
        })) || [];
    } catch (error) {
        console.error('Cloud fetch error:', error);
        return null;
    }
};

export const storageCloud = {
    /**
     * Get all lectures - tries cloud first, falls back to local
     */
    async getLectures() {
        try {
            // Try to get from cloud first
            const cloudLectures = await syncFromCloud();

            if (cloudLectures !== null) {
                // Update local cache with cloud data
                await AsyncStorage.setItem(LECTURES_KEY, JSON.stringify(cloudLectures));
                return cloudLectures;
            }

            // Fall back to local storage if cloud fails or user not authenticated
            const jsonValue = await AsyncStorage.getItem(LECTURES_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Error fetching lectures', e);
            return [];
        }
    },

    /**
     * Save all lectures - saves to both local and cloud
     */
    async saveLectures(lectures) {
        try {
            const jsonValue = JSON.stringify(lectures);
            await AsyncStorage.setItem(LECTURES_KEY, jsonValue);

            // Sync to cloud in background
            syncToCloud(lectures).catch(console.error);
        } catch (e) {
            console.error('Error saving lectures', e);
        }
    },

    /**
     * Add a new lecture
     */
    async addLecture(lecture) {
        const lectures = await this.getLectures();
        const newLectures = [lecture, ...lectures];
        await this.saveLectures(newLectures);
        return newLectures;
    },

    /**
     * Update an existing lecture
     */
    async updateLecture(id, updates) {
        const lectures = await this.getLectures();
        const updatedLectures = lectures.map(l => l.id === id ? { ...l, ...updates } : l);
        await this.saveLectures(updatedLectures);
        return updatedLectures;
    },

    /**
     * Delete a lecture
     */
    async deleteLecture(id) {
        const lectures = await this.getLectures();
        const filteredLectures = lectures.filter(l => l.id !== id);
        await this.saveLectures(filteredLectures);

        // Also delete from cloud
        const user = await getCurrentUser();
        if (user) {
            supabase
                .from('lectures')
                .delete()
                .eq('id', id)
                .then(() => console.log('Deleted from cloud'))
                .catch(console.error);
        }

        return filteredLectures;
    },

    /**
     * Get filter categories
     */
    async getFilters() {
        try {
            const jsonValue = await AsyncStorage.getItem(FILTERS_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : ["All", "Favorites"];
        } catch (e) {
            console.error('Error fetching filters', e);
            return ["All", "Favorites"];
        }
    },

    /**
     * Save filter categories
     */
    async saveFilters(filters) {
        try {
            const jsonValue = JSON.stringify(filters);
            await AsyncStorage.setItem(FILTERS_KEY, jsonValue);
        } catch (e) {
            console.error('Error saving filters', e);
        }
    },

    /**
     * Force sync from cloud (useful after login)
     */
    async forceCloudSync() {
        const cloudLectures = await syncFromCloud();
        if (cloudLectures !== null) {
            await AsyncStorage.setItem(LECTURES_KEY, JSON.stringify(cloudLectures));
            return cloudLectures;
        }
        return null;
    }
};

export default storageCloud;
