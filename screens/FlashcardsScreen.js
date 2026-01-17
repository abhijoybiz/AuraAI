import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Dimensions,
    Animated,
    ScrollView,
    ActivityIndicator,
    Platform
} from 'react-native';
import { ChevronLeft, Layers, Plus, Minus, RotateCcw, ChevronRight, Sparkles } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';
import { aiService } from '../services/ai.js';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from 'react-native';
import { fetchLecturesFromCloud, syncLectureToCloud } from '../services/lectureStorage';

const { width } = Dimensions.get('window');

const LoadingOverlay = ({ visible, message }) => {
    const { colors, isDark } = useTheme();
    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)' }]}>
            <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.text }]}>{message || 'Generating...'}</Text>
                <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>This usually takes a few seconds</Text>
            </View>
        </View>
    );
};

const Flashcard = ({ card, index, total }) => {
    const { colors } = useTheme();
    const [isFlipped, setIsFlipped] = useState(false);
    const flipAnim = useRef(new Animated.Value(0)).current;

    const handleFlip = () => {
        Animated.spring(flipAnim, {
            toValue: isFlipped ? 0 : 180,
            friction: 8,
            tension: 10,
            useNativeDriver: true,
        }).start();
        setIsFlipped(!isFlipped);
    };

    const frontInterpolate = flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['0deg', '180deg'],
    });

    const backInterpolate = flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['180deg', '360deg'],
    });

    const frontAnimatedStyle = {
        transform: [{ rotateY: frontInterpolate }],
    };

    const backAnimatedStyle = {
        transform: [{ rotateY: backInterpolate }],
    };

    return (
        <View style={styles.cardContainer}>
            <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={styles.cardWrapper}>
                <Animated.View style={[styles.card, frontAnimatedStyle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.cardHeader}>
                        <Sparkles size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.cardNumber, { color: colors.textSecondary }]}>Question {index + 1} / {total}</Text>
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{card.question}</Text>
                    <Text style={[styles.tapHint, { color: colors.textSecondary }]}>Tap to see answer</Text>
                </Animated.View>

                <Animated.View style={[styles.card, styles.cardBack, backAnimatedStyle, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.cardNumber, { color: 'rgba(255,255,255,0.6)' }]}>Answer</Text>
                    <Text style={[styles.cardContentBack, { color: colors.background }]}>{card.answer}</Text>
                    <Text style={[styles.tapHint, { color: 'rgba(255,255,255,0.6)' }]}>Tap to see question</Text>
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
};

