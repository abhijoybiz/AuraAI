import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    TextInput,
    FlatList,
    Platform,
    ActivityIndicator,
    Animated,
    Alert,
    Keyboard,
    KeyboardAvoidingView
} from 'react-native';
import { ChevronLeft, Send, Sparkles, Layers, Pencil, BookOpenText, Route, MessageSquare, ArrowUp } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';
import { aiService } from '../services/ai.js';
import MarkdownMathRenderer from '../components/MarkdownMathRenderer';

const ActionCard = ({ type, onPress }) => {
    const { colors, isDark } = useTheme();

    const getCardDetails = () => {
        switch (type) {
            case 'flashcards':
                return {
                    label: 'Flashcards',
                    icon: <Layers size={20} color={colors.primary} />,
                    description: 'Study with generated flashcards'
                };
            case 'quiz':
                return {
                    label: 'Quizzes',
                    icon: <Pencil size={20} color={colors.primary} />,
                    description: 'Test your knowledge now'
                };
            case 'notes':
                return {
                    label: 'Study Notes',
                    icon: <BookOpenText size={20} color={colors.primary} />,
                    description: 'Detailed lecture notes'
                };
            case 'journey':
                return {
                    label: 'Journey Map',
                    icon: <Route size={20} color={colors.primary} />,
                    description: 'Visual learning path'
                };
            default:
                return { label: 'Material', icon: <MessageSquare size={20} color={colors.primary} /> };
        }
    };

    const details = getCardDetails();

    return (
        <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: isDark ? colors.tint : '#F9F9F9', borderColor: colors.border }]}
            onPress={onPress}
        >
            <View style={[styles.actionIconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(249, 115, 22, 0.05)' }]}>
                {details.icon}
            </View>
            <View style={styles.actionTextContainer}>
                <Text style={[styles.actionLabel, { color: colors.text }]}>{details.label}</Text>
                <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>{details.description}</Text>
            </View>
        </TouchableOpacity>
    );
};

const MessageItem = ({ item, onNavigate }) => {
    const { colors, isDark } = useTheme();
    const isUser = item.role === 'user';

    const renderContent = () => {
        const actionRegex = /\[ACTION:(FLASHCARDS|QUIZ|NOTES|JOURNEY)\]/gi;
        const matches = [...item.content.matchAll(actionRegex)];

        if (matches.length > 0) {
            const result = [];
            let lastIndex = 0;

            matches.forEach((match, index) => {
                // Add text before the match
                const textBefore = item.content.substring(lastIndex, match.index);
                if (textBefore.trim()) {
                    result.push(
                        <MarkdownMathRenderer
                            key={`text-${index}`}
                            content={textBefore.trim()}
                            style={[styles.messageText, { color: isUser ? '#FFF' : colors.text, marginBottom: 8 }]}
                        />
                    );
                }

                // Add the action card
                const type = match[1].toLowerCase();
                result.push(
                    <ActionCard
                        key={`action-${index}`}
                        type={type}
                        onPress={() => onNavigate(type)}
                    />
                );

                lastIndex = match.index + match[0].length;
            });

            // Add remaining text after the last match
            const remainingText = item.content.substring(lastIndex);
            if (remainingText.trim()) {
                result.push(
                    <MarkdownMathRenderer
                        key="text-final"
                        content={remainingText.trim()}
                        style={[styles.messageText, { color: isUser ? (isDark ? colors.background : "#FFF") : colors.text, marginTop: 8 }]}
                    />
                );
            }

            return <View>{result}</View>;
        }

        return (
            <MarkdownMathRenderer
                content={item.content}
                style={[styles.messageText, { color: isUser ? (isDark ? colors.background : "#FFF") : colors.text }]}
            />
        );
    };

    return (
        <View style={[
            styles.messageWrapper,
            isUser ? styles.userMessageWrapper : styles.aiMessageWrapper
        ]}>
            {!isUser && (
                <View style={[styles.aiAvatar, { backgroundColor: colors.primary }]}>
                    <Sparkles size={14} color={isDark ? colors.background : "#FFF"} />
                </View>
            )}
            <View style={[
                styles.messageBubble,
                isUser ?
                    { backgroundColor: colors.primary, borderBottomRightRadius: 4 } :
                    { backgroundColor: isDark ? colors.tint : '#F3F4F6', borderBottomLeftRadius: 4 }
            ]}>
                {renderContent()}
            </View>
        </View>
    );
};

