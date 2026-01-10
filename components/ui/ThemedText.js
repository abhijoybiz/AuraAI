import React from "react";
import { Text, StyleSheet } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export const ThemedText = ({ style, type = "body", color, children, ...props }) => {
    const { colors } = useTheme();

    const getFontSize = () => {
        switch (type) {
            case "title": return 24;
            case "subtitle": return 18;
            case "caption": return 12;
            default: return 16;
        }
    };

    const getFontFamily = () => {
        switch (type) {
            case "title": return "Inter_700Bold";
            case "subtitle": return "Inter_600SemiBold";
            default: return "Inter_400Regular";
        }
    };

    const baseStyle = {
        color: color || colors.text,
        fontSize: getFontSize(),
        fontFamily: getFontFamily(),
    };

    return (
        <Text style={[baseStyle, style]} {...props}>
            {children}
        </Text>
    );
};
