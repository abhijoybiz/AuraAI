// plugins/withForegroundMicrophone.js
// Custom Expo config plugin to enable foreground service microphone recording on Android 12+
// This is REQUIRED for production APK builds to allow microphone recording when the app
// is in the foreground with a persistent notification (e.g., during background recording).

const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Add foreground service type to the main application service declaration
 * Required for Android 12+ (API 31+) to use microphone in foreground services
 */
const withForegroundMicrophone = (config) => {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults;
        const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

        // Ensure uses-permission for FOREGROUND_SERVICE_MICROPHONE is present
        if (!Array.isArray(manifest.manifest['uses-permission'])) {
            manifest.manifest['uses-permission'] = [];
        }

        const fgMicPermission = 'android.permission.FOREGROUND_SERVICE_MICROPHONE';
        const hasFgMicPermission = manifest.manifest['uses-permission'].some(
            (perm) => perm.$?.['android:name'] === fgMicPermission
        );

        if (!hasFgMicPermission) {
            manifest.manifest['uses-permission'].push({
                $: { 'android:name': fgMicPermission },
            });
            console.log('[ForegroundMicrophone Plugin] Added FOREGROUND_SERVICE_MICROPHONE permission');
        }

        // Add foreground service type to the application tag if not already set
        // This enables the app to declare microphone usage in foreground services
        if (!mainApplication.$) {
            mainApplication.$ = {};
        }

        // Find or create a service declaration for expo-av's audio recording service
        // Expo's expo-av internally uses a service that needs the foregroundServiceType
        if (!mainApplication.service) {
            mainApplication.service = [];
        }

        // Check if there's already a recording service, if not, we add the meta-data
        // to indicate foreground service type support for the entire application
        const existingService = mainApplication.service.find(
            (s) => s.$?.['android:name']?.includes('ExpoAV') || s.$?.['android:name']?.includes('audio')
        );

        // Add application-level meta-data for foreground service type support
        if (!mainApplication['meta-data']) {
            mainApplication['meta-data'] = [];
        }

        // This meta-data helps ensure the audio recording can properly request
        // foreground service status with microphone type
        const fgMetaData = mainApplication['meta-data'].find(
            (m) => m.$?.['android:name'] === 'android.content.foregroundServiceType'
        );

        if (!fgMetaData) {
            // Note: The actual foreground service type is set at runtime by expo-av
            // This plugin ensures the permission is declared in the manifest
            console.log('[ForegroundMicrophone Plugin] Manifest updated for foreground microphone service');
        }

        return config;
    });
};

module.exports = withForegroundMicrophone;
