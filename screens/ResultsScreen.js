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
    ActivityIndicator
} from 'react-native';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import { Play, Pause, Calendar, Clock, AudioLines, ChevronLeft, FileText, Layout, MessageSquare, List, Send, Info, BookSearch, NotepadText, TextAlignEnd } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { FlatList } from 'react-native';

const { width } = Dimensions.get('window');

// Loading Step Component for Stage 1
const LoadingStep = ({ label, status, isLast }) => {
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
        if (status === 'ongoing') return '#F97316'; // Orange
        if (status === 'complete') return '#22C55E'; // Green
        if (status === 'failed') return '#EF4444'; // Red
        return '#A1A1AA'; // Grey
    };

    const getDotColor = () => {
        if (status === 'ongoing' || status === 'complete') return '#000000';
        if (status === 'failed') return '#EF4444'; // Red dot for failure
        return '#A1A1AA';
    };

    return (
        <View style={styles.stepContainer}>
            <View style={styles.stepLeft}>
                <View style={[styles.stepDot, { backgroundColor: getDotColor() }]} />
                {!isLast && (
                    <View style={[
                        styles.stepLine,
                        { backgroundColor: status === 'complete' ? '#22C55E' : '#E4E4E7' }
                    ]} />
                )}
            </View>
            <View style={styles.stepRight}>
                <View style={styles.stepHeaderRow}>
                    <Text style={[
                        styles.stepLabel,
                        { color: status === 'pending' ? '#A1A1AA' : '#18181B' }
                    ]}>
                        {label}
                    </Text>
                    {status === 'ongoing' && (
                        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                            <View style={styles.spinner} />
                        </Animated.View>
                    )}
                </View>
                {(status === 'ongoing' || status === 'complete' || status === 'failed') && (
                    <Text style={[styles.stepStatusText, { color: getStatusColor(), fontWeight: '700' }]}>
                        {status === 'ongoing' ? 'Processing...' : status === 'complete' ? 'Ready' : 'Failed'}
                    </Text>
                )}
            </View>
        </View>
    );
};

