// components/OfflineDialog.js
// Dismissible offline mode info dialog - matches app's editing mode info dialog style

import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { WifiOff, X, Cloud, Eye } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useNetwork } from '../context/NetworkContext';

const { width } = Dimensions.get('window');

export default function OfflineDialog() {
    const { colors, isDark } = useTheme();
    const { showOfflineDialog, dismissOfflineDialog, isOffline } = useNetwork();

    const slideAnim = useRef(new Animated.Value(-200)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (showOfflineDialog) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 80,
                    friction: 10,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -200,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [showOfflineDialog]);

    if (!showOfflineDialog) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                }
            ]}
            pointerEvents="box-none"
        >
            <View
                style={[
                    styles.dialog,
                    {
                        backgroundColor: isDark ? 'rgba(30, 30, 35, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        shadowColor: '#000',
                    }
                ]}
            >
                {/* Icon */}
                <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' }]}>
                    <WifiOff size={20} color="#EF4444" strokeWidth={2.5} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        You're Offline
                    </Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>
                        View saved lectures only. Recording and AI features are disabled.
                    </Text>
                </View>

                {/* Dismiss Button */}
                <TouchableOpacity
                    style={[
                        styles.dismissButton,
                        { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' }
                    ]}
                    onPress={dismissOfflineDialog}
                    activeOpacity={0.7}
                >
                    <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 50 : 60,
        left: 0,
        right: 0,
        zIndex: 9999,
        alignItems: 'center',
        pointerEvents: 'box-none',
    },
    dialog: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginHorizontal: 20,
        borderRadius: 16,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        maxWidth: width - 40,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
        marginRight: 10,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter_700Bold',
        marginBottom: 2,
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Inter_400Regular',
    },
    dismissButton: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