export default function AIChatScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { isOffline } = useNetwork();
    const { lectureId, initialMessage, transcript } = (route && route.params) || {};

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const flatListRef = useRef(null);
    const keyboardHeight = useRef(new Animated.Value(0)).current;

    const storageKey = `@memry_chat_${lectureId}`;

    useEffect(() => {
        if (lectureId) loadChat();
    }, [lectureId]);

    const loadChat = async () => {
        try {
            const saved = await AsyncStorage.getItem(storageKey);
            let currentMessages = [];

            if (saved) {
                currentMessages = JSON.parse(saved);
                setMessages(currentMessages);
            }

            // If an initial message is passed, we check if it's already the last message
            // to avoid duplicates on re-mount, otherwise we send it.
            if (initialMessage && (!currentMessages.length || currentMessages[currentMessages.length - 1].content !== initialMessage)) {
                handleSend(initialMessage, currentMessages);
            }
        } catch (error) {
            console.error('Error loading chat:', error);
        }
    };

    const saveChat = async (newMessages) => {
        if (!lectureId) return;
        try {
            await AsyncStorage.setItem(storageKey, JSON.stringify(newMessages));
        } catch (error) {
            console.error('Error saving chat:', error);
        }
    };

    const handleSend = async (text = input, currentMessages = messages) => {
        const cleanText = text.trim();
        if (!cleanText) return;

        if (isOffline) {
            Alert.alert("Offline Mode", "Internet connection is required to chat with Memry.");
            return;
        }

        // Proactive keyword detection in user input
        let enrichedText = cleanText;
        const keywords = {
            flashcards: ['flashcard', 'flash cards', 'study cards'],
            quiz: ['quiz', 'test', 'exam', 'practice questions'],
            notes: ['notes', 'summary', 'main points'],
            journey: ['journey', 'roadmap', 'learning path']
        };

        // If user input specifically asks for something, help the AI realize it
        // We don't change what the user sees, but we can influence the AI's response if needed
        // For now, we'll rely on the system prompt being strong.

        const userMsg = { role: 'user', content: cleanText, timestamp: new Date().toISOString() };
        const updatedMessages = [...currentMessages, userMsg];

        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            // Ensure we have transcript. If not, maybe we can fetch it?
            let contextTranscript = transcript;
            if (!contextTranscript) {
                const storedCards = await AsyncStorage.getItem('@memry_cards');
                if (storedCards) {
                    const cards = JSON.parse(storedCards);
                    const card = cards.find(c => c.id === lectureId);
                    if (card && card.transcript) {
                        contextTranscript = Array.isArray(card.transcript)
                            ? card.transcript.map(t => t.text).join('\n')
                            : card.transcript;
                    }
                }
            }

            const aiResponse = await aiService.chat(updatedMessages, contextTranscript);
            const aiMsg = { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() };
            const finalMessages = [...updatedMessages, aiMsg];
            setMessages(finalMessages);
            saveChat(finalMessages);
        } catch (error) {
            console.error('Chat error:', error);
            Alert.alert("Chat Error", "Memry is acting up. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (type) => {
        let screen = '';
        switch (type.toLowerCase()) {
            case 'flashcards': screen = 'Flashcards'; break;
            case 'quiz': screen = 'Quiz'; break;
            case 'notes':
                // Using ResultsScreen with notes tab if applicable
                navigation.navigate('Results', { id: lectureId, activeTab: 'materials' });
                return;
            case 'journey':
                navigation.navigate('Whiteboard', {
                    lectureId: lectureId,
                    lectureText: transcript
                });
                return;
        }

        if (!screen) {
            Alert.alert("Coming Soon", `${type.charAt(0).toUpperCase() + type.slice(1)} feature is being polished!`);
            return;
        }

        navigation.navigate(screen, {
            transcript,
            id: lectureId
        });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton]}>
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Ask Memry</Text>
                </View>
                <View style={{ width: 44 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <View style={{ flex: 1 }}>
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item, index) => index.toString()}
                        renderItem={({ item }) => <MessageItem item={item} onNavigate={handleNavigate} />}
                        contentContainerStyle={styles.chatList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        style={{ flex: 1 }}
                    />

                    {loading && (
                        <View style={styles.loadingWrapper}>
                            <ActivityIndicator color={colors.primary} size="small" />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Memry is thinking...</Text>
                        </View>
                    )}

                    <View style={[styles.inputContainer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                        <View style={[styles.inputRow]}>
                            <View style={[styles.textInputWrapper, { backgroundColor: isDark ? colors.tint : '#F3F4F6' }]}>
                                <TextInput
                                    style={[styles.textInput, { color: colors.text }]}
                                    placeholder="Ask me anything..."
                                    placeholderTextColor={colors.textSecondary}
                                    value={input}
                                    onChangeText={setInput}
                                    multiline
                                    maxLength={500}
                                />
                            </View>
                            <TouchableOpacity
                                onPress={() => handleSend()}
                                disabled={!input.trim() || loading}
                                style={[
                                    styles.sendButton,
                                    { backgroundColor: input.trim() ? colors.primary : colors.textSecondary, opacity: input.trim() ? 1 : 0.5 }
                                ]}
                            >
                                <ArrowUp size={20} color={isDark ? colors.background : "#FFF"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
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
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000000ff",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 0,
    },
    headerInfo: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Inter_600SemiBold',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    chatList: {
        padding: 20,
        paddingBottom: 40,
    },
    messageWrapper: {
        flexDirection: 'row',
        marginBottom: 20,
        maxWidth: '85%',
    },
    userMessageWrapper: {
        alignSelf: 'flex-end',
        flexDirection: 'row-reverse',
    },
    aiMessageWrapper: {
        alignSelf: 'flex-start',
    },
    aiAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
        marginTop: 4,
    },
    messageBubble: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
        fontFamily: 'Inter_400Regular',
    },
    loadingWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    loadingText: {
        fontSize: 13,
        marginLeft: 8,
        fontWeight: '500',
    },
    inputContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    textInputWrapper: {
        flex: 1,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        minHeight: 48,
        maxHeight: 120,
        marginRight: 12,
    },
    textInput: {
        fontSize: 16,
        paddingTop: 4,
        paddingBottom: 4,
        fontFamily: 'Inter_400Regular',
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 0,
    },
    actionCard: {
        marginTop: 12,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    actionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    actionTextContainer: {
        flex: 1,
    },
    actionLabel: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
    actionDesc: {
        fontSize: 12,
        marginTop: 2,
    }
});
