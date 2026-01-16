import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
    Image,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const AuthScreen = () => {
    const { colors, isDark } = useTheme();
    const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'reset'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localLoading, setLocalLoading] = useState(false);

    const { signIn, signUp, resetPassword, loading, error, clearError } = useAuth();

    const handleSignIn = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Required fields are missing');
            return;
        }

        setLocalLoading(true);
        const { error } = await signIn(email, password);
        setLocalLoading(false);

        if (error) {
            Alert.alert('Authentication Failed', error.message);
        }
    };

    const handleSignUp = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert('Error', 'Required fields are missing');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Security requirement: Password must be at least 6 characters');
            return;
        }

        setLocalLoading(true);
        const { error } = await signUp(email, password, fullName);
        setLocalLoading(false);

        if (error) {
            Alert.alert('Registration Failed', error.message);
        } else {
            Alert.alert(
                'Verification Required',
                'A confirmation link has been sent to your email address.',
                [{ text: 'Acknowledged', onPress: () => setMode('signin') }]
            );
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Error', 'Email address is required');
            return;
        }

        setLocalLoading(true);
        const { error } = await resetPassword(email);
        setLocalLoading(false);

        if (error) {
            Alert.alert('Reset Failed', error.message);
        } else {
            Alert.alert(
                'Identity Verification',
                'A password recovery link has been dispatched to your email.',
                [{ text: 'Acknowledged', onPress: () => setMode('signin') }]
            );
        }
    };

    const isLoading = loading || localLoading;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={styles.safeArea}>
                {/* Fixed Header Bar - Consistent with ResultsScreen */}
                <View style={styles.navigationHeader}>
                    {mode !== 'signin' && (
                        <TouchableOpacity
                            onPress={() => {
                                setMode('signin');
                                clearError();
                            }}
                            style={[styles.backButtonFixed, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
                        >
                            <ChevronLeft size={24} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Branded Logo Section */}
                        <View style={styles.header}>
                            <View style={styles.brandMark}>
                                <View style={[styles.logoPulse, { backgroundColor: colors.tint }]}>
                                    <Image
                                        source={isDark ? require('../assets/logo_white.png') : require('../assets/logo_black.png')}
                                        style={styles.headerLogo}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View>
                                    <Text style={[styles.logoText, { color: colors.text }]}>Memry</Text>
                                    <Text style={[styles.logoSubtext, { color: colors.textSecondary }]}>LECTURES SIMPLIFIED</Text>
                                </View>
                            </View>

                            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                                {mode === 'signin' && 'Sign in to access your dashboard'}
                                {mode === 'signup' && 'Create your institutional account'}
                                {mode === 'reset' && 'Account recovery process'}
                            </Text>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            {mode === 'signup' && (
                                <View style={styles.inputWrapper}>
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>FULL NAME</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                        <User size={18} color={colors.textSecondary} style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="Enter your name"
                                            placeholderTextColor={colors.textSecondary + '80'}
                                            value={fullName}
                                            onChangeText={setFullName}
                                            autoCapitalize="words"
                                        />
                                    </View>
                                </View>
                            )}

                            <View style={styles.inputWrapper}>
                                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>EMAIL ADDRESS</Text>
                                <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                    <Mail size={18} color={colors.textSecondary} style={styles.inputIcon} />
                                    <TextInput
                                        style={[styles.input, { color: colors.text }]}
                                        placeholder="user@example.com"
                                        placeholderTextColor={colors.textSecondary + '80'}
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            {mode !== 'reset' && (
                                <View style={styles.inputWrapper}>
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>PASSWORD</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                        <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="••••••••"
                                            placeholderTextColor={colors.textSecondary + '80'}
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!showPassword}
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <EyeOff size={18} color={colors.textSecondary} />
                                            ) : (
                                                <Eye size={18} color={colors.textSecondary} />
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {mode === 'signup' && (
                                <View style={styles.inputWrapper}>
                                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CONFIRM PASSWORD</Text>
                                    <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                                        <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
                                        <TextInput
                                            style={[styles.input, { color: colors.text }]}
                                            placeholder="••••••••"
                                            placeholderTextColor={colors.textSecondary + '80'}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            secureTextEntry={!showPassword}
                                            autoCapitalize="none"
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Forgot Password Link */}
                            {mode === 'signin' && (
                                <TouchableOpacity
                                    onPress={() => setMode('reset')}
                                    style={styles.forgotButton}
                                >
                                    <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot credentials?</Text>
                                </TouchableOpacity>
                            )}

                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                                onPress={() => {
                                    if (mode === 'signin') handleSignIn();
                                    else if (mode === 'signup') handleSignUp();
                                    else handleResetPassword();
                                }}
                                disabled={isLoading}
                            >
                                <LinearGradient
                                    colors={isDark ? ['#E4E4E7', '#A1A1AA'] : ['#18181B', '#27272A']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.submitGradient}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color={isDark ? colors.background : colors.card} size="small" />
                                    ) : (
                                        <View style={styles.submitContent}>
                                            <Text style={[styles.submitText, { color: isDark ? colors.background : colors.card }]}>
                                                {mode === 'signin' && 'Sign In'}
                                                {mode === 'signup' && 'Register'}
                                                {mode === 'reset' && 'Reset Password'}
                                            </Text>
                                            <ChevronRight size={18} color={isDark ? colors.background : colors.card} style={{ marginLeft: 4 }} />
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Switch Mode */}
                            {mode === 'signin' && (
                                <View style={styles.switchContainer}>
                                    <Text style={[styles.switchText, { color: colors.textSecondary }]}>Need an account? </Text>
                                    <TouchableOpacity onPress={() => setMode('signup')}>
                                        <Text style={[styles.switchLink, { color: colors.text }]}>Create one</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {mode === 'signup' && (
                                <View style={styles.switchContainer}>
                                    <Text style={[styles.switchText, { color: colors.textSecondary }]}>Already registered? </Text>
                                    <TouchableOpacity onPress={() => setMode('signin')}>
                                        <Text style={[styles.switchLink, { color: colors.text }]}>Sign in</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {mode === 'reset' && (
                                <View style={styles.switchContainer}>
                                    <Text style={[styles.switchText, { color: colors.textSecondary }]}>Remembered? </Text>
                                    <TouchableOpacity onPress={() => setMode('signin')}>
                                        <Text style={[styles.switchLink, { color: colors.text }]}>Sign in</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    navigationHeader: {
        height: 60,
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginTop: Platform.OS === 'android' ? 20 : 0,
    },
    backButtonFixed: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        ...Platform.select({
            ios: {
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        paddingHorizontal: 32,
        paddingBottom: 32,
    },
    header: {
        marginBottom: 40,
        marginTop: 10,
    },
    brandMark: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    logoPulse: {
        width: 57,
        height: 57,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    headerLogo: {
        width: 45,
        height: 45,
    },
    logoText: {
        fontSize: 30,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -1,
    },
    logoSubtext: {
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
        letterSpacing: 2,
        marginTop: -2,
    },
    tagline: {
        fontSize: 16,
        fontFamily: 'Inter_400Regular',
        lineHeight: 24,
    },
    form: {
        width: '100%',
    },
    inputWrapper: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 11,
        fontFamily: 'Inter_700Bold',
        marginBottom: 8,
        letterSpacing: 1,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        paddingHorizontal: 16,
        height: 56,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        height: '100%',
        fontSize: 16,
        fontFamily: 'Inter_500Medium',
    },
    eyeButton: {
        padding: 8,
    },
    forgotButton: {
        alignSelf: 'flex-end',
        marginBottom: 32,
        marginTop: -8,
    },
    forgotText: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    submitButton: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 32,
        height: 60,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    submitText: {
        fontSize: 17,
        fontFamily: 'Inter_600SemiBold',
    },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 0,
    },
    switchText: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
    },
    switchLink: {
        fontSize: 15,
        fontFamily: 'Inter_600SemiBold',
        textDecorationLine: 'underline',
    },
});

export default AuthScreen;
