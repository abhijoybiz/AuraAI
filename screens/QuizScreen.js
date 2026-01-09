import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Platform
} from 'react-native';
import { ChevronLeft, Pencil, Plus, Minus, Check, X, RotateCcw, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { aiService } from '../services/ai.js';

const { width } = Dimensions.get('window');

const QuizOption = ({ option, isSelected, isCorrect, showFeedback, onPress, disabled }) => {
    const { colors, isDark } = useTheme();

    let backgroundColor = isDark ? colors.tint : '#F9F9F9';
    let borderColor = colors.border;
    let textColor = colors.text;

    if (showFeedback) {
        if (isCorrect) {
            backgroundColor = 'rgba(34, 197, 94, 0.1)';
            borderColor = '#22C55E';
            textColor = '#166534';
        } else if (isSelected) {
            backgroundColor = 'rgba(239, 68, 68, 0.1)';
            borderColor = '#EF4444';
            textColor = '#991B1B';
        }
    } else if (isSelected) {
        backgroundColor = colors.primary;
        borderColor = colors.primary;
        textColor = isDark ? colors.background : '#FFFFFF';
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[styles.optionButton, { backgroundColor, borderColor, borderWidth: 1 }]}
        >
            <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
            {showFeedback && isCorrect && <Check size={20} color="#22C55E" />}
            {showFeedback && isSelected && !isCorrect && <X size={20} color="#EF4444" />}
        </TouchableOpacity>
    );
};

export default function QuizScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { transcript } = route.params || {};

    const [count, setCount] = useState(5);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    const saveQuiz = async (data) => {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards && route.params?.id) {
                const cards = JSON.parse(storedCards);
                const updatedCards = cards.map(c =>
                    c.id === route.params.id ? { ...c, quiz: data } : c
                );
                await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
            }
        } catch (error) {
            console.error('Error saving quiz:', error);
        }
    };

    React.useEffect(() => {
        const loadStored = async () => {
            if (route.params?.id) {
                const storedCards = await AsyncStorage.getItem('@memry_cards');
                if (storedCards) {
                    const cards = JSON.parse(storedCards);
                    const card = cards.find(c => c.id === route.params.id);
                    if (card?.quiz) {
                        setQuestions(card.quiz);
                    }
                }
            }
        };
        loadStored();
    }, [route.params?.id]);

    const handleGenerate = async () => {
        if (!transcript) return;
        setLoading(true);
        try {
            const data = await aiService.generateQuiz(transcript, count);
            setQuestions(data);
            setCurrentIndex(0);
            setScore(0);
            setQuizFinished(false);
            await saveQuiz(data);
        } catch (error) {
            console.error('Error generating quiz:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOptionSelect = (option) => {
        if (showFeedback) return;
        setSelectedOption(option);
        setShowFeedback(true);
        if (option === questions[currentIndex].correctAnswer) {
            setScore(score + 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setSelectedOption(null);
            setShowFeedback(false);
        } else {
            setQuizFinished(true);
        }
    };

    const reset = () => {
        setQuestions([]);
        setCount(5);
        setScore(0);
        setQuizFinished(false);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: isDark ? colors.tint : '#FFFFFF', borderColor: colors.border }]}>
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Interactive Quiz</Text>
                <View style={{ width: 44 }} />
            </View>

            {questions.length === 0 ? (
                <View style={styles.setupContainer}>
                    <View style={styles.iconCircle}>
                        <Pencil size={40} color="#F97316" />
                    </View>
                    <Text style={[styles.setupTitle, { color: colors.text }]}>Take a Quiz</Text>
                    <Text style={[styles.setupDesc, { color: colors.textSecondary }]}>
                        Test your knowledge from this lecture with AI-generated questions.
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
                            <Text style={[styles.countLabel, { color: colors.textSecondary }]}>Questions</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setCount(Math.min(10, count + 1))}
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
                            <Text style={[styles.generateButtonText, { color: isDark ? colors.background : "#FFF" }]}>Start Quiz</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : quizFinished ? (
                <View style={styles.setupContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                        <Check size={40} color="#22C55E" />
                    </View>
                    <Text style={[styles.setupTitle, { color: colors.text }]}>Quiz Completed!</Text>
                    <Text style={[styles.scoreText, { color: colors.primary }]}>{score} / {questions.length}</Text>
                    <Text style={[styles.setupDesc, { color: colors.textSecondary }]}>
                        {score === questions.length ? "Perfect score! You're a master of this topic." : "Good effort! Try again to improve your score."}
                    </Text>

                    <TouchableOpacity
                        style={[styles.generateButton, { backgroundColor: colors.primary, marginTop: 20 }]}
                        onPress={reset}
                    >
                        <RotateCcw size={20} color={isDark ? colors.background : "#FFF"} style={{ marginRight: 8 }} />
                        <Text style={[styles.generateButtonText, { color: isDark ? colors.background : "#FFF" }]}>Take Another Quiz</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={styles.progressHeader}>
                        <Text style={[styles.progressText, { color: colors.textSecondary }]}>Question {currentIndex + 1} of {questions.length}</Text>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / questions.length) * 100}%`, backgroundColor: '#F97316' }]} />
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        <Text style={[styles.questionText, { color: colors.text }]}>{questions[currentIndex].question}</Text>

                        <View style={styles.optionsContainer}>
                            {questions[currentIndex].options.map((option, idx) => (
                                <QuizOption
                                    key={idx}
                                    option={option}
                                    isSelected={selectedOption === option}
                                    isCorrect={option === questions[currentIndex].correctAnswer}
                                    showFeedback={showFeedback}
                                    onPress={() => handleOptionSelect(option)}
                                    disabled={showFeedback}
                                />
                            ))}
                        </View>
                    </ScrollView>

                    {showFeedback && (
                        <TouchableOpacity
                            style={[styles.nextButton, { backgroundColor: colors.primary }]}
                            onPress={handleNext}
                        >
                            <Text style={[styles.nextButtonText, { color: isDark ? colors.background : "#FFF" }]}>
                                {currentIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                            </Text>
                            <ChevronRight size={20} color={isDark ? colors.background : "#FFF"} />
                        </TouchableOpacity>
                    )}
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
        fontWeight: '700',
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
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    setupDesc: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 40,
    },
    scoreText: {
        fontSize: 48,
        fontWeight: '900',
        marginBottom: 10,
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
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    generateButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    progressHeader: {
        marginBottom: 30,
    },
    progressText: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#E4E4E7',
        borderRadius: 3,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    questionText: {
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 30,
        marginBottom: 32,
    },
    optionsContainer: {
        gap: 16,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 16,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
        marginRight: 10,
    },
    nextButton: {
        position: 'absolute',
        bottom: 30,
        left: 20,
        right: 20,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    nextButtonText: {
        fontSize: 16,
        fontWeight: '700',
    }
});
