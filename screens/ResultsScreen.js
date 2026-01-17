// screens/ResultsScreen.js
// Cloud-only Results screen. Removed all AsyncStorage persistence.

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Dimensions,
    Platform,
    Animated,
    Easing,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    KeyboardAvoidingView,
    FlatList
} from 'react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import {
    Play, Pause, Calendar, Clock, AudioLines, ChevronLeft,
    TextAlignEnd, NotepadText, BookSearch, Maximize2, X, Send
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';
import * as FileSystem from 'expo-file-system/legacy';
import aiService from '../services/ai';
import { syncLectureToCloud, fetchLecturesFromCloud } from '../services/lectureStorage';
import MarkdownMathRenderer from '../components/MarkdownMathRenderer';

const { width } = Dimensions.get('window');

// Loading Step Component
const LoadingStep = ({ label, status, isLast }) => {
    const { colors, isDark } = useTheme();
    const rotation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (status === 'ongoing') {
            Animated.loop(
                Animated.timing(rotation, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            rotation.setValue(0);
        }
    }, [status]);

    const rotate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.stepRow}>
            <View style={styles.stepIconContainer}>
                {status === 'complete' ? (
                    <View style={[styles.stepDot, { backgroundColor: colors.primary }]} />
                ) : status === 'ongoing' ? (
                    <Animated.View style={[styles.stepLoader, { borderColor: colors.primary, borderTopColor: 'transparent', transform: [{ rotate }] }]} />
                ) : (
                    <View style={[styles.stepDot, { backgroundColor: colors.border }]} />
                )}
                {!isLast && <View style={[styles.stepLine, { backgroundColor: status === 'complete' ? colors.primary : colors.border }]} />}
            </View>
            <Text style={[
                styles.stepLabel,
                { color: status === 'pending' ? colors.textSecondary : colors.text },
                status === 'ongoing' && { fontFamily: 'Inter_700Bold' }
            ]}>
                {label}
            </Text>
        </View>
    );
};

