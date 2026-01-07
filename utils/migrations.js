/**
 * Data migration utilities for lecture schema updates.
 * 
 * These functions ensure backward compatibility when new fields
 * are added to the lecture data model.
 */

/**
 * Current schema version.
 * Increment this when making breaking changes to the data model.
 */
export const SCHEMA_VERSION = 2;

/**
 * Migrate a single lecture to the current schema.
 * Adds whiteboard-related fields if they don't exist.
 * 
 * @param {Object} lecture - The lecture object to migrate
 * @returns {Object} - The migrated lecture object
 */
export const migrateLectureSchema = (lecture) => {
  if (!lecture) return null;
  
  return {
    ...lecture,
    // Whiteboard fields (added in v2)
    whiteboardSnapshot: lecture.whiteboardSnapshot ?? null,
    conceptGraph: lecture.conceptGraph ?? null,
    whiteboardSyncStatus: lecture.whiteboardSyncStatus ?? 'synced',
    lastWhiteboardSync: lecture.lastWhiteboardSync ?? null,
    // Ensure schema version is set
    schemaVersion: SCHEMA_VERSION,
  };
};

/**
 * Migrate an array of lectures to the current schema.
 * 
 * @param {Array} lectures - Array of lecture objects
 * @returns {Array} - Array of migrated lecture objects
 */
export const migrateLectures = (lectures) => {
  if (!Array.isArray(lectures)) return [];
  return lectures.map(migrateLectureSchema).filter(Boolean);
};

/**
 * Check if a lecture needs migration.
 * 
 * @param {Object} lecture - The lecture to check
 * @returns {boolean} - True if migration is needed
 */
export const needsMigration = (lecture) => {
  if (!lecture) return false;
  
  // Check for missing whiteboard fields
  const hasWhiteboardFields = 
    'whiteboardSnapshot' in lecture &&
    'conceptGraph' in lecture &&
    'whiteboardSyncStatus' in lecture;
    
  // Check schema version
  const hasCurrentVersion = lecture.schemaVersion === SCHEMA_VERSION;
  
  return !hasWhiteboardFields || !hasCurrentVersion;
};

/**
 * Default lecture object with all fields.
 * Use this as a template when creating new lectures.
 */
export const createDefaultLecture = (overrides = {}) => ({
  id: null,
  title: 'New Lecture',
  date: new Date().toISOString(),
  duration: '0min',
  category: null,
  isFavorite: false,
  image: null,
  
  // Audio/Transcript fields
  audioUri: null,
  transcribedText: '',
  transcriptSegments: [],
  
  // AI-generated content
  summary: '',
  flashcards: [],
  
  // Whiteboard fields (v2)
  whiteboardSnapshot: null,
  conceptGraph: null,
  whiteboardSyncStatus: 'synced', // 'synced' | 'pending' | 'error'
  lastWhiteboardSync: null,
  
  // Metadata
  schemaVersion: SCHEMA_VERSION,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  
  ...overrides,
});

