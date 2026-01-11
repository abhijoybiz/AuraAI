import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert, Mail, LogOut, ChevronRight, Activity } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AccessDeniedScreen = () => {
    const { colors, isDark } = useTheme();
    const { user, signOut } = useAuth();

    const handleContactSupport = () => {
        Linking.openURL('mailto:support@memry.app?subject=Whitelist Request&body=Identity Verification Request\n\nUser ID: ' + user?.id + '\nEmail: ' + user?.email + '\n\nRequesting access to Memry private beta.');
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* Security Icon */}
                    <View style={styles.iconWrapper}>
                        <View style={[styles.iconPulse, { backgroundColor: colors.tint, borderColor: colors.border }]}>
                            <ShieldAlert size={42} color={colors.error} strokeWidth={1.5} />
                        </View>
                    </View>

                    {/* Title & Identity */}
                    <View style={styles.identityHeader}>
                        <Text style={[styles.title, { color: colors.text }]}>ACCESS RESTRICTED</Text>
                        <View style={[styles.userBadge, { backgroundColor: colors.tint, borderColor: colors.border }]}>
                            <Text style={[styles.userEmail, { color: colors.text }]}>{user?.email?.toLowerCase()}</Text>
                        </View>
                    </View>

                    {/* Technical Description */}
                    <View style={[styles.reportCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.reportRow}>
                            <Activity size={14} color={colors.textSecondary} />
                            <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>AUTHORIZATION STATUS</Text>
                        </View>
                        <Text style={[styles.message, { color: colors.textSecondary }]}>
                            This account has been authenticated but is not yet authorized for the private beta environment. Access is currently managed via a manual verification process.
                        </Text>
                    </View>

                    {/* Action Grid */}
                    <View style={styles.actionSection}>
                        <TouchableOpacity
                            style={styles.primaryAction}
                            onPress={handleContactSupport}
                        >
                            <LinearGradient
                                colors={isDark ? ['#E4E4E7', '#A1A1AA'] : ['#18181B', '#27272A']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.actionGradient}
                            >
                                <Mail size={18} color={isDark ? colors.background : colors.card} style={styles.buttonIcon} />
                                <Text style={[styles.actionText, { color: isDark ? colors.background : colors.card }]}>Request Authorization</Text>
                                <ChevronRight size={18} color={isDark ? colors.background : colors.card} style={{ opacity: 0.5, marginLeft: 'auto' }} />
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.secondaryAction, { borderColor: colors.border }]}
                            onPress={signOut}
                        >
                            <LogOut size={18} color={colors.textSecondary} style={styles.buttonIcon} />
                            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Terminate Session</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer Info */}
                </View>
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
    content: {
        flex: 1,
        padding: 32,
        justifyContent: 'center',
    },
    iconWrapper: {
        alignItems: 'center',
        marginBottom: 32,
    },
    iconPulse: {
        width: 100,
        height: 100,
        borderRadius: 32,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    identityHeader: {
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 12,
        fontFamily: 'Inter_800ExtraBold',
        letterSpacing: 4,
        marginBottom: 16,
    },
    userBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
        borderWidth: 1,
    },
    userEmail: {
        fontSize: 14,
        fontFamily: 'Inter_500Medium',
    },
    reportCard: {
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 48,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
        justifyContent: "center",
        alignItems: 'center',
    },

    reportRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    reportLabel: {
        fontSize: 10,
        fontFamily: 'Inter_700Bold',
        marginLeft: 8,
        letterSpacing: 1,
    },
    reportValue: {
        fontSize: 10,
        fontFamily: 'Inter_800ExtraBold',
        marginLeft: 'auto',
    },
    message: {
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
        lineHeight: 24,
    },
    actionSection: {
        width: '100%',
        gap: 16,
    },
    primaryAction: {
        height: 60,
        borderRadius: 16,
        overflow: 'hidden',
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
    actionGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    actionText: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
    },
    buttonIcon: {
        marginRight: 12,
    },
    secondaryAction: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderRadius: 16,
        borderWidth: 1,
    },
    secondaryText: {
        fontSize: 16,
        fontFamily: 'Inter_500Medium',
    },
    footerNote: {
        marginTop: 64,
    },
    footerTitle: {
        fontSize: 10,
        fontFamily: 'Inter_800ExtraBold',
        letterSpacing: 2,
        marginBottom: 12,
        opacity: 0.8,
    },
    footerText: {
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
        lineHeight: 20,
    },
});

export default AccessDeniedScreen;

