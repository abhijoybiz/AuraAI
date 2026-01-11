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
    KeyboardAvoidingView
} from 'react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Play, Pause, Calendar, Clock, AudioLines, ChevronLeft, FileText, Layout, MessageSquare, List, Send, Info, BookSearch, NotepadText, TextAlignEnd, Layers, Pencil, Route, BookOpen, Maximize2, X, NotebookPen, BookOpenText } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import aiService from '../services/ai';
import { syncLectureToCloud } from '../services/lectureStorage';
import { generateUUID } from '../lib/supabase';

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
                    duration: 1200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            ).start();
        } else {
            rotation.setValue(0);
        }
    }, [status]);

    const rotateInterpolate = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const getStatusColor = () => {
        if (status === 'ongoing') return '#F97316';
        if (status === 'complete') return colors.success;
        if (status === 'failed') return colors.error;
        return colors.textSecondary;
    };

    const getDotColor = () => {
        if (status === 'ongoing' || status === 'complete') return colors.primary;
        if (status === 'failed') return colors.error;
        return colors.textSecondary;
    };

    return (
        <View style={styles.stepContainer}>
            <View style={styles.stepLeft}>
                <View style={[styles.stepDot, { backgroundColor: getDotColor() }]} />
                {!isLast && (
                    <View style={[
                        styles.stepLine,
                        { backgroundColor: status === 'complete' ? colors.success : colors.border }
                    ]} />
                )}
            </View>
            <View style={styles.stepRight}>
                <View style={styles.stepHeaderRow}>
                    <Text style={[
                        styles.stepLabel,
                        {
                            color: status === 'pending' ? colors.textSecondary : colors.text,
                            fontFamily: 'Inter_600SemiBold'
                        }
                    ]}>
                        {label}
                    </Text>
                    {status === 'ongoing' && (
                        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                            <View style={[styles.spinner, { borderColor: colors.border, borderTopColor: colors.primary }]} />
                        </Animated.View>
                    )}
                </View>
                {(status === 'ongoing' || status === 'complete' || status === 'failed') && (
                    <Text style={[styles.stepStatusText, { color: getStatusColor(), fontFamily: 'Inter_700Bold' }]}>
                        {status === 'ongoing' ? 'Processing...' : status === 'complete' ? 'Ready' : 'Failed'}
                    </Text>
                )}
            </View>
        </View>
    );
};

