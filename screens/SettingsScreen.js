import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
    Platform,
    Dimensions,
    Animated,
    Easing
} from 'react-native';
import {
    ChevronLeft,
    Moon,
    Sun,
    User,
    Bell,
    Lock,
    ChevronRight,
    LogOut,
    Mail,
    Shield,
    Check
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { StatusBar } from 'expo-status-bar';

const { height } = Dimensions.get('window');

/**
 * SettingsScreen - Professional, unified settings with dual-card theme selector.
 * Now includes a custom Top-to-Bottom slide animation for production stability.
 */

const SettingItem = ({ icon: Icon, title, value, onPress, toggle, onToggleChange, colors, isLast }) => (
    <TouchableOpacity
        style={[styles.settingItem, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
        onPress={onPress}
        disabled={toggle}
        activeOpacity={0.7}
    >
        <View style={[styles.settingIconBox, { backgroundColor: colors.tint }]}>
            <Icon size={20} color={colors.primary} />
        </View>
        <View style={styles.settingTextContent}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
            {value && <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>}
        </View>
        {toggle ? (
            <Switch
                value={onToggleChange}
                onValueChange={onPress}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (onToggleChange ? colors.primary : '#f4f3f4')}
            />
        ) : (
            <ChevronRight size={18} color={colors.textSecondary} opacity={0.5} />
        )}
    </TouchableOpacity>
);

const SectionHeader = ({ title, colors }) => (
    <Text style={[styles.sectionHeader, { color: colors.primary }]}>{title.toUpperCase()}</Text>
);

export default function SettingsScreen({ navigation }) {
    const { colors, isDark, themeType, setThemePreference } = useTheme();
    const { user, signOut } = useAuth();

    // Animation values
    const translateY = useRef(new Animated.Value(-height)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    // User profile state
    const [profile, setProfile] = useState({
        displayName: '',
        email: '',
        avatarInitial: '?',
    });
    const [isSigningOut, setIsSigningOut] = useState(false);

    // Entrance Animation
    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: 0,
                duration: 400,
                easing: Easing.out(Easing.poly(4)),
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -height,
                duration: 350,
                easing: Easing.in(Easing.poly(4)),
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            })
        ]).start(() => navigation.goBack());
    };

    // Fetch user profile data
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;

            let displayName = 'User';
            let email = user.email || '';

            if (user.user_metadata?.full_name) {
                displayName = user.user_metadata.full_name;
            } else {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('display_name, email')
                        .eq('id', user.id)
                        .single();

                    if (data && !error) {
                        displayName = data.display_name || displayName;
                        email = data.email || email;
                    }
                } catch (err) {
                    // Fail silently
                }
            }

            const avatarInitial = displayName.charAt(0).toUpperCase() || email.charAt(0).toUpperCase() || '?';

            setProfile({
                displayName,
                email,
                avatarInitial,
            });
        };

        fetchProfile();
    }, [user]);

    const handleSignOut = () => {
        Alert.alert(
            "Sign Out",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                        setIsSigningOut(true);
                        try {
                            await signOut();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                        } finally {
                            setIsSigningOut(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style={isDark ? "light" : "dark"} />

            {/* Background Overlay */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: 'rgba(0,0,0,0.5)', opacity }
                ]}
            >
                <TouchableOpacity style={{ flex: 1 }} onPress={handleClose} activeOpacity={1} />
            </Animated.View>

            <Animated.View style={[
                styles.slideContent,
                {
                    backgroundColor: colors.background,
                    transform: [{ translateY }]
                }
            ]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={handleClose}
                        style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <ChevronLeft size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Profile Header */}
                    <View style={styles.profileHeader}>
                        <View style={[styles.profileAvatar, { backgroundColor: isDark ? colors.primary : '#1a1a1a' }]}>
                            <Text style={[styles.profileAvatarText, { color: isDark ? colors.background : '#fff' }]}>
                                {profile.avatarInitial}
                            </Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={[styles.profileDisplayName, { color: colors.text }]}>
                                {profile.displayName}
                            </Text>
                            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
                                {profile.email}
                            </Text>
                        </View>
                    </View>

                    {/* Appearance Section */}
                    <View style={styles.section}>
                        <SectionHeader title="Appearance" colors={colors} />
                        <View style={styles.themeCardsContainer}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setThemePreference('light')}
                                style={[
                                    styles.themeCard,
                                    { backgroundColor: colors.card, borderColor: themeType === 'light' ? colors.primary : colors.border }
                                ]}
                            >
                                <View style={[styles.themeIconCircle, { backgroundColor: themeType === 'light' ? colors.primary + '15' : colors.tint }]}>
                                    <Sun size={24} color={themeType === 'light' ? colors.primary : colors.textSecondary} />
                                </View>
                                <Text style={[styles.themeCardLabel, { color: colors.text }]}>Light</Text>
                                {themeType === 'light' && (
                                    <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                                        <Check size={12} color="#FFF" strokeWidth={3} />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setThemePreference('dark')}
                                style={[
                                    styles.themeCard,
                                    { backgroundColor: colors.card, borderColor: themeType === 'dark' ? colors.primary : colors.border }
                                ]}
                            >
                                <View style={[styles.themeIconCircle, { backgroundColor: themeType === 'dark' ? colors.primary + '15' : colors.tint }]}>
                                    <Moon size={24} color={themeType === 'dark' ? colors.primary : colors.textSecondary} />
                                </View>
                                <Text style={[styles.themeCardLabel, { color: colors.text }]}>Dark</Text>
                                {themeType === 'dark' && (
                                    <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                                        <Check size={12} color="#FFF" strokeWidth={3} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Account Section */}
                    <View style={styles.section}>
                        <SectionHeader title="Account" colors={colors} />
                        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <SettingItem
                                icon={User}
                                title="Personal Info"
                                value={profile.displayName || 'Loading...'}
                                onPress={() => { }}
                                colors={colors}
                            />
                            <SettingItem
                                icon={Mail}
                                title="Email Address"
                                value={profile.email || 'Loading...'}
                                onPress={() => { }}
                                colors={colors}
                            />
                            <SettingItem
                                icon={Lock}
                                title="Security"
                                onPress={() => { }}
                                colors={colors}
                                isLast={true}
                            />
                        </View>
                    </View>

                    {/* Notifications & Privacy */}
                    <View style={styles.section}>
                        <SectionHeader title="Preferences" colors={colors} />
                        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <SettingItem
                                icon={Bell}
                                title="Push Notifications"
                                toggle={true}
                                onToggleChange={true}
                                onPress={() => { }}
                                colors={colors}
                            />
                            <SettingItem
                                icon={Shield}
                                title="Privacy Policy"
                                onPress={() => { }}
                                colors={colors}
                                isLast={true}
                            />
                        </View>
                    </View>

                    {/* Sign Out */}
                    <TouchableOpacity
                        style={[styles.signOutButton, { borderColor: '#EF4444' }]}
                        onPress={handleSignOut}
                    >
                        <LogOut size={20} color="#EF4444" />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>

                    <View style={{ height: 100 }} />
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    slideContent: {
        flex: 1,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
    },
    header: {
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Platform.OS === 'android' ? 20 : 0,
        zIndex: 10,
    },
    backButton: {
        position: 'absolute',
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 0.5,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -0.3,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 10,
        paddingHorizontal: 4,
    },
    profileAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    profileAvatarText: {
        fontSize: 24,
        fontFamily: 'Inter_800ExtraBold',
    },
    profileInfo: {
        flex: 1,
    },
    profileDisplayName: {
        fontSize: 20,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -0.5,
        marginBottom: 2,
    },
    profileEmail: {
        fontSize: 14,
        opacity: 0.6,
        fontFamily: 'Inter_400Regular',
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        fontSize: 12,
        fontFamily: 'Inter_700Bold',
        marginBottom: 12,
        marginLeft: 4,
        letterSpacing: 1,
    },
    themeCardsContainer: {
        flexDirection: 'row',
        gap: 16,
    },
    themeCard: {
        flex: 1,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        position: 'relative',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    themeIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    themeCardLabel: {
        fontSize: 15,
        fontFamily: 'Inter_700Bold',
        letterSpacing: -0.2,
    },
    checkBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionCard: {
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    settingIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    settingTextContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
    },
    settingValue: {
        fontSize: 13,
        marginTop: 2,
        opacity: 0.7,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginTop: 10,
        gap: 10,
    },
    signOutText: {
        color: '#EF4444',
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
    }
});
