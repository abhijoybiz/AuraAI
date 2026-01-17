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
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { fetchLecturesFromCloud, syncLectureToCloud } from '../services/lectureStorage';
import { API_BASE_URL } from '../utils/api';

/**
 * WhiteboardScreen - Embeds tldraw editor in a WebView
 * 
 * Props:
 * - lectureId: ID of the lecture this whiteboard belongs to
 * - lectureText: Transcript or summary text for generating initial whiteboard
 * - onBack: Function to call when navigating back
 */
export default function WhiteboardScreen({
  lectureId = null,
  lectureText = '',
  onBack = null,
}) {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'pending' | 'error'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Debounce timer for auto-save
  const saveTimeoutRef = useRef(null);
  const lastSnapshotRef = useRef(null);

  /**
   * Load existing whiteboard data or initialize new one
   */
  useEffect(() => {
    if (!lectureId) {
      setIsLoading(false);
      return;
    }

    const loadWhiteboard = async () => {
      try {
        const lectures = await fetchLecturesFromCloud();
        const lecture = lectures.find(c => c.id === lectureId);

        if (lecture?.journeyMap) {
          // Has existing snapshot - will load after editor is ready
          lastSnapshotRef.current = lecture.journeyMap;
          setSyncStatus('synced');
        } else if (lectureText) {
          // No snapshot - need to generate from backend
          setSyncStatus('pending');
          await initializeFromBackend();
        }
      } catch (error) {
        console.error('Error loading whiteboard from cloud:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadWhiteboard();
  }, [lectureId, lectureText]);

  /**
   * When editor is ready, load the snapshot
   */
  useEffect(() => {
    if (isEditorReady && lastSnapshotRef.current) {
      sendToWebView('LOAD_SNAPSHOT', { snapshot: lastSnapshotRef.current });
    }
  }, [isEditorReady]);

  /**
   * Initialize whiteboard from backend API
   */
  const initializeFromBackend = async () => {
    if (!API_BASE_URL) {
      console.log('No backend URL configured, using empty whiteboard');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/whiteboard/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecture_id: lectureId,
          text: lectureText,
          user_id: 'default',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        lastSnapshotRef.current = data.tldraw_snapshot;

        // Initial cloud save
        const lectures = await fetchLecturesFromCloud();
        const lecture = lectures.find(c => c.id === lectureId);
        if (lecture) {
          await syncLectureToCloud({
            ...lecture,
            journeyMap: data.tldraw_snapshot,
            journeyMapConceptGraph: data.concept_graph
          });
        }

        setSyncStatus('synced');

        // Load into editor if ready
        if (isEditorReady) {
          sendToWebView('LOAD_SNAPSHOT', { snapshot: data.tldraw_snapshot });
        }
      }
    } catch (error) {
      console.error('Error initializing whiteboard from backend:', error);
      setSyncStatus('error');
    }
  };

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
          setIsEditorReady(true);
          break;

        case 'SNAPSHOT_READY':
          // Response to GET_SNAPSHOT request
          if (payload?.snapshot) {
            await handleSnapshotSave(payload.snapshot, true);
          }
          break;

        case 'SNAPSHOT_CHANGED':
          // Auto-save triggered by editor changes
          if (payload?.snapshot) {
            setHasUnsavedChanges(true);
            debouncedSave(payload.snapshot);
          }
          break;

        default:
          console.log('Unknown message from WebView:', type);
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  }, [lectureId]);

  /**
   * Debounced save to prevent too frequent saves
   */
  const debouncedSave = useCallback((snapshot) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSnapshotSave(snapshot, false);
    }, 2000); // 2 second debounce
  }, []);

  /**
   * Save snapshot to local storage and optionally sync to backend
   */
  const handleSnapshotSave = async (snapshot, forceSyncToBackend = false) => {
    if (!lectureId) return;

    setIsSaving(true);
    lastSnapshotRef.current = snapshot;

    try {
      const lectures = await fetchLecturesFromCloud();
      const lecture = lectures.find(c => c.id === lectureId);

      if (lecture) {
        setSyncStatus('pending');
        await syncLectureToCloud({
          ...lecture,
          journeyMap: snapshot
        });
        setSyncStatus('synced');
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving whiteboard snapshot:', error);
      setSyncStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Sync snapshot to backend (Legacy - now handled by syncLectureToCloud)
   */
  const syncToBackend = async (snapshot) => {
    // This is now integrated into syncLectureToCloud
    setSyncStatus('synced');
  };

  /**
   * Manual save button handler
   */
  const handleManualSave = () => {
    sendToWebView('GET_SNAPSHOT');
  };

  /**
   * Handle back navigation with unsaved changes warning
   */
  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Save before leaving?',
        [
          { text: 'Discard', style: 'destructive', onPress: onBack },
          { text: 'Save', onPress: () => { handleManualSave(); onBack?.(); } },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      onBack?.();
    }
  };

  /**
   * Get the tldraw bundle URL
   * In production, this would point to a hosted version or local asset
   */
  const getWhiteboardUrl = () => {
    // Development: use local Vite server
    if (__DEV__) {
      return Platform.select({
        ios: 'http://localhost:3001',
        android: 'http://10.0.2.2:3001', // Android emulator localhost
        default: 'http://localhost:3001',
      });
    }

    // Production: use bundled assets or hosted URL
    // TODO: Configure for production deployment
    return 'http://localhost:3001';
  };

  /**
   * Render sync status indicator
   */
  const renderSyncStatus = () => {
    const statusConfig = {
      synced: { color: '#4CAF50', icon: 'cloud-done', text: 'Synced' },
      pending: { color: '#FF9800', icon: 'cloud-upload', text: 'Pending' },
      error: { color: '#F44336', icon: 'cloud-offline', text: 'Offline' },
    };

    const config = statusConfig[syncStatus] || statusConfig.synced;

    return (
      <View style={styles.syncStatus}>
        <Ionicons name={config.icon} size={16} color={config.color} />
        <Text style={[styles.syncText, { color: config.color }]}>{config.text}</Text>
      </View>
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
          <Text style={styles.loadingText}>Loading whiteboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No lecture selected
  if (!lectureId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="easel-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Lecture Selected</Text>
          <Text style={styles.emptySubtitle}>
            Select a lecture to view or create its whiteboard
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Whiteboard</Text>
        <View style={styles.headerRight}>
          {renderSyncStatus()}
          <TouchableOpacity
            onPress={handleManualSave}
            style={styles.saveButton}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="save" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* WebView with tldraw */}
      <View style={styles.webViewContainer}>
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
          // Allow all origins for development
          originWhitelist={['*']}
          // Improve performance
          cacheEnabled={true}
          // Handle loading states
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#212121" />
            </View>
          )}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error:', nativeEvent);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#212121',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#f5f5f5',
  },
});

