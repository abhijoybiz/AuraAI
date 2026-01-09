import React, { useEffect, useRef } from "react";
import {
    View,
    Modal,
    StyleSheet,
    Pressable,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { SPACING, ALIASES } from "../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const { height } = Dimensions.get("window");

export const ModernModal = ({
    visible,
    onClose,
    title,
    children,
    animationType = "spring", // spring or fade
}) => {
    const { colors, isDark } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const translateY = useRef(new Animated.Value(height * 0.2)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 0,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
            translateY.setValue(height * 0.2);
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
            <Animated.View
                style={[
                    styles.backdrop,
                    { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.4)", opacity: fadeAnim },
                ]}
            >
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.centered}
                pointerEvents="box-none"
            >
                <Animated.View
                    style={[
                        styles.card,
                        {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: isDark ? 1 : 0,
                            opacity: fadeAnim,
                            transform: [{ translateY }, { scale: scaleAnim }],
                            ...ALIASES.shadow,
                        },
                    ]}
                >
                    {title && (
                        <View style={styles.header}>
                            <ThemedText type="subtitle" style={{ marginBottom: SPACING.s }}>{title}</ThemedText>
                        </View>
                    )}
                    {children}
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: SPACING.l,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    card: {
        width: "100%",
        maxWidth: 400,
        borderRadius: ALIASES.radiusLarge,
        padding: SPACING.l,
        overflow: "hidden",
    },
    header: {
        alignItems: "center",
        marginBottom: SPACING.xs,
    },
});

/* Small helper for inner components if not imported */
import { Text } from "react-native";
const ThemedText = ({ type, children, style }) => {
    const { colors } = useTheme();
    const size = type === 'subtitle' ? 18 : 16;
    const weight = type === 'subtitle' ? '600' : '400';
    return <Text style={[{ fontSize: size, fontWeight: weight, color: colors.text }, style]}>{children}</Text>
}