export default function ResultsScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { isOffline } = useNetwork();
    const { uri, duration, date, title, source } = route.params || {};

    // Helper for safe date display
    const formatDate = (dateString) => {
        try {
            if (!dateString) return '';
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return dateString; // Fallback
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateString || '';
        }
    };

    const [isPlaying, setIsPlaying] = useState(false);
    const [positionMillis, setPositionMillis] = useState(0);
    const [totalDurationMillis, setTotalDurationMillis] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentCardId, setCurrentCardId] = useState(route.params?.id || null);

    // API Configuration
    // Use fallback to empty string and ensure we have a string type to prevent .substring() crashes
    const DEEPGRAM_API_KEY = typeof Constants.expoConfig?.extra?.deepgramApiKey === 'string'
        ? Constants.expoConfig.extra.deepgramApiKey
        : '';
    const GROQ_API_KEY = typeof Constants.expoConfig?.extra?.groqApiKey === 'string'
        ? Constants.expoConfig.extra.groqApiKey
        : '';
    const HTTP_REFERER = (typeof Constants.expoConfig?.extra?.httpReferer === 'string'
        ? Constants.expoConfig.extra.httpReferer
        : 'http://localhost:8081');

    // Loading State
    const [loadingStage, setLoadingStage] = useState(0);
    const [isStage1Complete, setIsStage1Complete] = useState(route.params?.initialStatus === 'ready');

    // Data State
    const [activeTab, setActiveTab] = useState('transcripts');
    const [transcript, setTranscript] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    // Configuration: Set to true to auto-generate summaries after transcription
    const AUTO_GENERATE_SUMMARY = true; // Change to false if you want manual control

    // Guard flags for API calls
    const [transcriptCallMade, setTranscriptCallMade] = useState(false);
    const [summaryCallMade, setSummaryCallMade] = useState(false);

    const [chatQuery, setChatQuery] = useState('');
    const [activeTranscriptIndex, setActiveTranscriptIndex] = useState(-1);
    const [hasFlashcards, setHasFlashcards] = useState(false);
    const [hasQuiz, setHasQuiz] = useState(false);
    const [hasNotes, setHasNotes] = useState(false);
    const [hasChat, setHasChat] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

    const activeIndexRef = useRef(-1);
    const transcriptRef = useRef([]);

    useEffect(() => {
        transcriptRef.current = transcript;
    }, [transcript]);

    const soundRef = useRef(null);
    const transcriptListRef = useRef(null);

    // API key validation
    useEffect(() => {
        const isProduction = Constants.expoConfig?.extra?.isProduction;

        // Skip direct API key validation in production as we use secure Edge Functions
        if (isProduction) {
            console.log('=== AI Service (Secure Production) ===');
            console.log('Status: Routing via Supabase Edge Functions');
            console.log('========================');
            return;
        }

        console.log('=== API Key Validation ===');

        if (!DEEPGRAM_API_KEY || !GROQ_API_KEY) {
            console.error('❌ API Keys are missing from app config!');
            if (!DEEPGRAM_API_KEY) console.error('- DEEPGRAM_API_KEY is missing');
            if (!GROQ_API_KEY) console.error('- GROQ_API_KEY is missing');

            Alert.alert(
                'Configuration Error',
                'API keys are missing. Please:\n1. Check your .env.local file\n2. Ensure DEEPGRAM_API_KEY and GROQ_API_KEY are set\n3. Restart Expo server (expo start -c)',
                [{ text: 'OK' }]
            );
            return;
        }

        console.log('Deepgram API key status:', DEEPGRAM_API_KEY ? 'Loaded (' + DEEPGRAM_API_KEY.substring(0, 1) + '...)' : 'Missing');
        console.log('Groq API key status:', GROQ_API_KEY ? 'Loaded (' + GROQ_API_KEY.substring(0, 1) + '...)' : 'Missing');
        console.log('HTTP Referer:', HTTP_REFERER);
        console.log('========================');
    }, []);

    // Sound cleanup on unmount
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    // Initial load & Focus refresh
    useFocusEffect(
        React.useCallback(() => {
            loadSound(); // Keep sound loading separate if needed, but it's safe here

            const init = async () => {
                const idFromParams = route.params?.id || currentCardId;

                if (!idFromParams) {
                    console.log('[INIT] New recording detected');
                    const newId = await autoSaveResult();
                    if (newId) {
                        await startProcessingFlow(newId, 0);
                    }
                } else {
                    setCurrentCardId(idFromParams);

                    const storedCards = await AsyncStorage.getItem('@memry_cards');
                    if (storedCards) {
                        const cards = JSON.parse(storedCards);
                        const card = cards.find(c => c.id === idFromParams);

                        if (card) {
                            // Load existing data and set flags
                            if (card.transcript) {
                                setTranscript(card.transcript);
                                setTranscriptCallMade(true);
                            }

                            if (card.summary) {
                                setSummary(card.summary);
                                setSummaryCallMade(true);
                            }

                            setHasFlashcards(!!card.flashcards);
                            setHasQuiz(!!card.quiz);
                            setHasNotes(!!card.notes);

                            // Check completion
                            if (card.status === 'ready') {
                                setIsStage1Complete(true);
                                setLoadingStage(4);
                                return;
                            }

                            if (card.transcript && card.summary) {
                                setIsStage1Complete(true);
                                setLoadingStage(4);
                                await updateCardToReady(idFromParams);
                                return;
                            }

                            if (card.status === 'preparing') {
                                const startStage = Math.floor((card.progress || 0) * 4);
                                setLoadingStage(startStage);
                                await startProcessingFlow(idFromParams, startStage);
                            }
                        }
                    }
                }
            };

            init();
            checkChat();

            return () => {
                // cleanup if needed
            };
        }, [uri, currentCardId])
    );

    const handleGenerateSummary = async () => {
        console.log('[MANUAL] Generate Summary clicked');

        if (isOffline) {
            Alert.alert("Offline Mode", "Internet connection is required to generate summaries.");
            return;
        }

        if (isGeneratingSummary || summary || summaryCallMade) {
            return;
        }

        if (!transcript || transcript.length === 0) {
            Alert.alert("Error", "Transcript is required to generate a summary.");
            return;
        }

        setIsGeneratingSummary(true);
        setSummaryCallMade(true);

        try {
            console.log('[API] 🔴 CALLING GROQ (manual)');
            const resultSummary = await generateSummaryReal(transcript);

            if (resultSummary) {
                setSummary(resultSummary);
                await saveAIResult(currentCardId, 'summary', resultSummary);
                await updateCardToReady(currentCardId);
                console.log('[API] ✅ Summary saved');
            }
        } catch (error) {
            console.error('[API] ❌ Failed:', error);
            Alert.alert("Error", `Failed to generate summary: ${error.message}`);
            setSummaryCallMade(false);
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const checkChat = async () => {
        try {
            const id = route.params?.id || currentCardId;
            if (!id) return;
            const saved = await AsyncStorage.getItem(`@memry_chat_${id}`);
            if (saved) {
                setHasChat(true);
            }
        } catch (e) {
            console.log('Error checking chat:', e);
        }
    };

    const handleChatSubmit = () => {
        if (!chatQuery.trim()) return;

        navigation.navigate('AIChat', {
            lectureId: currentCardId,
            initialMessage: chatQuery,
            transcript: Array.isArray(transcript) ? transcript.map(t => t.text).join('\n') : transcript
        });
        setChatQuery('');
    };

    const handleVisitChat = () => {
        navigation.navigate('AIChat', {
            lectureId: currentCardId,
            transcript: Array.isArray(transcript) ? transcript.map(t => t.text).join('\n') : transcript
        });
    };

    const startProcessingFlow = async (cardId, startStage = 0) => {
        if (!uri) {
            console.error('[PROCESS] No URI');
            return;
        }
        if (isOffline) {
            console.log('[PROCESS] ⚠️ Offline - skipping cloud processing');
            Alert.alert(
                "Offline Mode",
                "Cannot process transcription or summaries while offline. We'll resume once you're back online.",
                [{ text: "OK" }]
            );
            return;
        }

        console.log(`[PROCESS] Starting from stage ${startStage}`);
        setLoadingStage(startStage);
        let currentTranscript = [];

        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            let existingCard = null;

            if (storedCards) {
                const cards = JSON.parse(storedCards);
                existingCard = cards.find(c => c.id === cardId);
            }

            // Stage 0: Preparing
            if (startStage <= 0) {
                console.log('[STAGE 0] Preparing audio');
                setLoadingStage(1);
                await updateCardProgress(cardId, 0.25);
                await new Promise(r => setTimeout(r, 2000));
            }

            // Stage 1: Transcription
            if (startStage <= 1 && !transcriptCallMade) {
                if (existingCard?.transcript) {
                    console.log('[GUARD] Transcript exists - skipping Deepgram');
                    setTranscript(existingCard.transcript);
                    setTranscriptCallMade(true);
                } else {
                    console.log('[STAGE 1] 🔴 CALLING DEEPGRAM');
                    setLoadingStage(2);
                    await updateCardProgress(cardId, 0.5);

                    const transcripts = await processTranscriptionReal();

                    if (transcripts && transcripts.length > 0) {
                        console.log('[STAGE 1] ✅ Transcription complete');
                        currentTranscript = transcripts; // Store in local variable for immediate use
                        setTranscript(transcripts);
                        setTranscriptCallMade(true);
                        await saveAIResult(cardId, 'transcript', transcripts);
                    } else {
                        throw new Error('Transcription returned no results');
                    }
                }
            }

            // Stage 2: Summary
            if (startStage <= 2 && !summaryCallMade) {
                // IMPORTANT: Use the freshly generated transcript instead of state
                const transcriptToUse = currentTranscript.length > 0
                    ? currentTranscript
                    : (existingCard?.transcript || transcript);

                if (!transcriptToUse || transcriptToUse.length === 0) {
                    console.log('[STAGE 2] ⚠️ No transcript found - skipping summary generation');
                } else if (existingCard?.summary) {
                    console.log('[GUARD] Summary exists - skipping Groq');
                    setSummary(existingCard.summary);
                    setSummaryCallMade(true);
                } else {
                    console.log('[STAGE 2] 🔴 CALLING GROQ');
                    setLoadingStage(3);
                    await updateCardProgress(cardId, 0.75);

                    const resultSummary = await generateSummaryReal(transcriptToUse);

                    if (resultSummary) {
                        console.log('[STAGE 2] ✅ Summary complete');
                        setSummary(resultSummary);
                        setSummaryCallMade(true);
                        await saveAIResult(cardId, 'summary', resultSummary);
                    } else {
                        console.log('[STAGE 2] ⚠️ Empty summary');
                    }
                }
            }

            // Stage 3: Finalize
            console.log('[STAGE 3] Finalizing');
            setLoadingStage(4);
            await updateCardProgress(cardId, 1.0);
            await new Promise(r => setTimeout(r, 500));
            setIsStage1Complete(true);
            await updateCardToReady(cardId);
            console.log('[COMPLETE] ✅ Done');

        } catch (error) {
            console.error('[PROCESS] ❌ Failed:', error);
            Alert.alert(
                "Processing Error",
                `Failed: ${error.message}\n\nCheck API keys and network.`
            );
        }
    };

    async function processTranscriptionReal() {
        try {
            console.log('[AI-SERVICE] Requesting transcription...');

            // Use the unified aiService which handles Dev/Prod switching
            const result = await aiService.transcribeAudio(uri);

            if (!result || !result.segments) {
                throw new Error('Transcription service returned no data');
            }

            // Map segments to the internal format used by ResultsScreen
            return result.segments.map(u => ({
                id: Math.random().toString(36).substr(2, 9),
                time: formatTimeSeconds(u.start),
                start: u.start * 1000,
                end: u.end * 1000,
                text: u.text
            }));

        } catch (error) {
            console.error('[TRANSCRIPTION] ❌ Failed:', error);
            throw error;
        }
    }

    async function generateSummaryReal(transcriptsData) {
        try {
            const transcriptText = Array.isArray(transcriptsData)
                ? transcriptsData.map(t => t.text).join('\n')
                : transcriptsData;

            console.log(`[AI-SERVICE] Requesting summary (${transcriptText.length} chars)...`);

            // Use the unified aiService which handles Dev/Prod switching
            return await aiService.generateSummary(transcriptText);

        } catch (error) {
            console.error('[SUMMARY] ❌ Failed:', error);
            throw error;
        }
    }

    function formatTimeSeconds(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    async function saveAIResult(id, key, value) {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const updatedCards = cards.map(card =>
                    card.id === id ? { ...card, [key]: value } : card
                );
                await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
                console.log(`[STORAGE] Saved ${key}`);

                // Sync to cloud if card is ready (not during initial processing)
                const updatedCard = updatedCards.find(c => c.id === id);
                if (updatedCard && updatedCard.status === 'ready') {
                    syncLectureToCloud(updatedCard).catch(err => {
                        console.error('[CLOUD] Background sync error:', err);
                    });
                }
            }
        } catch (error) {
            console.error(`[STORAGE] Error saving ${key}:`, error);
        }
    }

    async function updateCardProgress(id, progress) {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const updatedCards = cards.map(card =>
                    card.id === id ? { ...card, progress } : card
                );
                await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
            }
        } catch (error) {
            console.error('[STORAGE] Error updating progress:', error);
        }
    }

    async function updateCardToReady(id) {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const updatedCards = cards.map(card =>
                    card.id === id ? { ...card, status: 'ready', progress: 1 } : card
                );
                await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
                console.log('[STORAGE] Marked READY');

                // Sync the completed lecture to Supabase
                const readyCard = updatedCards.find(c => c.id === id);
                if (readyCard) {
                    syncLectureToCloud(readyCard).then(result => {
                        if (result.success) {
                            console.log('[CLOUD] ✅ Lecture synced to Supabase');
                        } else {
                            console.log('[CLOUD] ⚠️ Cloud sync deferred:', result.reason);
                        }
                    }).catch(err => {
                        console.error('[CLOUD] Sync error:', err);
                    });
                }
            }
        } catch (error) {
            console.error('[STORAGE] Error updating to ready:', error);
        }
    }

    async function autoSaveResult() {
        if (!uri) return null;
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            const cards = storedCards ? JSON.parse(storedCards) : [];

            const newId = generateUUID();
            setCurrentCardId(newId);

            const newCard = {
                id: newId,
                title: title || `Lecture ${cards.length + 1}`,
                date: date || new Date().toISOString(),
                duration: duration || '00:00:00',
                uri: uri,
                source: source || 'recording',
                status: 'preparing',
                progress: 0.1,
                isFavorite: false,
                filterIds: []
            };

            const updatedCards = [newCard, ...cards];
            await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
            console.log('[STORAGE] New card saved');
            return newId;
        } catch (error) {
            console.error('[STORAGE] Error auto-saving:', error);
            return null;
        }
    }

    async function loadSound() {
        if (!uri) return;
        try {
            const { sound, status } = await Audio.Sound.createAsync(
                { uri: uri },
                { shouldPlay: false },
                onPlaybackStatusUpdate
            );
            soundRef.current = sound;
            setIsLoaded(true);
            if (status.isLoaded) {
                setTotalDurationMillis(status.durationMillis || 0);
            }
        } catch (error) {
            console.log('[AUDIO] Load failed (expected if file missing):', error.message);
            // Only alert if we are supposed to have audio
            if (uri && uri.startsWith('file')) {
                // Silent fail for background loading, or minimal alert
                console.warn('[AUDIO] Local file missing');
            } else {
                Alert.alert("Audio Unavailable", "Could not load audio source.");
            }
        }
    }

    const onPlaybackStatusUpdate = (status) => {
        if (status.isLoaded) {
            setPositionMillis(status.positionMillis);
            setIsPlaying(status.isPlaying);
            if (status.durationMillis) {
                setTotalDurationMillis(status.durationMillis);
            }

            if (transcriptRef.current && transcriptRef.current.length > 0) {
                const index = transcriptRef.current.findIndex(t =>
                    status.positionMillis >= t.start && status.positionMillis <= t.end
                );

                if (index !== -1 && index !== activeIndexRef.current) {
                    activeIndexRef.current = index;
                    setActiveTranscriptIndex(index);

                    // Use requestAnimationFrame for smoother scrolling
                    if (transcriptListRef.current) {
                        requestAnimationFrame(() => {
                            try {
                                transcriptListRef.current.scrollToIndex({
                                    index: index,
                                    animated: true,
                                    viewPosition: 0.3 // Scroll slightly higher than middle for better context
                                });
                            } catch (err) {
                                // Silent fail if list not ready
                            }
                        });
                    }
                }
            }

            if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionMillis(0);
                soundRef.current?.setPositionAsync(0);
                setActiveTranscriptIndex(-1);
                activeIndexRef.current = -1;
            }
        }
    };

    const handlePlayPause = async () => {
        if (!soundRef.current || !isLoaded) return;
        try {
            if (isPlaying) {
                await soundRef.current.pauseAsync();
            } else {
                await soundRef.current.playAsync();
            }
        } catch (error) {
            console.error('[AUDIO] Playback error:', error);
        }
    };

    const handleSliderChange = async (value) => {
        if (soundRef.current && isLoaded) {
            try {
                await soundRef.current.setPositionAsync(value);
            } catch (error) {
                console.error('[AUDIO] Slider error:', error);
            }
        }
    };

    const handleTranscriptPress = async (item) => {
        if (soundRef.current && isLoaded) {
            await soundRef.current.setPositionAsync(item.start);
            // Find index and update set/ref
            const index = transcriptRef.current.findIndex(t => t.id === item.id);
            if (index !== -1) {
                activeIndexRef.current = index;
                setActiveTranscriptIndex(index);
            }
            if (!isPlaying) {
                await soundRef.current.playAsync();
            }
        }
    };

    const formatTime = (millis) => {
        const totalSeconds = Math.floor(millis / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const currentTimeDisplay = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).toLowerCase().replace(' ', '');

    const getStepStatus = (stepIndex) => {
        if (loadingStage > stepIndex) return 'complete';
        if (loadingStage === stepIndex) return 'ongoing';
        return 'pending';
    };

    const MarkdownRenderer = ({ content }) => {
        if (!content) return null;

        const lines = content.split('\n');
        let inList = false;

        return (
            <View>
                {lines.map((line, index) => {
                    const trimmedLine = line.trim();

                    if (trimmedLine === '---') {
                        return <View key={index} style={styles.mdHr} />;
                    }

                    if (trimmedLine.startsWith('> ')) {
                        return (
                            <View key={index} style={styles.mdQuote}>
                                <Text style={[styles.mdText, { color: colors.textSecondary }]}>
                                    {trimmedLine.replace('> ', '')}
                                </Text>
                            </View>
                        );
                    }

                    if (trimmedLine.startsWith('### ')) {
                        return <Text key={index} style={[styles.mdH3, { color: colors.text }]}>{trimmedLine.replace('### ', '')}</Text>;
                    }
                    if (trimmedLine.startsWith('## ')) {
                        return <Text key={index} style={[styles.mdH2, { color: colors.text }]}>{trimmedLine.replace('## ', '')}</Text>;
                    }
                    if (trimmedLine.startsWith('# ')) {
                        return <Text key={index} style={[styles.mdH1, { color: colors.text }]}>{trimmedLine.replace('# ', '')}</Text>;
                    }

                    // Numbered Lists
                    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.*)/);
                    if (numberedMatch) {
                        return (
                            <View key={index} style={styles.mdNumberedRow}>
                                <Text style={[styles.mdNumberedLabel, { color: colors.text }]}>{numberedMatch[1]}.</Text>
                                <Text style={[styles.mdText, { color: colors.textSecondary, flex: 1 }]}>
                                    {numberedMatch[2]}
                                </Text>
                            </View>
                        );
                    }

                    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                        return (
                            <View key={index} style={styles.mdBulletRow}>
                                <Text style={[styles.mdBullet, { color: colors.text }]}>•</Text>
                                <Text style={[styles.mdText, { color: colors.textSecondary, flex: 1 }]}>
                                    {trimmedLine.substring(2)}
                                </Text>
                            </View>
                        );
                    }

                    if (trimmedLine.includes('|') && trimmedLine.split('|').length > 2) {
                        const cells = trimmedLine.split('|').filter(c => c.trim().length > 0);
                        if (trimmedLine.includes('---')) return null; // Skip table separator lines
                        return (
                            <View key={index} style={[styles.mdTableRow, { borderBottomColor: colors.border }]}>
                                {cells.map((cell, cIdx) => (
                                    <View key={cIdx} style={[styles.mdTableCell, { borderColor: colors.border }]}>
                                        <Text style={[styles.mdText, {
                                            color: colors.text,
                                            fontWeight: trimmedLine.includes('**') ? '700' : '400'
                                        }]}>
                                            {cell.trim().replace(/\*\*/g, '')}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        );
                    }

                    // Text parsing for Bold, Italic, and Inline Code
                    const parts = trimmedLine.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
                    return (
                        <Text key={index} style={[styles.mdText, { color: colors.textSecondary }]}>
                            {parts.map((part, pIdx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <Text key={pIdx} style={{ fontWeight: '700', color: colors.text }}>{part.slice(2, -2)}</Text>;
                                }
                                if (part.startsWith('*') && part.endsWith('*')) {
                                    return <Text key={pIdx} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
                                }
                                if (part.startsWith('`') && part.endsWith('`')) {
                                    return (
                                        <View key={pIdx} style={[styles.mdCodeInline, { backgroundColor: colors.tint }]}>
                                            <Text style={styles.mdCodeText}>{part.slice(1, -1)}</Text>
                                        </View>
                                    );
                                }
                                return part;
                            })}
                        </Text>
                    );
                })}
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Results</Text>
            </View>

            <View style={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardInfo}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                            {title || 'New Recording'}
                        </Text>
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Calendar size={14} color={colors.textSecondary} style={styles.metaIcon} />
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDate(date) || 'Jan 24 2025'}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Clock size={14} color={colors.textSecondary} style={styles.metaIcon} />
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{currentTimeDisplay}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <AudioLines size={14} color={colors.textSecondary} style={styles.metaIcon} />
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{duration || '15min'}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.playerPill, { backgroundColor: colors.tint }]}>
                        <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                            {isPlaying ? (
                                <Pause size={20} color={colors.text} fill={colors.text} />
                            ) : (
                                <Play size={20} color={colors.text} fill={colors.text} />
                            )}
                        </TouchableOpacity>
                        <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={totalDurationMillis || 1}
                            value={positionMillis}
                            onSlidingComplete={handleSliderChange}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={isDark ? "#ffffffff" : "#000000ff"}
                            thumbTintColor={colors.primary}
                        />
                        <Text style={[styles.timestamp, { color: colors.text }]}>{formatTime(positionMillis)}</Text>
                    </View>
                </View>

                {!isStage1Complete ? (
                    <View style={styles.loadingContainer}>
                        <View style={[styles.overallProgressContainer]}>
                            <View style={[styles.overallProgressBar, { width: `${(loadingStage / 4) * 100}%` }]} />
                        </View>
                        <Text style={styles.loadingSubtext}>
                            Processing your lecture... {Math.round((loadingStage / 4) * 100)}%
                        </Text>

                        <LoadingStep label="Preparing audio" status={getStepStatus(1)} />
                        <LoadingStep label="Transcribing" status={getStepStatus(2)} />
                        <LoadingStep label="Generating summary" status={getStepStatus(3)} />
                        <LoadingStep label="Finalizing" status={getStepStatus(4)} isLast={true} />
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {[
                                { id: 'transcripts', label: 'Transcript', icon: <TextAlignEnd size={18} /> },
                                { id: 'summary', label: 'Summary', icon: <NotepadText size={18} /> },
                                { id: 'materials', label: 'Materials', icon: <BookSearch size={18} /> }
                            ].map((tab) => (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tabItem, activeTab === tab.id && { backgroundColor: colors.tint }]}
                                    onPress={() => setActiveTab(tab.id)}
                                >
                                    {React.cloneElement(tab.icon, { color: activeTab === tab.id ? colors.text : colors.textSecondary })}
                                    <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.text : colors.textSecondary }]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flex: 1 }}>
                            {activeTab === 'transcripts' && (
                                <View style={{ flex: 1, position: 'relative' }}>
                                    <FlatList
                                        ref={transcriptListRef}
                                        data={transcript}
                                        keyExtractor={(item) => item.id}
                                        extraData={activeTranscriptIndex}
                                        showsVerticalScrollIndicator={false}
                                        onScrollToIndexFailed={info => {
                                            const wait = new Promise(resolve => setTimeout(resolve, 500));
                                            wait.then(() => {
                                                transcriptListRef.current?.scrollToIndex({ index: info.index, animated: true });
                                            });
                                        }}
                                        renderItem={({ item, index }) => (
                                            <TouchableOpacity
                                                activeOpacity={0.7}
                                                onPress={() => handleTranscriptPress(item)}
                                                style={styles.transcriptItem}
                                            >
                                                <View style={[
                                                    styles.timestampBadge,
                                                    activeTranscriptIndex === index
                                                        ? { backgroundColor: colors.primary }
                                                        : { backgroundColor: colors.tint }
                                                ]}>
                                                    <Text style={[
                                                        styles.timestampText,
                                                        activeTranscriptIndex === index
                                                            ? { color: isDark ? colors.background : '#FFFFFF', fontFamily: 'Inter_700Bold' }
                                                            : { color: colors.textSecondary, fontFamily: 'Inter_700Bold' }
                                                    ]}>
                                                        {item.time}
                                                    </Text>
                                                </View>
                                                <Text style={[
                                                    styles.transcriptContent,
                                                    {
                                                        color: activeTranscriptIndex === index ? colors.text : colors.textSecondary,
                                                        fontFamily: activeTranscriptIndex === index ? 'Inter_600SemiBold' : 'Inter_500Medium'
                                                    }
                                                ]}>
                                                    {item.text}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        contentContainerStyle={{ paddingBottom: 120, paddingTop: 20 }}
                                    />
                                    <LinearGradient
                                        colors={[colors.background, 'transparent']}
                                        style={styles.topBlur}
                                        pointerEvents="none"
                                    />
                                </View>
                            )}

                            {activeTab === 'summary' && (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                    <View style={[styles.summaryContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                        {summary ? (
                                            <>
                                                <View style={[styles.summaryHeader, { borderBottomColor: colors.border }]}>
                                                    <Text style={[styles.summaryTitleText, { color: colors.text }]}>Lecture Summary</Text>
                                                    <TouchableOpacity
                                                        style={[styles.expandButton, { backgroundColor: colors.tint }]}
                                                        onPress={() => setIsSummaryExpanded(true)}
                                                    >
                                                        <Maximize2 size={18} color={colors.textSecondary} />
                                                    </TouchableOpacity>
                                                </View>
                                                <MarkdownRenderer content={summary} />
                                            </>
                                        ) : isGeneratingSummary ? (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <ActivityIndicator color={colors.primary} size="large" />
                                                <Text style={{ marginTop: 12, color: colors.textSecondary, fontWeight: '600' }}>Generating summary...</Text>
                                            </View>
                                        ) : transcript.length > 0 && !summaryCallMade ? (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <Text style={{ marginBottom: 16, color: colors.textSecondary, textAlign: 'center', fontSize: 15 }}>
                                                    Transcript is ready. Generate a summary using AI.
                                                </Text>
                                                <TouchableOpacity
                                                    style={[styles.generateSummaryButton, { backgroundColor: colors.primary }]}
                                                    onPress={handleGenerateSummary}
                                                >
                                                    <Text style={[styles.generateSummaryButtonText, { color: isDark ? colors.background : '#FFFFFF' }]}>Generate Summary</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <Text style={{ color: colors.textSecondary }}>Summary not available.</Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
                            )}

                            {activeTab === 'materials' && (
                                <ScrollView style={styles.transcriptContainer} showsVerticalScrollIndicator={false}>
                                    <View style={styles.materialsContainer}>
                                        <Text style={[styles.materialsTitle, { color: colors.text }]}>Materials</Text>
                                        <Text style={[styles.materialsDesc, { color: colors.textSecondary }]}>
                                            Use the transcript to generate notes, mind maps, flashcards & quizzes instantly.
                                        </Text>

                                        <View style={styles.materialsGrid}>
                                            {[
                                                {
                                                    id: 'flashcards',
                                                    label: hasFlashcards ? 'View Flashcards' : 'Flash cards',
                                                    icon: <Layers size={32} color={colors.text} strokeWidth={1.5} />,
                                                    screen: 'Flashcards',
                                                    secondary: hasFlashcards ? 'Generated' : null
                                                },
                                                {
                                                    id: 'quiz',
                                                    label: hasQuiz ? 'View Quiz' : 'Quizzes',
                                                    icon: <NotebookPen size={32} color={colors.text} strokeWidth={1.5} />,
                                                    screen: 'Quiz',
                                                    secondary: hasQuiz ? 'Generated' : null
                                                },
                                                { id: 'journey', label: 'Journey Map', icon: <Route size={32} color={colors.text} strokeWidth={1.5} /> },
                                                {
                                                    id: 'notes',
                                                    label: hasNotes ? 'View Notes' : 'Notes',
                                                    icon: <BookOpenText size={32} color={colors.text} strokeWidth={1.5} />,
                                                    screen: 'Notes',
                                                    secondary: hasNotes ? 'Generated' : null
                                                }
                                            ].map((item, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[styles.materialCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                                                    onPress={() => {
                                                        if (item.screen) {
                                                            navigation.navigate(item.screen, {
                                                                transcript: Array.isArray(transcript) ? transcript.map(t => t.text).join('\n') : transcript,
                                                                id: currentCardId
                                                            });
                                                        } else {
                                                            Alert.alert("Coming Soon", "The Journey Map feature is currently under development.");
                                                        }
                                                    }}
                                                >
                                                    <View style={styles.materialIconContainer}>
                                                        {item.icon}
                                                    </View>
                                                    <Text style={[styles.materialLabel, { color: colors.text }]}>{item.label}</Text>
                                                    {item.secondary && (
                                                        <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' }}>
                                                            {item.secondary}
                                                        </Text>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                    <View style={{ height: 100 }} />
                                </ScrollView>
                            )}
                        </View>
                    </View>
                )}
            </View>


            {
                isStage1Complete && (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    >
                        <View style={[styles.chatBarContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {hasChat ? (
                                <TouchableOpacity
                                    style={[styles.visitChatButton, { backgroundColor: colors.primary }]}
                                    onPress={handleVisitChat}
                                >
                                    <MessageSquare size={18} color={isDark ? colors.background : "#FFF"} style={{ marginRight: 10 }} />
                                    <Text style={[styles.visitChatText, { color: isDark ? colors.background : "#FFF" }]}>Visit Chat</Text>
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <TextInput
                                        style={[styles.chatInput, { color: colors.text }]}
                                        placeholder="Ask Memry"
                                        placeholderTextColor={colors.textSecondary}
                                        value={chatQuery}
                                        onChangeText={setChatQuery}
                                        onSubmitEditing={handleChatSubmit}
                                    />
                                    <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.tint }]} onPress={handleChatSubmit}>
                                        <Send size={18} color={colors.text} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </KeyboardAvoidingView>
                )
            }

            <Modal
                visible={isSummaryExpanded}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsSummaryExpanded(false)}
            >
                <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Full Summary</Text>
                        <TouchableOpacity
                            onPress={() => setIsSummaryExpanded(false)}
                            style={[styles.closeButton, { backgroundColor: isDark ? colors.tint : '#F4F4F5' }]}
                        >
                            <X size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.modalScrollContent}
                    >
                        <MarkdownRenderer content={summary} />
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Platform.OS === 'android' ? 20 : 0,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Inter_600SemiBold',
        letterSpacing: -0.3,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    card: {
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        marginBottom: 32,
    },
    cardInfo: {
        marginBottom: 15,
    },
    title: {
        fontSize: 22,
        fontFamily: 'Inter_600SemiBold',
        marginBottom: 12,
        letterSpacing: -0.5,
        lineHeight: 28,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
    },
    metaIcon: {
        marginRight: 6,
    },
    metaText: {
        fontSize: 13,
        fontFamily: 'Inter_500Medium',
    },
    playerPill: {
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    playButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    slider: {
        flex: 1,
        height: 40,
        marginHorizontal: 10,
    },
    timestamp: {
        fontSize: 13,
        fontWeight: '600',
        width: 65,
        textAlign: 'right',
        fontVariant: ['tabular-nums'],
    },
    // Loading State Styles
    loadingContainer: {
        paddingLeft: 4,
        marginTop: 8,
        flex: 1,
    },
    overallProgressContainer: {
        height: 6,
        backgroundColor: '#E4E4E7',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 12,
        marginTop: 10,
    },
    overallProgressBar: {
        height: '100%',
        backgroundColor: '#F97316',
        borderRadius: 3,
    },
    loadingSubtext: {
        fontSize: 14,
        color: '#A1A1AA',
        fontWeight: '500',
        marginBottom: 30,
    },
    stepContainer: {
        flexDirection: 'row',
        minHeight: 64,
    },
    stepLeft: {
        width: 24,
        alignItems: 'center',
    },
    stepDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginTop: 8,
    },
    stepLine: {
        flex: 1,
        width: 2,
        marginVertical: 4,
    },
    stepRight: {
        flex: 1,
        paddingLeft: 12,
        paddingTop: 0,
    },
    stepHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 8,
    },
    stepLabel: {
        fontSize: 17,
        fontWeight: '600',
    },
    spinner: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2.5,
    },
    stepStatusText: {
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },
    stage2Placeholder: {
        flex: 1,
    },
    backButton: {
        position: 'absolute',
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    // Stage 2 Tab Bar
    tabBar: {
        flexDirection: 'row',
        borderRadius: 16,
        padding: 4,
        marginBottom: 24,
        borderWidth: 1,
        marginTop: -15,
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 7,
        borderRadius: 12,
    },
    tabItemActive: {
    },
    tabLabel: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: '#A1A1AA',
    },
    tabLabelActive: {
    },
    // Transcript Styles
    transcriptContainer: {
        flex: 1,
    },
    transcriptItem: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    transcriptItemActive: {
        // No background as requested
    },
    timestampBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        height: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timestampBadgeActive: {
        // dynamic background
    },
    timestampBadgeInactive: {
        // dynamic background
    },
    visitChatText: {
        fontSize: 15,
        fontFamily: 'Inter_600SemiBold',
    },
    topBlur: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        zIndex: 1,
    },
    bottomBlur: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 80,
        zIndex: 1,
    },
    timestampText: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
    },
    timestampTextActive: {
        // dynamic color
    },
    timestampTextInactive: {
        // dynamic color
    },
    transcriptContent: {
        flex: 1,
        fontSize: 16,
        lineHeight: 24,
        fontFamily: 'Inter_600SemiBold',
    },
    // Summary Styles
    summaryContainer: {
        flex: 1,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
    },
    summaryTitleText: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    },
    expandButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F7',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScrollContent: {
        padding: 24,
        paddingBottom: 60,
    },
    generateSummaryButton: {
        backgroundColor: '#18181B',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
    },
    generateSummaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    summaryTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 20,
    },
    summarySection: {
        marginBottom: 24,
    },
    summarySectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    summaryPoint: {
        flexDirection: 'row',
        marginBottom: 8,
        paddingLeft: 4,
    },
    summaryBullet: {
        fontSize: 16,
        marginRight: 8,
    },
    summaryText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    // Markdown Specific Styles
    mdH1: { fontSize: 26, fontFamily: 'Inter_800ExtraBold', marginVertical: 12 },
    mdH2: { fontSize: 22, fontFamily: 'Inter_700Bold', marginVertical: 10, marginTop: 20 },
    mdH3: { fontSize: 18, fontFamily: 'Inter_700Bold', marginVertical: 8, marginTop: 15 },
    mdText: { fontSize: 15, lineHeight: 24, marginVertical: 4, fontFamily: 'Inter_400Regular' },
    mdBulletRow: { flexDirection: 'row', marginLeft: 10, marginVertical: 2 },
    mdBullet: { fontSize: 18, marginRight: 8, lineHeight: 24, fontFamily: 'Inter_400Regular' },
    mdHr: { height: 1.5, backgroundColor: '#F2F2F7', marginVertical: 16, borderRadius: 1 },
    mdQuote: { borderLeftWidth: 4, borderLeftColor: '#F97316', paddingLeft: 16, marginVertical: 8, fontStyle: 'italic' },
    mdNumberedRow: { flexDirection: 'row', marginLeft: 10, marginVertical: 4 },
    mdNumberedLabel: { fontFamily: 'Inter_700Bold', marginRight: 8, fontSize: 15, width: 20 },
    mdCodeInline: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, marginHorizontal: 2 },
    mdCodeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, color: '#F97316' },
    mdTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F2F2F7', paddingVertical: 8 },
    mdTableCell: { flex: 1, paddingHorizontal: 4 },
    // Materials Styles
    materialsContainer: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 10,
        width: '100%',
    },
    materialsTitle: {
        fontSize: 26,
        fontFamily: 'Inter_800ExtraBold',
        marginBottom: 10,
    },
    materialsDesc: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
        paddingHorizontal: 30,
        fontFamily: 'Inter_400Regular',
    },
    materialsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 32,
        width: '100%',
        marginTop: 25,
    },
    materialCard: {
        width: (width - 120) / 2,
        height: (width - 120) / 2,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
    },
    materialIconContainer: {
        marginBottom: 12,
    },
    materialLabel: {
        fontSize: 14,
        fontFamily: 'Inter_800ExtraBold',
        textAlign: 'center',
        lineHeight: 18,
    },
    // Chat Bar
    chatBarContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        borderRadius: 24,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 0, // Removed padding for full fill
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        overflow: 'hidden', // Ensure child fills border radius
    },
    chatInput: {
        flex: 1,
        fontSize: 16,
        paddingRight: 12,
        marginLeft: 16, // Add margin since container padding is gone
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12, // Add margin
    },
    visitChatButton: {
        flex: 1,
        height: '100%', // Fill height
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    visitChatText: {
        fontSize: 15,
        fontFamily: 'Inter_600SemiBold',
    },
    topBlur: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        zIndex: 1,
    },
});