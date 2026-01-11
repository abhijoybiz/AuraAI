import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Dimensions,
    Animated,
    Modal
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
    ChevronLeft,
    Save,
    RotateCcw,
    Edit2,
    Check,
    Download,
    Info,
    Plus,
    X,
    GripVertical,
    Sparkles,
    Send,
    Terminal
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';
import { aiService } from '../services/ai.js';

/**
 * NotesScreen - Premium Notion-like editor with AI slash commands and PDF export.
 */

const { width, height } = Dimensions.get('window');

const MarkdownText = ({ text, style, isDark }) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return (
        <Text style={style}>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <Text key={i} style={{ fontWeight: '800' }}>{part.slice(2, -2)}</Text>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <Text key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
                }
                return part;
            })}
        </Text>
    );
};

const NoteBlock = ({ block, index, onUpdate, isEditMode, isDark, colors, onSlashCommand }) => {
    const [content, setContent] = useState(block.content);

    useEffect(() => {
        setContent(block.content);
    }, [block.content]);

    const handleUpdate = (newContent) => {
        setContent(newContent);
        onUpdate(index, newContent);

        if (newContent.endsWith('/')) {
            onSlashCommand(index);
        }
    };

    const getBlockStyle = () => {
        switch (block.type) {
            case 'heading':
            case 'h1':
                return [styles.h1Block, { color: colors.text }];
            case 'h2':
                return [styles.h2Block, { color: colors.text }];
            case 'bullet':
            case 'numbered':
                return [styles.listBlock, { color: colors.textSecondary }];
            default:
                return [styles.paragraphBlock, { color: colors.textSecondary }];
        }
    };

    return (
        <View style={styles.blockContainer}>
            {isEditMode && (
                <View style={styles.blockHandle}>
                    <GripVertical size={16} color={colors.textSecondary} opacity={0.3} />
                </View>
            )}

            <View style={styles.blockContent}>
                {block.type === 'bullet' && (
                    <Text style={[styles.bulletPoint, { color: colors.primary }]}>•</Text>
                )}
                {block.type === 'numbered' && (
                    <Text style={[styles.bulletPoint, { color: colors.primary }]}>{block.order || index + 1}.</Text>
                )}

                {isEditMode ? (
                    <TextInput
                        multiline
                        value={content}
                        onChangeText={handleUpdate}
                        placeholder={index === 0 ? "Type something..." : "Empty block"}
                        placeholderTextColor={colors.textSecondary + '66'}
                        style={[getBlockStyle(), styles.editingInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
                    />
                ) : (
                    <MarkdownText
                        text={block.content}
                        style={getBlockStyle()}
                        isDark={isDark}
                    />
                )}
            </View>
        </View>
    );
};

const ConceptualInfoBar = ({ colors }) => (
    <View style={[styles.infoBar, { backgroundColor: colors.tint }]}>
        <Info size={14} color={colors.textSecondary} />
        <Text style={[styles.infoBarText, { color: colors.textSecondary }]}>
            These notes are for conceptual understanding only.
        </Text>
    </View>
);

export default function NotesScreen({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { isOffline } = useNetwork();
    const { transcript, id } = route.params || {};

    const [title, setTitle] = useState('Untitled Note');
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // AI Slash Command States
    const [showAISlash, setShowAISlash] = useState(false);
    const [activeBlockIndex, setActiveBlockIndex] = useState(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isModifying, setIsModifying] = useState(false);

    const scrollY = useRef(new Animated.Value(0)).current;

    const onScroll = useRef(
        Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
        )
    ).current;

    useEffect(() => {
        loadStoredNotes();
    }, []);

    const loadStoredNotes = async () => {
        if (!id) return;
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards) {
                const cards = JSON.parse(storedCards);
                const card = cards.find(c => c.id === id);
                if (card) {
                    const existingTitle = card.title || 'Untitled Note';
                    setTitle(existingTitle);

                    if (card.notes && card.notes.length > 0) {
                        setBlocks(card.notes);
                    } else if (transcript) {
                        // Only auto-generate if online
                        if (!isOffline) {
                            handleGenerate(existingTitle);
                        } else {
                            setBlocks([{ type: 'paragraph', content: 'You are offline. Connect to generate AI notes for this lecture.' }]);
                        }
                    } else {
                        // Empty state: add one block
                        setBlocks([{ type: 'paragraph', content: '' }]);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    };

    const handleGenerate = async (forcedTitle) => {
        if (isOffline) {
            Alert.alert("Offline Mode", "Note generation requires an internet connection.");
            return;
        }

        if (!transcript || transcript.trim().length === 0) {
            Alert.alert("Missing Content", "No transcript found for this lecture. Please wait for transcription to complete.");
            return;
        }

        setLoading(true);
        try {
            const data = await aiService.generateNotes(transcript);
            if (data && data.length > 0) {
                setBlocks(data);
                await saveNotes(data, forcedTitle || title);
            } else {
                Alert.alert("Generation Failed", "AI could not generate notes from this content.");
            }
        } catch (error) {
            console.error('Error generating notes:', error);
            Alert.alert("Error", error.message || "Failed to generate notes. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const saveNotes = async (newBlocks, newTitle) => {
        try {
            const storedCards = await AsyncStorage.getItem('@memry_cards');
            if (storedCards && id) {
                const cards = JSON.parse(storedCards);
                const updatedCards = cards.map(c =>
                    c.id === id ? {
                        ...c,
                        notes: newBlocks || blocks,
                        title: newTitle || title
                    } : c
                );
                await AsyncStorage.setItem('@memry_cards', JSON.stringify(updatedCards));
                setHasChanges(false);
            }
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    };

    const updateBlock = (index, newContent) => {
        const newBlocks = [...blocks];
        newBlocks[index].content = newContent;
        setBlocks(newBlocks);
        setHasChanges(true);
    };

    const addBlock = (index, type = 'paragraph') => {
        const newBlocks = [...blocks];
        newBlocks.splice(index + 1, 0, { type: type, content: '' });
        setBlocks(newBlocks);
        setHasChanges(true);
    };

    const deleteBlock = (index) => {
        if (blocks.length <= 1) {
            setBlocks([{ type: 'paragraph', content: '' }]);
            return;
        }
        const newBlocks = blocks.filter((_, i) => i !== index);
        setBlocks(newBlocks);
        setHasChanges(true);
    };

    const changeBlockType = (index, type) => {
        const newBlocks = [...blocks];
        newBlocks[index].type = type;
        setBlocks(newBlocks);
        setHasChanges(true);
    };

    const handleSlashCommand = (index) => {
        setActiveBlockIndex(index);
        setShowAISlash(true);
    };

    const handleAiModify = async () => {
        if (!aiPrompt.trim()) return;

        if (isOffline) {
            Alert.alert("Offline Mode", "AI modification requires an internet connection.");
            return;
        }

        setIsModifying(true);
        try {
            const updatedBlocks = await aiService.modifyNotes(blocks, aiPrompt);
            setBlocks(updatedBlocks);
            setHasChanges(true);
            setShowAISlash(false);
            setAiPrompt('');
        } catch (error) {
            Alert.alert("Error", "AI failed to modify notes.");
        } finally {
            setIsModifying(false);
        }
    };

    const exportToPDF = async () => {
        try {
            const html = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                            padding: 60px 50px; 
                            color: #18181B;
                            line-height: 1.6;
                        }
                        .header {
                            margin-bottom: 40px;
                            border-bottom: 2px solid #F4F4F5;
                            padding-bottom: 20px;
                        }
                        .disclaimer { 
                            font-size: 11px; 
                            color: #71717A; 
                            margin-bottom: 24px;
                            font-style: italic;
                        }
                        h1 { 
                            font-size: 32px; 
                            font-weight: 800; 
                            margin: 0;
                            letter-spacing: -0.02em;
                        }
                        h2 { 
                            font-size: 20px; 
                            font-weight: 700; 
                            margin-top: 32px; 
                            margin-bottom: 12px;
                            color: #18181B;
                        }
                        p { 
                            font-size: 15px; 
                            margin-bottom: 16px;
                            color: #3F3F46;
                        }
                        ul, ol { 
                            padding-left: 20px;
                            margin-bottom: 20px;
                        }
                        li { 
                            margin-bottom: 8px;
                            font-size: 15px;
                            color: #3F3F46;
                        }
                        .bold { font-weight: 700; }
                        .italic { font-style: italic; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="disclaimer">Conceptual Study Notes</div>
                        <h1>${title}</h1>
                    </div>
                    ${blocks.map(block => {
                const content = block.content
                    .replace(/\*\*(.*?)\*\*/g, '<span class="bold">$1</span>')
                    .replace(/\*(.*?)\*/g, '<span class="italic">$1</span>');

                if (block.type === 'heading' || block.type === 'h1') return `<h1>${content}</h1>`;
                if (block.type === 'h2') return `<h2>${content}</h2>`;
                if (block.type === 'bullet') return `<ul><li>${content}</li></ul>`;
                if (block.type === 'numbered') return `<ol><li>${content}</li></ol>`;
                return `<p>${content}</p>`;
            }).join('')}
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            console.error('PDF Export Error:', error);
            Alert.alert("Export Failed", "Could not generate PDF.");
        }
    };

    const blurOpacity = scrollY.interpolate({
        inputRange: [0, 50],
        outputRange: [0, 1],
        extrapolate: 'clamp'
    });

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {/* Header Actions */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={[styles.headerIconCircle, { backgroundColor: isDark ? colors.tint : '#F4F4F5' }]}
                    >
                        <ChevronLeft size={22} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            onPress={handleGenerate}
                            style={[styles.headerIconCircle, { backgroundColor: isDark ? colors.tint : '#F4F4F5' }]}
                        >
                            <RotateCcw size={20} color={colors.text} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={exportToPDF}
                            style={[styles.headerIconCircle, { backgroundColor: isDark ? colors.tint : '#F4F4F5' }]}
                        >
                            <Download size={20} color={colors.text} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                if (isEditMode) saveNotes();
                                if (!isEditMode && blocks.length === 0) setBlocks([{ type: 'paragraph', content: '' }]);
                                setIsEditMode(!isEditMode);
                            }}
                            style={[styles.headerIconCircle, { backgroundColor: isEditMode ? colors.primary : (isDark ? colors.tint : '#F4F4F5') }]}
                        >
                            {isEditMode ? (
                                <Check size={20} color={isDark ? colors.background : '#FFF'} />
                            ) : (
                                <Edit2 size={20} color={colors.text} />
                            )}
                        </TouchableOpacity>

                        {hasChanges && !isEditMode && (
                            <TouchableOpacity
                                onPress={() => {
                                    saveNotes();
                                    Alert.alert("Saved", "Notes have been updated.");
                                }}
                                style={[styles.headerIconCircle, { backgroundColor: colors.primary }]}
                            >
                                <Save size={20} color={isDark ? colors.background : '#FFF'} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Progressive Blur at the top */}
                <Animated.View style={[styles.topBlurWrapper, { opacity: blurOpacity }]} pointerEvents="none">
                    <LinearGradient
                        colors={[colors.background, colors.background + 'EE', colors.background + '00']}
                        style={styles.blurGradient}
                    />
                </Animated.View>

                {/* Main Content */}
                {loading ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Synthesizing your notes...</Text>
                    </View>
                ) : (
                    <Animated.ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                    >
                        {/* Conceptual Info Bar - Scrolls with content */}
                        <ConceptualInfoBar colors={colors} />

                        {/* Title Section - Scrolls with content */}
                        <View style={styles.titleContainer}>
                            <TextInput
                                multiline
                                value={title}
                                onChangeText={(text) => {
                                    setTitle(text);
                                    setHasChanges(true);
                                }}
                                style={[styles.noteTitle, { color: colors.text }]}
                                placeholder="Untitled Note"
                                placeholderTextColor={colors.textSecondary + '44'}
                                editable={isEditMode}
                            />
                        </View>

                        {blocks.length > 0 ? (
                            blocks.map((block, idx) => (
                                <View key={idx}>
                                    <NoteBlock
                                        block={block}
                                        index={idx}
                                        onUpdate={updateBlock}
                                        isEditMode={isEditMode}
                                        isDark={isDark}
                                        colors={colors}
                                        onSlashCommand={handleSlashCommand}
                                    />
                                    {isEditMode && (
                                        <View style={styles.blockControls}>
                                            <TouchableOpacity
                                                onPress={() => addBlock(idx)}
                                                style={[styles.smallAction, { backgroundColor: colors.tint }]}
                                            >
                                                <Plus size={14} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => deleteBlock(idx)}
                                                style={[styles.smallAction, { backgroundColor: colors.tint }]}
                                            >
                                                <X size={14} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            <View style={{ flex: 1 }} />
                                            {['p', 'h1', 'bullet', 'numbered'].map(type => (
                                                <TouchableOpacity
                                                    key={type}
                                                    onPress={() => changeBlockType(idx, type === 'p' ? 'paragraph' : type)}
                                                    style={[
                                                        styles.typeChip,
                                                        { backgroundColor: (block.type === type || (block.type === 'paragraph' && type === 'p')) ? colors.primary + '22' : 'transparent' }
                                                    ]}
                                                >
                                                    <Text style={[styles.typeChipText, { color: (block.type === type || (block.type === 'paragraph' && type === 'p')) ? colors.primary : colors.textSecondary }]}>
                                                        {type.toUpperCase()}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={{ color: colors.textSecondary }}>No content available.</Text>
                            </View>
                        )}
                        <View style={{ height: 100 }} />
                    </Animated.ScrollView>
                )}

                {/* Floating "In Edit Mode" Indicator */}
                {isEditMode && (
                    <View style={[styles.editStatus, { backgroundColor: colors.primary, shadowColor: colors.shadow }]}>
                        <Text style={[styles.editStatusText, { color: isDark ? colors.background : '#FFF' }]}>Editing Mode</Text>
                    </View>
                )}

                {/* AI Slash Command Modal */}
                <Modal
                    visible={showAISlash}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowAISlash(false)}
                >
                    <View style={styles.modalOverlay}>
                        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            onPress={() => setShowAISlash(false)}
                        />
                        <View style={[styles.aiModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={styles.aiModalHeader}>
                                <View style={styles.aiIconBadge}>
                                    <Sparkles size={18} color={colors.primary} />
                                </View>
                                <Text style={[styles.aiModalTitle, { color: colors.text }]}>Ask AI to modify</Text>
                                <TouchableOpacity onPress={() => setShowAISlash(false)}>
                                    <X size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.aiInputContainer, { backgroundColor: isDark ? colors.tint : '#F9F9F9' }]}>
                                <TextInput
                                    autoFocus
                                    multiline
                                    placeholder="e.g., 'Summarize these notes', 'Simplify language'"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[styles.aiInput, { color: colors.text }]}
                                    value={aiPrompt}
                                    onChangeText={setAiPrompt}
                                />
                                <TouchableOpacity
                                    style={[styles.aiSendButton, { backgroundColor: aiPrompt.trim() ? colors.primary : colors.textSecondary + '44' }]}
                                    onPress={handleAiModify}
                                    disabled={!aiPrompt.trim() || isModifying}
                                >
                                    {isModifying ? (
                                        <ActivityIndicator color={isDark ? colors.background : "#FFF"} size="small" />
                                    ) : (
                                        <Send size={18} color={isDark ? colors.background : "#FFF"} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.aiSuggestions}>
                                {['Summarize', 'Add more detail', 'Fix grammar', 'Bullets to steps'].map((s) => (
                                    <TouchableOpacity
                                        key={s}
                                        style={[styles.suggestionChip, { backgroundColor: colors.tint }]}
                                        onPress={() => setAiPrompt(s)}
                                    >
                                        <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 64,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginTop: Platform.OS === 'android' ? 24 : 0,
        zIndex: 10,
    },
    headerIconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 10,
    },
    topBlurWrapper: {
        position: 'absolute',
        top: 64 + (Platform.OS === 'android' ? 24 : 0),
        left: 0,
        right: 0,
        height: 40,
        zIndex: 5,
    },
    blurGradient: {
        flex: 1,
    },
    infoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 0,
        marginVertical: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 8,
    },
    infoBarText: {
        fontSize: 12,
        fontWeight: '500',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter_400Regular',
    },
    titleContainer: {
        paddingTop: 8,
        paddingBottom: 20,
    },
    noteTitle: {
        fontSize: 36,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter_800ExtraBold',
        fontWeight: '800',
        letterSpacing: -1.2,
        lineHeight: 44,
        padding: 0,
    },
    scrollContent: {
        paddingHorizontal: 28,
        paddingTop: 10,
    },
    blockContainer: {
        flexDirection: 'row',
        marginBottom: 10,
        minHeight: 30,
    },
    blockHandle: {
        width: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -16,
    },
    blockContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    bulletPoint: {
        fontSize: 18,
        fontWeight: '700',
        marginRight: 10,
        marginTop: Platform.OS === 'android' ? 2 : 0,
        width: 20,
        textAlign: 'center',
    },
    h1Block: {
        fontSize: 26,
        fontWeight: '800',
        lineHeight: 34,
        marginTop: 20,
        marginBottom: 8,
        padding: 0,
    },
    h2Block: {
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 28,
        marginTop: 16,
        marginBottom: 6,
        padding: 0,
    },
    listBlock: {
        fontSize: 17,
        lineHeight: 28,
        padding: 0,
        flex: 1,
    },
    paragraphBlock: {
        fontSize: 17,
        lineHeight: 28,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter_500Medium',
        padding: 0,
        flex: 1,
    },
    editingInput: {
        borderRadius: 8,
        padding: 8,
        margin: -8,
        minHeight: 40,
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loaderText: {
        marginTop: 16,
        fontSize: 15,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingTop: 40,
    },
    editStatus: {
        position: 'absolute',
        bottom: 30,
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 100,
    },
    editStatusText: {
        fontWeight: '800',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    // AI Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    aiModal: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    aiModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    aiIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    aiModalTitle: {
        flex: 1,
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
    },
    aiInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderRadius: 16,
        padding: 12,
        gap: 12,
    },
    aiInput: {
        flex: 1,
        fontSize: 15,
        maxHeight: 120,
        paddingTop: 0,
    },
    aiSendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiSuggestions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
    },
    suggestionChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    suggestionText: {
        fontSize: 12,
        fontWeight: '600',
    },
    blockControls: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 24,
        marginBottom: 16,
        gap: 8,
    },
    smallAction: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    typeChipText: {
        fontSize: 10,
        fontWeight: 'bold',
    }
});
