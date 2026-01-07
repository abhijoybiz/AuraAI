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

    const getFontWeight = () => {
        switch (type) {
            case "title": return "700";
            case "subtitle": return "600";
            default: return "400";
        }
    };

    const baseStyle = {
        color: color || colors.text,
        fontSize: getFontSize(),
        fontWeight: getFontWeight(),
    };

    return (
        <Text style={[baseStyle, style]} {...props}>
            {children}
        </Text>
    );
};
