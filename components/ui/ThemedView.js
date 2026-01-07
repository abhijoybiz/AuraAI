import React from "react";
import { View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export const ThemedView = ({ style, color, children, ...props }) => {
    const { colors } = useTheme();

    return (
        <View style={[{ backgroundColor: color || colors.background }, style]} {...props}>
            {children}
        </View>
    );
};
