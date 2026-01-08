/**
 * Storage utilities for lecture data with migration support.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateLectures, migrateLectureSchema, SCHEMA_VERSION } from './migrations';

const LECTURES_KEY = '@memry/lectures';
const SCHEMA_VERSION_KEY = '@memry/schema_version';

/**
 * Load all lectures from storage, applying migrations if needed.
 * 
 * @returns {Promise<Array>} - Array of lecture objects
 */
export const loadLectures = async () => {
  try {
    const lecturesJson = await AsyncStorage.getItem(LECTURES_KEY);
    if (!lecturesJson) return [];
    
    const lectures = JSON.parse(lecturesJson);
    
    // Check if migration is needed
    const storedVersion = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    const needsMigration = !storedVersion || parseInt(storedVersion, 10) < SCHEMA_VERSION;
    
    if (needsMigration) {
      console.log(`Migrating lectures from v${storedVersion || 1} to v${SCHEMA_VERSION}`);
      const migratedLectures = migrateLectures(lectures);
      
      // Save migrated data
      await AsyncStorage.setItem(LECTURES_KEY, JSON.stringify(migratedLectures));
      await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
      
      return migratedLectures;
    }
    
    return lectures;
  } catch (error) {
    console.error('Error loading lectures:', error);
    return [];
  }
};

/**
 * Save all lectures to storage.
 * 
 * @param {Array} lectures - Array of lecture objects
 * @returns {Promise<boolean>} - True if save was successful
 */
export const saveLectures = async (lectures) => {
  try {
    await AsyncStorage.setItem(LECTURES_KEY, JSON.stringify(lectures));
    await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
    return true;
  } catch (error) {
    console.error('Error saving lectures:', error);
    return false;
  }
};

/**
 * Save or update a single lecture.
 * 
 * @param {Object} lecture - The lecture to save
 * @returns {Promise<string>} - The lecture ID
 */
export const saveLecture = async (lecture) => {
  try {
    const lectures = await loadLectures();
    const migratedLecture = migrateLectureSchema({
      ...lecture,
      id: lecture.id || `lecture_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    });
    
    const existingIndex = lectures.findIndex(l => l.id === migratedLecture.id);
    
    if (existingIndex >= 0) {
      lectures[existingIndex] = migratedLecture;
    } else {
      lectures.unshift(migratedLecture); // Add to beginning
    }
    
    await saveLectures(lectures);
    return migratedLecture.id;
  } catch (error) {
    console.error('Error saving lecture:', error);
    throw error;
  }
};

/**
 * Get a single lecture by ID.
 * 
 * @param {string} lectureId - The lecture ID
 * @returns {Promise<Object|null>} - The lecture or null if not found
 */
export const getLecture = async (lectureId) => {
  try {
    const lectures = await loadLectures();
    return lectures.find(l => l.id === lectureId) || null;
  } catch (error) {
    console.error('Error getting lecture:', error);
    return null;
  }
};

/**
 * Delete a lecture by ID.
 * 
 * @param {string} lectureId - The lecture ID to delete
 * @returns {Promise<boolean>} - True if deletion was successful
 */
export const deleteLecture = async (lectureId) => {
  try {
    const lectures = await loadLectures();
    const filtered = lectures.filter(l => l.id !== lectureId);
    await saveLectures(filtered);
    return true;
  } catch (error) {
    console.error('Error deleting lecture:', error);
    return false;
  }
};

/**
 * Update whiteboard data for a lecture.
 * 
 * @param {string} lectureId - The lecture ID
 * @param {Object} whiteboardData - The whiteboard data to save
 * @returns {Promise<boolean>} - True if update was successful
 */
export const updateWhiteboard = async (lectureId, whiteboardData) => {
  try {
    const lectures = await loadLectures();
    const index = lectures.findIndex(l => l.id === lectureId);
    
    if (index < 0) return false;
    
    lectures[index] = {
      ...lectures[index],
      ...whiteboardData,
      updatedAt: new Date().toISOString(),
    };
    
    await saveLectures(lectures);
    return true;
  } catch (error) {
    console.error('Error updating whiteboard:', error);
    return false;
  }
};