export default function ResultsScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { isOffline } = useNetwork();
    const { uri, duration, date, title, source, id: routeId } = route.params || {};

    // Core State
    const [currentCardId, setCurrentCardId] = useState(routeId || null);
    const [currentUri, setCurrentUri] = useState(uri || null);
    const [transcript, setTranscript] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isStage1Complete, setIsStage1Complete] = useState(false);
    const [loadingStage, setLoadingStage] = useState(0);
    const [activeTab, setActiveTab] = useState('transcripts');

    // Audio Player State
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [positionMillis, setPositionMillis] = useState(0);
    const [totalDurationMillis, setTotalDurationMillis] = useState(0);

    // Refs
    const soundRef = useRef(null);
    const isProcessingRef = useRef(false);
    const transcriptListRef = useRef(null);
    const [activeTranscriptIndex, setActiveTranscriptIndex] = useState(-1);

    // AI Flags
    const [transcriptCallMade, setTranscriptCallMade] = useState(false);
    const [summaryCallMade, setSummaryCallMade] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [chatQuery, setChatQuery] = useState('');
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            const init = async () => {
                if (isProcessingRef.current) return;

                if (!currentCardId && !routeId) {
                    console.log('[INIT] New recording detected');
                    isProcessingRef.current = true;
                    try {
                        const newId = Math.random().toString(36).substr(2, 9);
                        setCurrentCardId(newId);
                        await startProcessingFlow(newId, 0);
                    } finally {
                        isProcessingRef.current = false;
                    }
                } else {
                    const id = routeId || currentCardId;
                    await loadExistingData(id);
                }
            };

            init();
            loadSound();
        }, [currentCardId, routeId])
    );

    const loadExistingData = async (id) => {
        if (!id) return;
        try {
            const allLectures = await fetchLecturesFromCloud();
            const card = allLectures.find(c => c.id === id);
            if (card) {
                setTranscript(card.transcript || []);
                setSummary(card.summary || null);
                setCurrentUri(card.uri || card.audioUri);
                if (card.status === 'ready' || (card.transcript && card.summary)) {
                    setIsStage1Complete(true);
                    setLoadingStage(4);
                    setTranscriptCallMade(!!card.transcript);
                    setSummaryCallMade(!!card.summary);
                }
            }
        } catch (e) {
            console.error('Error loading existing data', e);
        }
    };

    async function loadSound() {
        if (!currentUri) return;
        try {
            if (soundRef.current) await soundRef.current.unloadAsync();

            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: currentUri },
                { shouldPlay: false },
                onPlaybackStatusUpdate
            );
            soundRef.current = newSound;
            setSound(newSound);
        } catch (error) {
            console.log('Error loading sound', error);
        }
    }

    const onPlaybackStatusUpdate = (status) => {
        if (status.isLoaded) {
            setPositionMillis(status.positionMillis);
            setTotalDurationMillis(status.durationMillis);
            setIsPlaying(status.isPlaying);

            // Sync transcript highlighting
            if (Array.isArray(transcript)) {
                const index = transcript.findIndex(t =>
                    status.positionMillis >= t.start && status.positionMillis <= t.end
                );
                if (index !== -1 && index !== activeTranscriptIndex) {
                    setActiveTranscriptIndex(index);
                    transcriptListRef.current?.scrollToIndex({
                        index,
                        animated: true,
                        viewPosition: 0.5
                    });
                }
            }
        }
    };

    const handlePlayPause = async () => {
        if (!soundRef.current) return;
        if (isPlaying) {
            await soundRef.current.pauseAsync();
        } else {
            await soundRef.current.playAsync();
        }
    };

    const handleSliderChange = async (value) => {
        if (soundRef.current) {
            await soundRef.current.setPositionAsync(value);
        }
    };

    const handleTranscriptPress = async (item) => {
        if (soundRef.current) {
            await soundRef.current.setPositionAsync(item.start);
            await soundRef.current.playAsync();
        }
    };

    const startProcessingFlow = async (cardId, startStage = 0) => {
        if (!currentUri) return;
        if (isOffline) {
            Alert.alert("Offline", "Cannot process audio while offline.");
            return;
        }

        setLoadingStage(startStage);
        let currentTranscript = [];
        let currentSummary = null;

        try {
            // Stage 1: Transcription
            setLoadingStage(1);
            const ts = await aiService.transcribeAudio(currentUri);
            currentTranscript = ts.segments.map(u => ({
                id: Math.random().toString(36).substr(2, 9),
                time: formatTimeSeconds(u.start),
                start: u.start * 1000,
                end: u.end * 1000,
                text: u.text
            }));
            setTranscript(currentTranscript);
            setTranscriptCallMade(true);

            // Stage 2: Summary
            setLoadingStage(2);
            const text = currentTranscript.map(t => t.text).join('\n');
            currentSummary = await aiService.generateSummary(text);
            setSummary(currentSummary);
            setSummaryCallMade(true);

            // Stage 3: Finalize & Sync to Cloud
            setLoadingStage(3);
            const finalCard = {
                id: cardId,
                title: title || 'New Lecture',
                date: date || new Date().toISOString(),
                duration: duration || '00:00',
                transcript: currentTranscript,
                summary: currentSummary,
                uri: currentUri,
                status: 'ready'
            };

            const result = await syncLectureToCloud(finalCard);
            if (result.success && result.cloudUrl) {
                setCurrentUri(result.cloudUrl);
            }

            setLoadingStage(4);
            setIsStage1Complete(true);
        } catch (error) {
            console.error('Processing failed', error);
            Alert.alert("Error", "Processing failed. Please check connection.");
        }
    };

    const handleChatSubmit = () => {
        if (!chatQuery.trim()) return;
        navigation.navigate('AIChat', {
            lectureId: currentCardId,
            initialMessage: chatQuery,
            transcript: transcript.map(t => t.text).join('\n')
        });
        setChatQuery('');
    };

    const formatTime = (millis) => {
        const totalSeconds = millis / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const formatTimeSeconds = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const getStepStatus = (idx) => {
        if (loadingStage > idx) return 'complete';
        if (loadingStage === idx) return 'ongoing';
        return 'pending';
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Results</Text>
            </View>

            <View style={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardInfo}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title || 'New Lecture'}</Text>
                        <View style={styles.metaRow}>
                            <Calendar size={14} color={colors.textSecondary} />
                            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{date ? new Date(date).toLocaleDateString() : ''}</Text>
                        </View>
                    </View>

                    <View style={[styles.playerPill, { backgroundColor: colors.tint }]}>
                        <TouchableOpacity onPress={handlePlayPause}>
                            {isPlaying ? <Pause size={20} color={colors.text} fill={colors.text} /> : <Play size={20} color={colors.text} fill={colors.text} />}
                        </TouchableOpacity>
                        <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={totalDurationMillis || 1}
                            value={positionMillis}
                            onSlidingComplete={handleSliderChange}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={colors.border}
                            thumbTintColor={colors.primary}
                        />
                        <Text style={[styles.timestamp, { color: colors.text }]}>{formatTime(positionMillis)}</Text>
                    </View>
                </View>

                {!isStage1Complete ? (
                    <View style={styles.loadingContainer}>
                        <Text style={[styles.loadingTitle, { color: colors.text }]}>Analyzing Lecture</Text>
                        <LoadingStep label="Transcribing audio" status={getStepStatus(1)} />
                        <LoadingStep label="Summarizing content" status={getStepStatus(2)} />
                        <LoadingStep label="Saving to cloud" status={getStepStatus(3)} isLast={true} />
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        {/* Tabs */}
                        <View style={styles.tabBar}>
                            {['transcripts', 'summary', 'materials'].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setActiveTab(t)}
                                    style={[styles.tabItem, activeTab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                                >
                                    <Text style={[styles.tabLabel, { color: activeTab === t ? colors.primary : colors.textSecondary }]}>{t.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flex: 1 }}>
                            {activeTab === 'transcripts' && (
                                <FlatList
                                    ref={transcriptListRef}
                                    data={transcript}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            onPress={() => handleTranscriptPress(item)}
                                            style={[styles.transcriptItem, activeTranscriptIndex === index && { backgroundColor: colors.tint }]}
                                        >
                                            <Text style={[styles.transcriptTime, { color: colors.primary }]}>{item.time}</Text>
                                            <Text style={[styles.transcriptText, { color: colors.text }]}>{item.text}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            )}
                            {activeTab === 'summary' && (
                                <ScrollView contentContainerStyle={{ padding: 20 }}>
                                    <MarkdownMathRenderer content={summary || 'No summary available.'} />
                                </ScrollView>
                            )}
                        </View>
                    </View>
                )}
            </View>

            {/* AI Chat Bar */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.chatBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <TextInput
                    style={[styles.chatInput, { color: colors.text, backgroundColor: colors.inputBackground }]}
                    placeholder="Ask about this lecture..."
                    placeholderTextColor={colors.textSecondary}
                    value={chatQuery}
                    onChangeText={setChatQuery}
                />
                <TouchableOpacity onPress={handleChatSubmit} style={[styles.sendButton, { backgroundColor: colors.primary }]}>
                    <Send size={18} color="#FFF" />
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1 },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    headerTitle: { fontSize: 18, fontWeight: '700', marginLeft: 15 },
    content: { flex: 1, padding: 20 },
    card: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
    cardInfo: { marginBottom: 15 },
    title: { fontSize: 22, fontWeight: '800', marginBottom: 5 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 13, fontWeight: '600' },
    playerPill: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, gap: 10 },
    slider: { flex: 1, height: 40 },
    timestamp: { fontSize: 12, fontWeight: '700', width: 45 },
    loadingContainer: { flex: 1, justifyContent: 'center', padding: 40 },
    loadingTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 30 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 30 },
    stepIconContainer: { alignItems: 'center', marginRight: 15, width: 24 },
    stepDot: { width: 12, height: 12, borderRadius: 6 },
    stepLoader: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
    stepLine: { width: 2, height: 40, marginVertical: 4 },
    stepLabel: { fontSize: 16, fontWeight: '600' },
    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', marginBottom: 10 },
    tabItem: { paddingVertical: 12, flex: 1, alignItems: 'center' },
    tabLabel: { fontSize: 12, fontWeight: '800' },
    transcriptItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.02)' },
    transcriptTime: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
    transcriptText: { fontSize: 15, lineHeight: 22 },
    chatBar: { flexDirection: 'row', padding: 15, alignItems: 'center', gap: 10, borderTopWidth: 1 },
    chatInput: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 20, fontSize: 15 },
    sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topBlur: { position: 'absolute', top: 0, left: 0, right: 0, height: 40, zIndex: 1 }
});