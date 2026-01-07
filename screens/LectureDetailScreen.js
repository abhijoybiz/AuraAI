import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WhiteboardScreen from './WhiteboardScreen';
import { getLecture } from '../utils/storage';

/**
 * LectureDetailScreen - View lecture details with tabs for different content
 * 
 * Tabs:
 * - Transcript: View the transcribed text with timestamps
 * - Summary: View AI-generated summary
 * - Flashcards: Study with AI-generated flashcards
 * - Whiteboard: Interactive concept map
 */
export default function LectureDetailScreen({ route, navigation }) {
  const { lectureId } = route?.params || {};
  
  const [lecture, setLecture] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transcript');
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  useEffect(() => {
    loadLecture();
  }, [lectureId]);

  const loadLecture = async () => {
    if (!lectureId) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await getLecture(lectureId);
      setLecture(data);
    } catch (error) {
      console.error('Error loading lecture:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation?.goBack();
  };

  // Tabs configuration
  const tabs = [
    { id: 'transcript', label: 'Transcript', icon: 'document-text' },
    { id: 'summary', label: 'Summary', icon: 'list' },
    { id: 'flashcards', label: 'Flashcards', icon: 'albums' },
    { id: 'whiteboard', label: 'Whiteboard', icon: 'easel' },
  ];

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'transcript':
        return renderTranscript();
      case 'summary':
        return renderSummary();
      case 'flashcards':
        return renderFlashcards();
      case 'whiteboard':
        return (
          <WhiteboardScreen
            lectureId={lectureId}
            lectureText={lecture?.transcribedText || lecture?.summary || ''}
          />
        );
      default:
        return null;
    }
  };

  const renderTranscript = () => {
    const segments = lecture?.transcriptSegments || [];
    const text = lecture?.transcribedText || '';

    if (!text && segments.length === 0) {
      return (
        <View style={styles.emptyContent}>
          <Ionicons name="document-text-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No transcript available</Text>
        </View>
      );
    }

    if (segments.length > 0) {
      return (
        <ScrollView style={styles.scrollContent}>
          {segments.map((segment, index) => (
            <View key={index} style={styles.transcriptSegment}>
              <TouchableOpacity style={styles.timestamp}>
                <Text style={styles.timestampText}>
                  {formatTimestamp(segment.start)}
                </Text>
              </TouchableOpacity>
              <Text style={styles.segmentText}>{segment.text}</Text>
            </View>
          ))}
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.scrollContent}>
        <Text style={styles.transcriptText}>{text}</Text>
      </ScrollView>
    );
  };

  const renderSummary = () => {
    const summary = lecture?.summary || '';

    if (!summary) {
      return (
        <View style={styles.emptyContent}>
          <Ionicons name="list-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No summary available</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContent}>
        <Text style={styles.summaryText}>{summary}</Text>
      </ScrollView>
    );
  };

  const renderFlashcards = () => {
    const flashcards = lecture?.flashcards || [];

    if (flashcards.length === 0) {
      return (
        <View style={styles.emptyContent}>
          <Ionicons name="albums-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No flashcards available</Text>
        </View>
      );
    }

    const currentCard = flashcards[currentFlashcardIndex];

    return (
      <View style={styles.flashcardContainer}>
        <TouchableOpacity
          style={styles.flashcard}
          onPress={() => setShowFlashcardAnswer(!showFlashcardAnswer)}
        >
          <Text style={styles.flashcardLabel}>
            {showFlashcardAnswer ? 'Answer' : 'Question'}
          </Text>
          <Text style={styles.flashcardContent}>
            {showFlashcardAnswer ? currentCard.answer : currentCard.question}
          </Text>
          <Text style={styles.flashcardHint}>Tap to flip</Text>
        </TouchableOpacity>

        <View style={styles.flashcardNav}>
          <TouchableOpacity
            style={[styles.navButton, currentFlashcardIndex === 0 && styles.navButtonDisabled]}
            disabled={currentFlashcardIndex === 0}
            onPress={() => {
              setCurrentFlashcardIndex(i => i - 1);
              setShowFlashcardAnswer(false);
            }}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={currentFlashcardIndex === 0 ? '#ddd' : '#333'}
            />
          </TouchableOpacity>

          <Text style={styles.flashcardCounter}>
            {currentFlashcardIndex + 1} / {flashcards.length}
          </Text>

          <TouchableOpacity
            style={[styles.navButton, currentFlashcardIndex === flashcards.length - 1 && styles.navButtonDisabled]}
            disabled={currentFlashcardIndex === flashcards.length - 1}
            onPress={() => {
              setCurrentFlashcardIndex(i => i + 1);
              setShowFlashcardAnswer(false);
            }}
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={currentFlashcardIndex === flashcards.length - 1 ? '#ddd' : '#333'}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#212121" />
        </View>
      </SafeAreaView>
    );
  }

  // No lecture found
  if (!lecture) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lecture</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.emptyContent}>
          <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Lecture not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {lecture.title || 'Lecture'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? '#212121' : '#999'}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {renderTabContent()}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#212121',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
  },
  tabLabelActive: {
    color: '#212121',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  // Transcript styles
  transcriptSegment: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timestamp: {
    paddingRight: 12,
  },
  timestampText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  segmentText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  transcriptText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  // Summary styles
  summaryText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#333',
  },
  // Flashcard styles
  flashcardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  flashcard: {
    width: '100%',
    minHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  flashcardLabel: {
    position: 'absolute',
    top: 12,
    left: 16,
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
  },
  flashcardContent: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
    lineHeight: 26,
  },
  flashcardHint: {
    position: 'absolute',
    bottom: 12,
    fontSize: 11,
    color: '#ccc',
  },
  flashcardNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 24,
  },
  navButton: {
    padding: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  flashcardCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
});