export default function FlashcardsScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { isOffline } = useNetwork();
    const { transcript } = route.params || {};

    const [count, setCount] = useState(5);
    const [flashcards, setFlashcards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    const saveFlashcards = async (data) => {
        try {
            if (!route.params?.id) return;

            // Fetch current lecture data from cloud and update flashcards
            const lectures = await fetchLecturesFromCloud();
            const lecture = lectures.find(c => c.id === route.params.id);

            if (lecture) {
                const updatedLecture = { ...lecture, flashcards: data };
                await syncLectureToCloud(updatedLecture);
            }
        } catch (error) {
            console.error('Error saving flashcards to cloud:', error);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            const loadStored = async () => {
                if (route.params?.id) {
                    try {
                        const lectures = await fetchLecturesFromCloud();
                        const lecture = lectures.find(c => c.id === route.params.id);
                        if (lecture?.flashcards) {
                            setFlashcards(lecture.flashcards);
                        }
                    } catch (error) {
                        console.error('Error loading flashcards from cloud:', error);
                    }
                }
            };
            loadStored();
        }, [route.params?.id])
    );

    const handleGenerate = async () => {
        if (isOffline) {
            Alert.alert("Offline Mode", "Flashcard generation requires an internet connection. Please connect and try again.");
            return;
        }

        if (!transcript || transcript.trim().length === 0) {
            Alert.alert("Missing Content", "No transcript found for this lecture. Please wait for transcription to complete.");
            return;
        }

        setLoading(true);
        try {
            const data = await aiService.generateFlashcards(transcript, count);
            if (data && data.length > 0) {
                setFlashcards(data);
                setCurrentIndex(0);
                await saveFlashcards(data);
            } else {
                Alert.alert("Generation Failed", "AI could not generate flashcards from this content. Try a different transcript.");
            }
        } catch (error) {
            console.error('Error generating flashcards:', error);
            Alert.alert("Error", error.message || "Failed to generate flashcards. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    const nextCard = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const prevCard = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const reset = () => {
        setFlashcards([]);
        setCount(5);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <LoadingOverlay visible={loading} message="Crafting Flashcards..." />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: isDark ? colors.tint : '#FFFFFF', borderColor: colors.border }]}>
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Flashcards</Text>
                <View style={{ width: 44 }} />
            </View>

            {flashcards.length === 0 ? (
                <View style={styles.setupContainer}>
                    <View style={styles.iconCircle}>
                        <Layers size={40} color={colors.primary} />
                    </View>
                    <Text style={[styles.setupTitle, { color: colors.text }]}>Create Flashcards</Text>
                    <Text style={[styles.setupDesc, { color: colors.textSecondary }]}>
                        Pick how many cards you want to generate from this lecture.
                    </Text>

                    <View style={[styles.stepperContainer, { backgroundColor: isDark ? colors.tint : '#F9F9F9', borderColor: colors.border }]}>
                        <TouchableOpacity
                            onPress={() => setCount(Math.max(5, count - 1))}
                            style={styles.stepButton}
                        >
                            <Minus size={20} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.countContainer}>
                            <Text style={[styles.countText, { color: colors.text }]}>{count}</Text>
                            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>Cards</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setCount(Math.min(15, count + 1))}
                            style={styles.stepButton}
                        >
                            <Plus size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.generateButton, { backgroundColor: colors.primary }]}
                        onPress={handleGenerate}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={isDark ? colors.background : "#FFF"} />
                        ) : (
                            <Text style={[styles.generateButtonText, { color: isDark ? colors.background : "#FFF" }]}>Generate Cards</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.content}>
                    <Flashcard
                        key={currentIndex}
                        card={flashcards[currentIndex]}
                        index={currentIndex}
                        total={flashcards.length}
                    />

                    <View style={styles.controls}>
                        <TouchableOpacity
                            onPress={prevCard}
                            disabled={currentIndex === 0}
                            style={[styles.navButton, currentIndex === 0 && { opacity: 0.3 }]}
                        >
                            <ChevronLeft size={30} color={colors.text} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={reset} style={[styles.resetButton, { backgroundColor: colors.tint }]}>
                            <RotateCcw size={20} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, marginLeft: 8, fontWeight: '600' }}>Reset</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={nextCard}
                            disabled={currentIndex === flashcards.length - 1}
                            style={[styles.navButton, currentIndex === flashcards.length - 1 && { opacity: 0.3 }]}
                        >
                            <ChevronRight size={30} color={colors.text} />
                        </TouchableOpacity>
                    </View>
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: Platform.OS === 'android' ? 20 : 0,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Inter_600SemiBold',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            }
        })
    },
    setupContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    setupTitle: {
        fontSize: 24,
        fontFamily: 'Inter_800ExtraBold',
        marginBottom: 12,
        textAlign: 'center',
    },
    setupDesc: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 40,
        fontFamily: 'Inter_400Regular',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 40,
        padding: 5,
    },
    stepButton: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countContainer: {
        paddingHorizontal: 30,
        alignItems: 'center',
    },
    countText: {
        fontSize: 24,
        fontWeight: '700',
    },
    countLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    generateButton: {
        width: '100%',
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    generateButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    cardContainer: {
        width: width - 40,
        height: 450,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardWrapper: {
        width: '100%',
        height: '100%',
    },
    card: {
        width: '100%',
        height: '100%',
        borderRadius: 32,
        padding: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        backfaceVisibility: 'hidden',
        position: 'absolute',
        top: 0,
        left: 0,
    },
    cardBack: {
        transform: [{ rotateY: '180deg' }],
    },
    cardNumber: {
        position: 'absolute',
        top: 30,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    cardTitle: {
        fontSize: 24,
        fontFamily: 'Inter_700Bold',
        textAlign: 'center',
        lineHeight: 34,
    },
    cardContentBack: {
        fontSize: 18,
        lineHeight: 28,
        textAlign: 'center',
        fontWeight: '500',
    },
    tapHint: {
        position: 'absolute',
        bottom: 30,
        fontSize: 13,
        fontWeight: '600',
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 40,
        paddingHorizontal: 20,
    },
    navButton: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    // Loading Overlay Styles
    loadingOverlay: {
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingBox: {
        width: '80%',
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '700',
        marginTop: 20,
        textAlign: 'center',
    },
    loadingSubtext: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    cardHeader: {
        position: 'absolute',
        top: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    }
});