export default function ResultsScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { uri, duration, date, title, source } = route.params || {};

    const [isPlaying, setIsPlaying] = useState(false);
    const [positionMillis, setPositionMillis] = useState(0);
    const [totalDurationMillis, setTotalDurationMillis] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentCardId, setCurrentCardId] = useState(route.params?.id || null);

    // AI Constants - from app.config.js via Constants
    const DEEPGRAM_API_KEY = Constants.expoConfig?.extra?.deepgramApiKey || '';
    const OPENROUTER_API_KEY = Constants.expoConfig?.extra?.openrouterApiKey || '';

    // Validate API keys on mount
    useEffect(() => {
        console.log('=== API Key Validation ===');

        if (!DEEPGRAM_API_KEY || !OPENROUTER_API_KEY) {
            console.error('❌ API Keys are missing from app config!');
            if (!DEEPGRAM_API_KEY) console.error('- DEEPGRAM_API_KEY is missing');
            if (!OPENROUTER_API_KEY) console.error('- OPENROUTER_API_KEY is missing');

            Alert.alert(
                'Configuration Error',
                'One or more API keys are missing. Please check your .env.local file and restart the Expo server.',
                [{ text: 'OK' }]
            );
        } else {
            console.log('✓ Deepgram API key loaded');
            console.log('✓ OpenRouter API key loaded');
        }
        console.log('========================');
    }, []);

    // Stage 1 Loading State
    const [loadingStage, setLoadingStage] = useState(0); // 0 to 4
    const [isStage1Complete, setIsStage1Complete] = useState(route.params?.initialStatus === 'ready');

    // Stage 2 Data State
    const [activeTab, setActiveTab] = useState('transcripts');
    const [transcript, setTranscript] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [summaryAttempted, setSummaryAttempted] = useState(false);
    const [chatQuery, setChatQuery] = useState('');
    const [activeTranscriptIndex, setActiveTranscriptIndex] = useState(-1);

    const soundRef = useRef(null);
    const transcriptListRef = useRef(null);

    // Initial load and automatic save
    useEffect(() => {
        loadSound();

        const init = async () => {
            const idFromParams = route.params?.id;

            if (!idFromParams) {
                // New recording/upload flow - this is the ONLY path that triggers fresh API calls
                console.log('[GUARD] New recording detected - will start fresh processing');
                const newId = await autoSaveResult();
                if (newId) {
                    startProcessingFlow(newId, 0);
                }
            } else {
                // Existing card flow - MUST check stored data first
                setCurrentCardId(idFromParams);

                // CRITICAL: Load card data from storage to check completion state
                const storedCards = await AsyncStorage.getItem('@memry_cards');
                if (storedCards) {
                    const cards = JSON.parse(storedCards);
                    const card = cards.find(c => c.id === idFromParams);

                    if (card) {
                        // HARD GUARD: If status is 'ready', NEVER call APIs
                        if (card.status === 'ready') {
                            console.log('[GUARD] ✅ Card is READY - loading cached data, NO API calls');
                            setIsStage1Complete(true);
                            setLoadingStage(4);
                            if (card.transcript) setTranscript(card.transcript);
                            if (card.summary) {
                                setSummary(card.summary);
                                setSummaryAttempted(true);
                            }
                            return; // HARD STOP - do not proceed to any processing
                        }

                        // GUARD: If transcript AND summary exist, mark as ready
                        if (card.transcript && card.summary) {
                            console.log('[GUARD] ✅ Transcript + Summary exist - marking as ready, NO API calls');
                            setIsStage1Complete(true);
                            setLoadingStage(4);
                            setTranscript(card.transcript);
                            setSummary(card.summary);
                            setSummaryAttempted(true);
                            await updateCardToReady(idFromParams);
                            return; // HARD STOP
                        }

                        // GUARD: If only transcript exists, show summary button (don't call API automatically)
                        if (card.transcript && !card.summary) {
                            console.log('[GUARD] ⚠️ Transcript exists but no summary - showing Generate Summary button');
                            setTranscript(card.transcript);
                            setIsStage1Complete(true);
                            setLoadingStage(4);
                            // Don't auto-call OpenRouter - let user click the button
                            return;
                        }

                        // Only reach here if status is 'preparing' and no data exists
                        if (card.status === 'preparing') {
                            console.log('[GUARD] Card is PREPARING - resuming from last stage');
                            const startStage = Math.floor((card.progress || 0) * 4);
                            setLoadingStage(startStage);
                            startProcessingFlow(idFromParams, startStage);
                        }
                    }
                }
            }
        };

        init();

        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, [uri]);

    // Resume ONLY summary generation (Deepgram already complete)
    const resumeSummaryOnly = async (cardId, existingTranscript) => {
        try {
            console.log('[API] OpenRouter ONLY - Deepgram was already completed');
            setLoadingStage(3);
            updateCardProgress(cardId, 0.75);
            const resultSummary = await generateSummaryReal(existingTranscript);
            if (resultSummary) {
                setSummary(resultSummary);
                await saveAIResult(cardId, 'summary', resultSummary);
            }
            setLoadingStage(4);
            updateCardProgress(cardId, 1.0);
            await new Promise(r => setTimeout(r, 500));
            setIsStage1Complete(true);
            await updateCardToReady(cardId);
        } catch (error) {
            console.error('Summary-only flow failed:', error);
            Alert.alert("Error", "Failed to generate summary. Please try again.");
        }
    };

    // ONE-TIME summary generation handler (for manual button press)
    const handleGenerateSummary = async () => {
        // GUARD: Prevent multiple clicks
        if (isGeneratingSummary) {
            console.log('[GUARD] ⛔ handleGenerateSummary BLOCKED - already generating');
            return;
        }

        // GUARD: Prevent if summary already exists
        if (summary) {
            console.log('[GUARD] ⛔ handleGenerateSummary BLOCKED - summary already exists');
            return;
        }

        // GUARD: Prevent if already attempted
        if (summaryAttempted) {
            console.log('[GUARD] ⛔ handleGenerateSummary BLOCKED - already attempted');
            return;
        }

        // GUARD: Need transcript to generate summary
        if (!transcript || transcript.length === 0) {
            console.log('[GUARD] ⛔ handleGenerateSummary BLOCKED - no transcript available');
            Alert.alert("Error", "Transcript is required to generate a summary.");
            return;
        }

        // Mark as attempted immediately (prevents re-render from re-enabling button)
        setSummaryAttempted(true);
        setIsGeneratingSummary(true);

        try {
            console.log('[API] 🔴 CALLING OPENROUTER (manual) - This should only happen ONCE per lecture');
            const resultSummary = await generateSummaryReal(transcript);

            if (resultSummary) {
                setSummary(resultSummary);
                await saveAIResult(currentCardId, 'summary', resultSummary);
                console.log('[API] ✅ Summary generated and saved successfully');
            } else {
                console.log('[API] ⚠️ OpenRouter returned empty summary');
            }
        } catch (error) {
            console.error('[API] ❌ Summary generation failed:', error);
            Alert.alert("Error", "Failed to generate summary. Please try again later.");
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const loadLocalData = async (id) => {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const card = cards.find(c => c.id === id);
                if (card) {
                    if (card.transcript) setTranscript(card.transcript);
                    if (card.summary) {
                        setSummary(card.summary);
                        setSummaryAttempted(true); // Mark as attempted so button doesn't show
                    }
                }
            }
        } catch (e) {
            console.error('Error loading local data:', e);
        }
    };

    // Real-progress driven flow - WITH STRICT GUARDS
    const startProcessingFlow = async (cardId, startStage = 0) => {
        if (!uri) return;

        try {
            // CRITICAL PRE-CHECK: Verify data doesn't already exist
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const existingCard = cards.find(c => c.id === cardId);

                if (existingCard) {
                    // HARD GUARD: If already ready, abort immediately
                    if (existingCard.status === 'ready') {
                        console.log('[GUARD] ⛔ startProcessingFlow BLOCKED - card already READY');
                        setIsStage1Complete(true);
                        setLoadingStage(4);
                        if (existingCard.transcript) setTranscript(existingCard.transcript);
                        if (existingCard.summary) {
                            setSummary(existingCard.summary);
                            setSummaryAttempted(true);
                        }
                        return; // ABORT - no API calls
                    }

                    // GUARD: If both transcript and summary exist, skip all
                    if (existingCard.transcript && existingCard.summary) {
                        console.log('[GUARD] ⛔ startProcessingFlow BLOCKED - data already exists');
                        setTranscript(existingCard.transcript);
                        setSummary(existingCard.summary);
                        setSummaryAttempted(true);
                        setIsStage1Complete(true);
                        setLoadingStage(4);
                        await updateCardToReady(cardId);
                        return; // ABORT
                    }

                    // GUARD: If transcript exists, skip Deepgram
                    if (existingCard.transcript && startStage <= 1) {
                        console.log('[GUARD] ⚠️ Transcript exists - SKIPPING Deepgram, proceeding to OpenRouter only');
                        setTranscript(existingCard.transcript);
                        startStage = 2; // Skip to summary stage
                    }
                }
            }

            // Step 1: Uploading (Simulated delay for local sanity)
            if (startStage <= 0) {
                console.log('[API] Step 1: Preparing audio...');
                setLoadingStage(1);
                updateCardProgress(cardId, 0.25);
                await new Promise(r => setTimeout(r, 2000));
                startStage = 1;
            }

            // Step 2: Transcribing (Real Deepgram Call) - WITH GUARD
            if (startStage <= 1) {
                // Double-check transcript doesn't exist
                const checkCards = await AsyncStorage.getItem('@memry_cards');
                const checkCard = checkCards ? JSON.parse(checkCards).find(c => c.id === cardId) : null;

                if (checkCard?.transcript) {
                    console.log('[GUARD] ⛔ Deepgram BLOCKED - transcript already exists');
                    setTranscript(checkCard.transcript);
                    startStage = 2;
                } else {
                    console.log('[API] 🔴 CALLING DEEPGRAM - This should only happen ONCE per lecture');
                    setLoadingStage(2);
                    updateCardProgress(cardId, 0.5);
                    const transcripts = await processTranscriptionReal();
                    if (transcripts) {
                        setTranscript(transcripts);
                        await saveAIResult(cardId, 'transcript', transcripts);
                        startStage = 2;

                        // Immediately proceed to summary
                        console.log('[API] 🔴 CALLING OPENROUTER - This should only happen ONCE per lecture');
                        setLoadingStage(3);
                        updateCardProgress(cardId, 0.75);
                        const resultSummary = await generateSummaryReal(transcripts);
                        if (resultSummary) {
                            setSummary(resultSummary);
                            setSummaryAttempted(true);
                            await saveAIResult(cardId, 'summary', resultSummary);
                        }
                        startStage = 3;
                    }
                }
            } else if (startStage === 2) {
                // Resume from stage 2 - need to check if summary exists
                const checkCards = await AsyncStorage.getItem('@memry_cards');
                const checkCard = checkCards ? JSON.parse(checkCards).find(c => c.id === cardId) : null;

                if (checkCard?.summary) {
                    console.log('[GUARD] ⛔ OpenRouter BLOCKED - summary already exists');
                    setSummary(checkCard.summary);
                    setSummaryAttempted(true);
                } else if (checkCard?.transcript) {
                    console.log('[API] 🔴 CALLING OPENROUTER (resume) - This should only happen ONCE per lecture');
                    setLoadingStage(3);
                    updateCardProgress(cardId, 0.75);
                    const resultSummary = await generateSummaryReal(checkCard.transcript);
                    if (resultSummary) {
                        setSummary(resultSummary);
                        setSummaryAttempted(true);
                        await saveAIResult(cardId, 'summary', resultSummary);
                    }
                }
                startStage = 3;
            }

            // Step 4: Polishing
            setLoadingStage(4);
            updateCardProgress(cardId, 1.0);
            await new Promise(r => setTimeout(r, 500));
            setIsStage1Complete(true);
            await updateCardToReady(cardId);
            console.log('[COMPLETE] ✅ Processing finished - card marked as READY');

        } catch (error) {
            console.error('Processing flow failed:', error);
            Alert.alert("Process Error", "Something went wrong during processing. Please try again.");
        }
    };

    const processTranscriptionReal = async () => {
        try {
            if (!DEEPGRAM_API_KEY) {
                throw new Error('Deepgram API key is not configured. Please check your app.config.js and .env.local file.');
            }

            console.log('Fetching audio for Deepgram...');
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists) throw new Error('File does not exist');

            // In Expo, to send to Deepgram, we use fetch with blob
            const audioResponse = await fetch(uri);
            const blob = await audioResponse.blob();

            console.log('Sending to Deepgram');
            const response = await fetch('https://api.deepgram.com/v1/listen?smart_format=true&utterances=true&punctuate=true&diarize=true', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${DEEPGRAM_API_KEY}`,
                    'Content-Type': 'audio/wav'
                },
                body: blob
            });

            const data = await response.json();
            if (!data.results) throw new Error('Deepgram failed: ' + JSON.stringify(data));

            const utterances = data.results.utterances || [];
            return utterances.map(u => ({
                id: Math.random().toString(36).substr(2, 9),
                time: formatTimeSeconds(u.start),
                start: u.start * 1000, // to millis
                end: u.end * 1000,   // to millis
                text: u.transcript
            }));
        } catch (e) {
            console.error('Deepgram Error:', e);
            throw e;
        }
    };

    const generateSummaryReal = async (transcriptsData) => {
        try {
            if (!OPENROUTER_API_KEY) {
                throw new Error('OpenRouter API key is not configured. Please check your app.config.js and .env.local file.');
            }

            const transcriptText = Array.isArray(transcriptsData)
                ? transcriptsData.map(t => t.text).join('\n')
                : transcriptsData;

            console.log(`DEBUG: Sending ${transcriptText.length} chars to OpenRouter...`);

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://memry.app',
                    'X-Title': 'Memry'
                },
                body: JSON.stringify({
                    model: 'gpt-oss-20b:free',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a professional educational assistant. Summarize the following lecture transcript. 
                            Use VERY RICH formatting including:
                            - Bold for key terms
                            - H2 and H3 headers for sections
                            - Bullet points for lists
                            - Tables for comparisons if applicable
                            - Italics for emphasis.
                            Return output in clean Markdown.`
                        },
                        { role: 'user', content: transcriptText }
                    ]
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message || 'API Error');

            const content = data.choices?.[0]?.message?.content;
            if (content) {
                return content;
            } else {
                return "Summary not generated.";
            }
        } catch (e) {
            console.error('OpenRouter Error:', e);
            throw e;
        }
    };

    const formatTimeSeconds = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const saveAIResult = async (id, key, value) => {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const updatedCards = cards.map(card =>
                    card.id === id ? { ...card, [key]: value } : card
                );
                await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
            }
        } catch (e) {
            console.error(`Error saving ${key}:`, e);
        }
    };

    async function updateCardProgress(id, progress) {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const updatedCards = cards.map(card =>
                    card.id === id ? { ...card, progress: progress } : card
                );
                await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
            }
        } catch (error) {
            console.error('Error updating progress:', error);
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
                console.log('Card updated to READY');
            }
        } catch (error) {
            console.error('Error updating card to ready:', error);
        }
    }

    async function autoSaveResult() {
        if (!uri) return;
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            const cards = storedCards ? JSON.parse(storedCards) : [];

            // Generate unique ID for this session's card
            const newId = `rec_${Date.now()}`;
            setCurrentCardId(newId);

            const newCard = {
                id: newId,
                title: title || `Lecture ${cards.length + 1}`,
                date: date || new Date().toLocaleDateString(),
                duration: duration || '00:00:00',
                uri: uri,
                source: source || 'recording', // Default to recording if not specified
                status: 'preparing',
                progress: 0.1,
                isFavorite: false,
                filterIds: []
            };

            const updatedCards = [newCard, ...cards];
            await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
            console.log('Result auto-saved as PREPARING');
            return newId; // Return the new ID
        } catch (error) {
            console.error('Error auto-saving result:', error);
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
            console.error('Error loading sound:', error);
        }
    }

    const onPlaybackStatusUpdate = (status) => {
        if (status.isLoaded) {
            setPositionMillis(status.positionMillis);
            setIsPlaying(status.isPlaying);
            if (status.durationMillis) {
                setTotalDurationMillis(status.durationMillis);
            }

            // Sync Highlight
            if (transcript.length > 0) {
                const index = transcript.findIndex(t =>
                    status.positionMillis >= t.start && status.positionMillis <= t.end
                );
                if (index !== -1 && index !== activeTranscriptIndex) {
                    setActiveTranscriptIndex(index);
                    // Scroll to the active item
                    if (transcriptListRef.current) {
                        transcriptListRef.current.scrollToIndex({
                            index: index,
                            animated: true,
                            viewPosition: 0.5 // Center the item
                        });
                    }
                }
            }

            if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionMillis(0);
                soundRef.current?.setPositionAsync(0);
                setActiveTranscriptIndex(-1);
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
            console.error('Playback error:', error);
        }
    };

    const handleSliderChange = async (value) => {
        if (soundRef.current && isLoaded) {
            try {
                await soundRef.current.setPositionAsync(value);
            } catch (error) {
                console.error('Slider seeking error:', error);
            }
        }
    };

    const handleTranscriptPress = async (item) => {
        if (soundRef.current && isLoaded) {
            await soundRef.current.setPositionAsync(item.start);
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

    const currentTimeDisplay = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');

    const getStatus = (stepIdx) => {
        return stepStatuses[stepIdx] || 'pending';
    };

    // Simple Markdown Renderer
    const MarkdownRenderer = ({ content }) => {
        if (!content) return null;

        const lines = content.split('\n');
        return (
            <View>
                {lines.map((line, index) => {
                    // Headers
                    if (line.startsWith('### ')) return <Text key={index} style={[styles.mdH3, { color: colors.text }]}>{line.replace('### ', '')}</Text>;
                    if (line.startsWith('## ')) return <Text key={index} style={[styles.mdH2, { color: colors.text }]}>{line.replace('## ', '')}</Text>;
                    if (line.startsWith('# ')) return <Text key={index} style={[styles.mdH1, { color: colors.text }]}>{line.replace('# ', '')}</Text>;

                    // Bullet points
                    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                        return (
                            <View key={index} style={styles.mdBulletRow}>
                                <Text style={[styles.mdBullet, { color: colors.text }]}>•</Text>
                                <Text style={[styles.mdText, { color: colors.textSecondary }]}>{line.trim().substring(2)}</Text>
                            </View>
                        );
                    }

                    // Tables
                    if (line.includes('|') && line.split('|').length > 2) {
                        const cells = line.split('|').filter(c => c.trim().length > 0);
                        return (
                            <View key={index} style={styles.mdTableRow}>
                                {cells.map((cell, cIdx) => (
                                    <View key={cIdx} style={[styles.mdTableCell, { borderColor: colors.border }]}>
                                        <Text style={[styles.mdText, { color: colors.text, fontWeight: index === 0 ? '700' : '400' }]}>{cell.trim()}</Text>
                                    </View>
                                ))}
                            </View>
                        );
                    }

                    // Bold/Italic (Basic regex)
                    let styledText = line;
                    // Bold **text**
                    const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);

                    return (
                        <Text key={index} style={[styles.mdText, { color: colors.textSecondary }]}>
                            {parts.map((part, pIdx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <Text key={pIdx} style={{ fontWeight: '700', color: colors.text }}>{part.slice(2, -2)}</Text>;
                                }
                                if (part.startsWith('*') && part.endsWith('*')) {
                                    return <Text key={pIdx} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
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
        <SafeAreaView style={[styles.container, { backgroundColor: '#F9F9F9' }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ChevronLeft size={24} color="#000" />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: '#000' }]}>Results</Text>
            </View>

            <View style={styles.content}>
                {/* Fixed Result Card */}
                <View style={styles.card}>
                    <View style={styles.cardInfo}>
                        <Text style={styles.title} numberOfLines={2}>
                            {title || 'New Recording'}
                        </Text>
                        <View style={styles.metaRow}>
                            <View style={styles.metaItem}>
                                <Calendar size={14} color="#A1A1AA" style={styles.metaIcon} />
                                <Text style={styles.metaText}>{date || 'Jan 24 2025'}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Clock size={14} color="#A1A1AA" style={styles.metaIcon} />
                                <Text style={styles.metaText}>{currentTimeDisplay}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <AudioLines size={14} color="#A1A1AA" style={styles.metaIcon} />
                                <Text style={styles.metaText}>{duration || '15min'}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.playerPill}>
                        <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                            {isPlaying ? (
                                <Pause size={20} color="#000" fill="#000" />
                            ) : (
                                <Play size={20} color="#000" fill="#000" />
                            )}
                        </TouchableOpacity>
                        <Slider
                            style={styles.slider}
                            minimumValue={0}
                            maximumValue={totalDurationMillis || 1}
                            value={positionMillis}
                            onSlidingComplete={handleSliderChange}
                            minimumTrackTintColor="#000000"
                            maximumTrackTintColor="#3c3c3cff"
                            thumbTintColor="#000000"
                        />
                        <Text style={styles.timestamp}>{formatTime(positionMillis)}</Text>
                    </View>
                </View>

                {/* Loading or Content */}
                {!isStage1Complete ? (
                    <View style={styles.loadingContainer}>
                        <View style={styles.overallProgressContainer}>
                            <View style={[styles.overallProgressBar, { width: `${(loadingStage / 4) * 100}%` }]} />
                        </View>
                        <Text style={styles.loadingSubtext}>
                            Processing your lecture... {Math.round((loadingStage / 4) * 100)}%
                        </Text>

                        <LoadingStep label="Preparing audio" status={loadingStage >= 1 ? (loadingStage === 1 ? 'ongoing' : 'complete') : 'pending'} />
                        <LoadingStep label="Transcribing" status={loadingStage >= 2 ? (loadingStage === 2 ? 'ongoing' : 'complete') : 'pending'} />
                        <LoadingStep label="Generating summary" status={loadingStage >= 3 ? (loadingStage === 3 ? 'ongoing' : 'complete') : 'pending'} />
                        <LoadingStep label="Finalizing" status={loadingStage >= 4 ? (loadingStage === 4 ? 'ongoing' : 'complete') : 'pending'} isLast={true} />
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <View style={styles.tabBar}>
                            {[
                                { id: 'transcripts', label: 'Transcripts', icon: <TextAlignEnd size={18} /> },
                                { id: 'summary', label: 'Summary', icon: <NotepadText size={18} /> },
                                { id: 'materials', label: 'Materials', icon: <BookSearch size={18} /> }
                            ].map((tab) => (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
                                    onPress={() => setActiveTab(tab.id)}
                                >
                                    {React.cloneElement(tab.icon, { color: activeTab === tab.id ? '#18181B' : '#A1A1AA' })}
                                    <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={{ flex: 1 }}>
                            {activeTab === 'transcripts' && (
                                <FlatList
                                    ref={transcriptListRef}
                                    data={transcript}
                                    keyExtractor={(item) => item.id}
                                    onScrollToIndexFailed={info => {
                                        const wait = new Promise(resolve => setTimeout(resolve, 500));
                                        wait.then(() => {
                                            transcriptListRef.current?.scrollToIndex({ index: info.index, animated: true });
                                        });
                                    }}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => handleTranscriptPress(item)}
                                            style={styles.transcriptItem}
                                        >
                                            <View style={[
                                                styles.timestampBadge,
                                                activeTranscriptIndex === index && { backgroundColor: '#F97316' }
                                            ]}>
                                                <Text style={styles.timestampText}>{item.time}</Text>
                                            </View>
                                            <Text style={[
                                                styles.transcriptContent,
                                                { color: activeTranscriptIndex === index ? '#000000' : '#A1A1AA' },
                                                activeTranscriptIndex === index && { fontWeight: '800' }
                                            ]}>
                                                {item.text}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    contentContainerStyle={{ paddingBottom: 100 }}
                                />
                            )}

                            {activeTab === 'summary' && (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                                    <View style={styles.summaryContainer}>
                                        {summary ? (
                                            <MarkdownRenderer content={summary} />
                                        ) : isGeneratingSummary ? (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <ActivityIndicator color="#18181B" size="large" />
                                                <Text style={{ marginTop: 12, color: '#A1A1AA', fontWeight: '600' }}>Generating summary...</Text>
                                            </View>
                                        ) : transcript.length > 0 && !summaryAttempted ? (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <Text style={{ marginBottom: 16, color: '#71717A', textAlign: 'center', fontSize: 15 }}>
                                                    Transcript is ready. Generate a summary using AI.
                                                </Text>
                                                <TouchableOpacity
                                                    style={styles.generateSummaryButton}
                                                    onPress={handleGenerateSummary}
                                                >
                                                    <Text style={styles.generateSummaryButtonText}>Generate Summary</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                                <Text style={{ color: '#A1A1AA' }}>Summary not available.</Text>
                                            </View>
                                        )}
                                    </View>
                                </ScrollView>
                            )}

                            {activeTab === 'materials' && (
                                <ScrollView style={styles.transcriptContainer} showsVerticalScrollIndicator={false}>
                                    <View style={styles.materialsContainer}>
                                        <Text style={styles.materialsTitle}>Materials</Text>
                                        <Text style={styles.materialsDesc}>
                                            Use the transcript to generate notes, mind maps, flashcards & quizzes instantly.
                                        </Text>

                                        <View style={styles.materialsGrid}>
                                            {[
                                                { label: 'Flash cards', icon: <FileText size={24} color="#18181B" /> },
                                                { label: 'Quizzes', icon: <Layout size={24} color="#18181B" /> },
                                                { label: 'Journey Map', icon: <MessageSquare size={24} color="#18181B" /> },
                                                { label: 'Notes', icon: <List size={24} color="#18181B" /> }
                                            ].map((item, idx) => (
                                                <TouchableOpacity key={idx} style={styles.materialCard}>
                                                    <View style={styles.materialIconContainer}>
                                                        {item.icon}
                                                    </View>
                                                    <Text style={styles.materialLabel}>{item.label}</Text>
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

            {isStage1Complete && (
                <View style={[styles.chatBarContainer, { backgroundColor: '#FFFFFF' }]}>
                    <TextInput
                        style={styles.chatInput}
                        placeholder="Ask Memry"
                        placeholderTextColor="#A1A1AA"
                        value={chatQuery}
                        onChangeText={setChatQuery}
                    />
                    <TouchableOpacity style={styles.sendButton}>
                        <Send size={18} color="#18181B" />
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
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
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F2F2F7',
        marginBottom: 32,
    },
    cardInfo: {
        marginBottom: 15,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#000',
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
        color: '#8E8E93',
        fontWeight: '500',
    },
    playerPill: {
        backgroundColor: '#F2F2F7',
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
        color: '#000',
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
        borderColor: '#E4E4E7',
        borderTopColor: '#000000',
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
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    // Stage 2 Tab Bar
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 4,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#F2F2F7',
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 6,
        borderRadius: 12,
    },
    tabItemActive: {
        backgroundColor: '#F2F2F7',
    },
    tabLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#A1A1AA',
    },
    tabLabelActive: {
        color: '#18181B',
    },
    // Transcript Styles
    transcriptContainer: {
        flex: 1,
    },
    transcriptItem: {
        flexDirection: 'row',
        marginBottom: 24,
        gap: 16,
    },
    timestampBadge: {
        backgroundColor: '#18181B',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        height: 26,
    },
    timestampText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    transcriptContent: {
        flex: 1,
        fontSize: 16,
        lineHeight: 24,
        color: '#18181B',
        fontWeight: '500',
    },
    // Summary Styles
    summaryContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#F2F2F7',
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
        color: '#18181B',
    },
    summaryText: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
        color: '#3F3F46',
    },
    // Markdown Specific Styles
    mdH1: { fontSize: 26, fontWeight: '800', marginVertical: 12 },
    mdH2: { fontSize: 22, fontWeight: '700', marginVertical: 10, marginTop: 20 },
    mdH3: { fontSize: 18, fontWeight: '700', marginVertical: 8, marginTop: 15 },
    mdText: { fontSize: 15, lineHeight: 24, marginVertical: 4 },
    mdBulletRow: { flexDirection: 'row', marginLeft: 10, marginVertical: 2 },
    mdBullet: { fontSize: 18, marginRight: 8, lineHeight: 24 },
    mdTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F2F2F7', paddingVertical: 8 },
    mdTableCell: { flex: 1, paddingHorizontal: 4 },
    // Materials Styles
    materialsContainer: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 20,
    },
    materialsTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 12,
    },
    materialsDesc: {
        fontSize: 15,
        color: '#71717A',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    materialsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    materialCard: {
        width: (width - 56) / 2,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F2F2F7',
        gap: 10,
    },
    materialIconContainer: {
        marginBottom: 4,
    },
    materialLabel: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    // Chat Bar
    chatBarContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#F2F2F7',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    chatInput: {
        flex: 1,
        fontSize: 16,
        color: '#18181B',
        paddingRight: 12,
    },
    sendButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F2F2F7',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
