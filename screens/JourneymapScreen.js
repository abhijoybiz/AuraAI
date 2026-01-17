import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { ChevronLeft, RefreshCw, Save, CloudOff, Cloud, Loader2, Sparkles, Route } from 'lucide-react-native';
import { fetchLecturesFromCloud, syncLectureToCloud } from '../services/lectureStorage';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';
import { API_BASE_URL } from '../utils/api';

const { width } = Dimensions.get('window');

/**
 * JourneymapScreen - AI-powered Mind Map Generator
 * 
 * This screen:
 * 1. Automatically generates a mind map from lecture transcription
 * 2. Embeds a tldraw whiteboard for visualization
 * 3. Persists data locally and syncs with backend
 * 4. Supports regeneration and manual saving
 */
export default function JourneymapScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { isOffline } = useNetwork();
  const { transcript, id: lectureId } = route.params || {};

  // Refs
  const webViewRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const lastSnapshotRef = useRef(null);

  // State
  const [status, setStatus] = useState('idle'); // 'idle' | 'generating' | 'loading' | 'ready' | 'error'
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'pending' | 'error'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [conceptGraph, setConceptGraph] = useState(null);
  const [hasExistingMap, setHasExistingMap] = useState(false);

  // Animation for generating state
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'generating') {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [status]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  /**
   * Load existing journey map or initialize new one
   */
  useEffect(() => {
    const initializeJourneyMap = async () => {
      if (!lectureId) {
        setStatus('error');
        setErrorMessage('No lecture ID provided');
        return;
      }

      try {
        setStatus('loading');

        // Check cloud storage for existing journey map
        const lectures = await fetchLecturesFromCloud();
        const lecture = lectures.find(c => c.id === lectureId);

        if (lecture?.journeyMap) {
          lastSnapshotRef.current = lecture.journeyMap;
          setConceptGraph(lecture.journeyMapConceptGraph || null);
          setSyncStatus('synced');
          setHasExistingMap(true);
          setStatus('ready');
          return;
        }

        // Check if transcript is available
        if (!transcript || transcript.trim().length === 0) {
          setStatus('error');
          setErrorMessage('No transcript available to generate journey map. Please ensure the lecture has been transcribed first.');
          return;
        }

        // Try to load from backend
        const backendData = await loadFromBackend();
        if (backendData) {
          setHasExistingMap(true);
          setStatus('ready');
          return;
        }

        // No existing map - generate new one
        await generateJourneyMap();

      } catch (error) {
        console.error('[JOURNEYMAP] Initialization error:', error);
        setStatus('error');
        setErrorMessage('Failed to load journey map. Please try again.');
      }
    };

    initializeJourneyMap();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [lectureId, transcript]);

  /**
   * Load journey map from backend
   */
  const loadFromBackend = async () => {
    if (!API_BASE_URL) return null;

    try {
      const url = `${API_BASE_URL}/whiteboard/get/${lectureId}?user_id=default`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.exists && data.tldraw_snapshot) {
          lastSnapshotRef.current = data.tldraw_snapshot;
          setConceptGraph(data.concept_graph || null);

          // Save to local storage
          await saveToLocalStorage(data.tldraw_snapshot, data.concept_graph, 'synced');
          setSyncStatus('synced');
          return data;
        }
      }
    } catch (error) {
      console.error('[JOURNEYMAP] Error loading from backend:', error);
    }
    return null;
  };

  /**
   * Generate journey map from transcription
   */
  const generateJourneyMap = async () => {
    if (isOffline) {
      Alert.alert(
        'Offline Mode',
        'Generating a journey map requires an internet connection. Please connect and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!transcript || transcript.trim().length === 0) {
      setStatus('error');
      setErrorMessage('No transcript available to generate journey map.');
      return;
    }

    setStatus('generating');
    setErrorMessage('');

    try {
      // Use the backend API for generation
      if (API_BASE_URL) {
        const url = `${API_BASE_URL}/whiteboard/generate-mindmap`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: transcript,
            session_id: lectureId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[JOURNEYMAP] Generated mind map from backend');

          lastSnapshotRef.current = data.tldraw_snapshot;
          setConceptGraph(data.concept_graph);

          // Save to local storage
          await saveToLocalStorage(data.tldraw_snapshot, data.concept_graph, 'synced');
          setSyncStatus('synced');
          setHasExistingMap(true);
          setStatus('ready');

          // Load into editor if ready
          if (isEditorReady && webViewRef.current) {
            sendToWebView('LOAD_SNAPSHOT', { snapshot: data.tldraw_snapshot });
          }
          return;
        } else {
          throw new Error(`Backend returned ${response.status}`);
        }
      } else {
        // Fallback: Generate locally if no backend
        console.log('[JOURNEYMAP] No backend available, cannot generate mind map');
        setStatus('error');
        setErrorMessage('Backend not available. Please ensure the server is running.');
      }
    } catch (error) {
      console.error('[JOURNEYMAP] Error generating journey map:', error);
      setStatus('error');
      setErrorMessage(`Failed to generate journey map: ${error.message}`);
    }
  };

  /**
   * Save to cloud storage
   */
  const saveToLocalStorage = async (snapshot, graph, syncStatusVal) => {
    try {
      const lectures = await fetchLecturesFromCloud();
      const lecture = lectures.find(c => c.id === lectureId);

      if (lecture) {
        const updatedLecture = {
          ...lecture,
          journeyMap: snapshot,
          journeyMapConceptGraph: graph,
          journeyMapUpdatedAt: new Date().toISOString(),
        };
        await syncLectureToCloud(updatedLecture);
      }
    } catch (error) {
      console.error('[JOURNEYMAP] Error saving to cloud:', error);
    }
  };

  /**
   * When editor is ready, load the snapshot
   */
  useEffect(() => {
    if (isEditorReady && lastSnapshotRef.current && status === 'ready') {
      sendToWebView('LOAD_SNAPSHOT', { snapshot: lastSnapshotRef.current });
    }
  }, [isEditorReady, status]);

  /**
   * Send message to WebView
   */
  const sendToWebView = useCallback((type, payload = {}) => {
    if (webViewRef.current) {
      const message = JSON.stringify({ type, payload });
      webViewRef.current.postMessage(message);
    }
  }, []);

  /**
   * Handle messages from WebView
   */
  const handleWebViewMessage = useCallback(async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      const { type, payload } = data;

      switch (type) {
        case 'EDITOR_READY':
          console.log('[JOURNEYMAP] Editor ready');
          setIsEditorReady(true);
          break;

        case 'SNAPSHOT_READY':
          if (payload?.snapshot) {
            await handleSnapshotSave(payload.snapshot, true);
          }
          break;

        case 'SNAPSHOT_CHANGED':
          if (payload?.snapshot) {
            setHasUnsavedChanges(true);
            debouncedSave(payload.snapshot);
          }
          break;

        default:
          console.log('[JOURNEYMAP] Unknown message:', type);
      }
    } catch (error) {
      console.error('[JOURNEYMAP] Error handling WebView message:', error);
    }
  }, [lectureId]);

  /**
   * Debounced save
   */
  const debouncedSave = useCallback((snapshot) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSnapshotSave(snapshot, false);
    }, 2000);
  }, []);

  /**
   * Save snapshot
   */
  const handleSnapshotSave = async (snapshot, forceSyncToBackend = false) => {
    if (!lectureId) return;

    setIsSaving(true);
    lastSnapshotRef.current = snapshot;

    try {
      // Save locally first
      await saveToLocalStorage(snapshot, conceptGraph, 'pending');
      setHasUnsavedChanges(false);

      // Try to sync to backend
      if (forceSyncToBackend && API_BASE_URL) {
        await syncToBackend(snapshot);
      } else {
        setSyncStatus('pending');
      }
    } catch (error) {
      console.error('[JOURNEYMAP] Error saving snapshot:', error);
      setSyncStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Sync to backend
   */
  const syncToBackend = async (snapshot) => {
    if (!API_BASE_URL || isOffline) {
      if (isOffline) setSyncStatus('error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/whiteboard/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_id: lectureId,
          tldraw_snapshot: snapshot,
          user_id: 'default',
        }),
      });

      if (response.ok) {
        await saveToLocalStorage(snapshot, conceptGraph, 'synced');
        setSyncStatus('synced');
        console.log('[JOURNEYMAP] Synced to backend');
      } else {
        throw new Error('Backend sync failed');
      }
    } catch (error) {
      console.error('[JOURNEYMAP] Error syncing to backend:', error);
      setSyncStatus('pending');
    }
  };

  /**
   * Manual save handler
   */
  const handleManualSave = () => {
    sendToWebView('GET_SNAPSHOT');
  };

  /**
   * Handle regeneration
   */
  const handleRegenerate = () => {
    Alert.alert(
      'Regenerate Journey Map',
      'This will replace the current journey map with a new one generated from the lecture transcription. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: () => generateJourneyMap() },
      ]
    );
  };

  /**
   * Handle back navigation
   */
  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Save before leaving?',
        [
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
          { text: 'Save', onPress: () => { handleManualSave(); navigation.goBack(); } },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  /**
   * Get whiteboard URL
   */
  const getWhiteboardUrl = () => {
    if (__DEV__) {
      // If API_BASE_URL is a custom IP (from .env), use that same IP but on port 3001
      if (API_BASE_URL && !API_BASE_URL.includes('localhost') && !API_BASE_URL.includes('10.0.2.2')) {
        try {
          const urlObj = new URL(API_BASE_URL);
          return `http://${urlObj.hostname}:3001`;
        } catch (e) {
          console.error('[JOURNEYMAP] Failed to parse API_BASE_URL for whiteboard:', e);
        }
      }

      return Platform.select({
        ios: 'http://localhost:3001',
        android: 'http://10.0.2.2:3001',
        default: 'http://localhost:3001',
      });
    }
    return 'http://localhost:3001';
  };

  /**
   * Render sync status indicator
   */
  const renderSyncStatus = () => {
    const statusConfig = {
      synced: { color: colors.success, icon: Cloud, text: 'Synced' },
      pending: { color: '#F97316', icon: CloudOff, text: 'Pending' },
      error: { color: colors.error, icon: CloudOff, text: 'Offline' },
    };

    const config = statusConfig[syncStatus] || statusConfig.synced;
    const IconComponent = config.icon;

    return (
      <View style={styles.syncStatus}>
        <IconComponent size={14} color={config.color} />
        <Text style={[styles.syncText, { color: config.color }]}>{config.text}</Text>
      </View>
    );
  };

  /**
   * Render loading/generating state
   */
  const renderLoadingState = () => {
    const isGenerating = status === 'generating';

    return (
      <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
        <Animated.View style={isGenerating ? { transform: [{ rotate: spinInterpolate }] } : {}}>
          {isGenerating ? (
            <Sparkles size={64} color={colors.primary} strokeWidth={1.5} />
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </Animated.View>
        <Text style={[styles.loadingTitle, { color: colors.text }]}>
          {isGenerating ? 'Generating Journey Map' : 'Loading Journey Map'}
        </Text>
        <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
          {isGenerating
            ? 'AI is analyzing your lecture and creating a visual mind map...'
            : 'Please wait while we load your journey map...'}
        </Text>
        {isGenerating && (
          <View style={[styles.progressContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.progressBar, { backgroundColor: colors.primary }]} />
          </View>
        )}
      </View>
    );
  };

  /**
   * Render error state
   */
  const renderErrorState = () => (
    <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
      <Route size={64} color={colors.textSecondary} strokeWidth={1.5} />
      <Text style={[styles.errorTitle, { color: colors.text }]}>
        Unable to Load Journey Map
      </Text>
      <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
        {errorMessage || 'An unexpected error occurred.'}
      </Text>
      {transcript && transcript.trim().length > 0 && (
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => generateJourneyMap()}
          >
            <RefreshCw size={18} color={isDark ? colors.background : '#FFF'} />
            <Text style={[styles.retryButtonText, { color: isDark ? colors.background : '#FFF' }]}>
              Try Again
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.tint, marginTop: 0 }]}
            onPress={async () => {
              try {
                const url = `${API_BASE_URL}/health`;
                const res = await fetch(url);
                const data = await res.json();
                Alert.alert("Success", `Backend is reachable!\nStatus: ${data.status}`);
              } catch (e) {
                Alert.alert("Connection Failed", `Still cannot reach backend at ${API_BASE_URL}`);
              }
            }}
          >
            <ActivityIndicator size="small" color={colors.text} style={{ marginRight: 4 }} />
            <Text style={[styles.retryButtonText, { color: colors.text }]}>
              Check Connection
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        style={[styles.backLinkButton]}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>
          Go Back
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render no lecture state
   */
  const renderNoLectureState = () => (
    <View style={[styles.centeredContainer, { backgroundColor: colors.background }]}>
      <Route size={64} color={colors.textSecondary} strokeWidth={1.5} />
      <Text style={[styles.errorTitle, { color: colors.text }]}>No Lecture Selected</Text>
      <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
        Select a lecture to view or create its journey map
      </Text>
      <TouchableOpacity
        style={[styles.backLinkButton]}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>
          Go Back
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render based on state
  if (!lectureId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderNoLectureState()}
      </SafeAreaView>
    );
  }

  if (status === 'loading' || status === 'generating') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Journey Map</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        {renderLoadingState()}
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Journey Map</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        {renderErrorState()}
      </SafeAreaView>
    );
  }

  // Ready state with WebView
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Journey Map</Text>
        <View style={styles.headerRight}>
          {renderSyncStatus()}
          <TouchableOpacity
            onPress={handleRegenerate}
            style={[styles.iconButton, { backgroundColor: colors.tint }]}
          >
            <RefreshCw size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleManualSave}
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={isDark ? colors.background : '#FFF'} />
            ) : (
              <Save size={18} color={isDark ? colors.background : '#FFF'} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* WebView with tldraw */}
      <View style={[styles.webViewContainer, { backgroundColor: colors.card }]}>
        <WebView
          ref={webViewRef}
          source={{ uri: getWhiteboardUrl() }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['*']}
          cacheEnabled={true}
          renderLoading={() => (
            <View style={[styles.webViewLoading, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.webViewLoadingText, { color: colors.textSecondary }]}>
                Loading whiteboard editor...
              </Text>
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('[JOURNEYMAP] WebView error:', nativeEvent);
            Alert.alert(
              'Whiteboard Error',
              'Failed to load the whiteboard editor. Please ensure the whiteboard server is running.',
              [{ text: 'OK' }]
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginTop: Platform.OS === 'android' ? 20 : 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerPlaceholder: {
    width: 40,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  syncText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginTop: 24,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  progressContainer: {
    width: width - 80,
    height: 6,
    borderRadius: 3,
    marginTop: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  progressBar: {
    height: '100%',
    width: '60%',
    borderRadius: 3,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginTop: 24,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  backLinkButton: {
    marginTop: 16,
    padding: 8,
  },
  backLinkText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  webViewContainer: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewLoadingText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
});
