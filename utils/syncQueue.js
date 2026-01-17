/**
 * Sync Queue - Manages pending whiteboard saves for offline support
 * 
 * When the user is offline, whiteboard changes are queued locally.
 * When the app comes back online, the queue is processed automatically.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { updateWhiteboard } from './storage';
import { API_BASE_URL, saveWhiteboard, checkBackendHealth } from './api';

const SYNC_QUEUE_KEY = '@memry/whiteboard_sync_queue';
const SYNC_LOCK_KEY = '@memry/sync_lock';

/**
 * Sync Queue Manager
 */
export const SyncQueue = {
  /**
   * Add an item to the sync queue
   * 
   * @param {string} lectureId - The lecture ID
   * @param {Object} snapshot - The tldraw snapshot to sync
   */
  async add(lectureId, snapshot) {
    try {
      const queue = await this.getQueue();
      
      // Update existing entry or add new one
      const existingIndex = queue.findIndex(item => item.lectureId === lectureId);
      const queueItem = {
        lectureId,
        snapshot,
        timestamp: Date.now(),
        attempts: 0,
      };
      
      if (existingIndex >= 0) {
        queue[existingIndex] = queueItem;
      } else {
        queue.push(queueItem);
      }
      
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      
      // Update local status
      await updateWhiteboard(lectureId, {
        whiteboardSyncStatus: 'pending',
      });
      
      console.log(`[SyncQueue] Added lecture ${lectureId} to sync queue`);
    } catch (error) {
      console.error('[SyncQueue] Error adding to queue:', error);
    }
  },

  /**
   * Get all items in the sync queue
   * 
   * @returns {Promise<Array>} - Array of queue items
   */
  async getQueue() {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('[SyncQueue] Error getting queue:', error);
      return [];
    }
  },

  /**
   * Clear a specific lecture from the queue
   * 
   * @param {string} lectureId - The lecture ID to clear
   */
  async clear(lectureId) {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(item => item.lectureId !== lectureId);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
      console.log(`[SyncQueue] Cleared lecture ${lectureId} from queue`);
    } catch (error) {
      console.error('[SyncQueue] Error clearing item:', error);
    }
  },

  /**
   * Clear all items from the queue
   */
  async clearAll() {
    try {
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      console.log('[SyncQueue] Cleared entire queue');
    } catch (error) {
      console.error('[SyncQueue] Error clearing queue:', error);
    }
  },

  /**
   * Get the count of pending items
   * 
   * @returns {Promise<number>} - Number of pending items
   */
  async getPendingCount() {
    const queue = await this.getQueue();
    return queue.length;
  },

  /**
   * Process all pending items in the queue
   * 
   * @returns {Promise<Object>} - Results of processing { success: number, failed: number }
   */
  async processPending() {
    // Prevent concurrent processing
    const isLocked = await AsyncStorage.getItem(SYNC_LOCK_KEY);
    if (isLocked === 'true') {
      console.log('[SyncQueue] Sync already in progress, skipping');
      return { success: 0, failed: 0 };
    }

    // Check network status
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      console.log('[SyncQueue] No network connection, skipping sync');
      return { success: 0, failed: 0 };
    }

    // Check backend availability
    const backendAvailable = await checkBackendHealth();
    if (!backendAvailable) {
      console.log('[SyncQueue] Backend not available, skipping sync');
      return { success: 0, failed: 0 };
    }

    try {
      // Lock processing
      await AsyncStorage.setItem(SYNC_LOCK_KEY, 'true');

      const queue = await this.getQueue();
      if (queue.length === 0) {
        return { success: 0, failed: 0 };
      }

      console.log(`[SyncQueue] Processing ${queue.length} pending items`);

      let success = 0;
      let failed = 0;
      const updatedQueue = [];

      for (const item of queue) {
        try {
          await saveWhiteboard(item.lectureId, item.snapshot);
          
          // Update local status
          await updateWhiteboard(item.lectureId, {
            whiteboardSyncStatus: 'synced',
            lastWhiteboardSync: new Date().toISOString(),
          });
          
          success++;
          console.log(`[SyncQueue] Successfully synced lecture ${item.lectureId}`);
        } catch (error) {
          console.error(`[SyncQueue] Failed to sync lecture ${item.lectureId}:`, error);
          
          // Increment attempts and keep in queue
          item.attempts++;
          
          // Remove after max attempts (5)
          if (item.attempts < 5) {
            updatedQueue.push(item);
          } else {
            // Mark as error after max attempts
            await updateWhiteboard(item.lectureId, {
              whiteboardSyncStatus: 'error',
            });
          }
          
          failed++;
        }
      }

      // Save updated queue
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));

      return { success, failed };
    } finally {
      // Release lock
      await AsyncStorage.removeItem(SYNC_LOCK_KEY);
    }
  },
};

/**
 * Network listener for automatic sync
 */
let networkUnsubscribe = null;

/**
 * Start listening for network changes to auto-sync
 */
export const startSyncListener = () => {
  if (networkUnsubscribe) return;

  networkUnsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('[SyncQueue] Network restored, processing pending sync');
      const results = await SyncQueue.processPending();
      if (results.success > 0 || results.failed > 0) {
        console.log(`[SyncQueue] Sync complete: ${results.success} success, ${results.failed} failed`);
      }
    }
  });

  console.log('[SyncQueue] Network listener started');
};

/**
 * Stop the network listener
 */
export const stopSyncListener = () => {
  if (networkUnsubscribe) {
    networkUnsubscribe();
    networkUnsubscribe = null;
    console.log('[SyncQueue] Network listener stopped');
  }
};

/**
 * Manual trigger to sync all pending items
 */
export const syncNow = async () => {
  return SyncQueue.processPending();
};

