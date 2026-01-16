// services/backgroundRecording.js
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const NOTIFICATION_ID = 'recording-notification';
const CHANNEL_ID = 'recording';

/**
 * Configure notification behavior
 */
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.warn('[RecordingService] Notifications setup failed:', e);
}

/**
 * Define interactive controls for the notification
 */
export const setupNotificationCategories = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationCategoryAsync('recording_controls', [
      {
        identifier: 'PAUSE_ACTION',
        buttonTitle: 'Pause Recording',
        options: { opensAppToResponse: false },
      },
      {
        identifier: 'RESUME_ACTION',
        buttonTitle: 'Resume Recording',
        options: { opensAppToResponse: false },
      },
      {
        identifier: 'STOP_ACTION',
        buttonTitle: 'Stop & Save',
        options: { opensAppToResponse: true },
      },
    ]);
  } catch (e) {
    console.warn('[RecordingService] Categories setup failed:', e);
  }
};

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (e) {
    console.warn('[RecordingService] Permission request failed:', e);
    return false;
  }
};

/**
 * Configure audio for background recording
 */
export const configureBackgroundAudio = async () => {
  try {
    // Ensure we reset to a clean state first if needed
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: 1, // MixWithOthers (Required for some background scenarios)
      interruptionModeAndroid: 1, // DoNotMix
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    console.log('[RecordingService] Audio mode configured');
    // Small delay to allow native OS to switch audio routes
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (e) {
    console.error('[RecordingService] Audio config failed:', e);
    // Continue anyway - better to try recording than to crash
  }
};

/**
 * Show/Update the persistent notification
 */
export const showRecordingNotification = async (isPaused = false) => {
  if (Platform.OS !== 'android') return;

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[RecordingService] No notification permissions');
      return;
    }

    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recording Service',
      importance: 4, // AndroidImportance.HIGH
      lockscreenVisibility: 1, // PUBLIC
      sound: false,
      vibrationPattern: [0, 0],
      enableVibration: false,
    });

    await Notifications.scheduleNotificationAsync({
      content: {
        title: isPaused ? 'Recording Paused' : 'Recording in Progress',
        body: isPaused ? 'Resume to continue capturing' : 'Memry is capturing your lecture...',
        sticky: true,
        autoDismiss: false,
        color: '#0f172a',
        categoryIdentifier: 'recording_controls',
      },
      trigger: null,
      identifier: NOTIFICATION_ID,
    });
  } catch (e) {
    console.warn('[RecordingService] Notification failed:', e);
  }
};

/**
 * Dismiss the recording notification
 */
export const dismissRecordingNotification = async () => {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch (e) {
    // Silent fail
  }
};

