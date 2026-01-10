import React, { createContext, useState, useContext, useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS } from "../constants/theme";

const ThemeContext = createContext();

const THEME_STORAGE_KEY = "@user_theme_preference";

export const ThemeProvider = ({ children }) => {
    const systemScheme = useColorScheme();
    const [themeType, setThemeType] = useState("system"); // 'system', 'light', 'dark'
    const [activeTheme, setActiveTheme] = useState(systemScheme || "light");

    // Load persisted theme preference
    useEffect(() => {
        const loadThemePreference = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
                if (savedTheme) {
                    setThemeType(savedTheme);
                }
            } catch (error) {
                console.error("Error loading theme preference:", error);
            }
        };
        loadThemePreference();
    }, []);

    // Update active theme when system scheme or theme type changes
    useEffect(() => {
        if (themeType === "system") {
            setActiveTheme(systemScheme || "light");
        } else {
            setActiveTheme(themeType);
        }
    }, [themeType, systemScheme]);

    const setThemePreference = async (type) => {
        try {
            setThemeType(type);
            await AsyncStorage.setItem(THEME_STORAGE_KEY, type);
        } catch (error) {
            console.error("Error saving theme preference:", error);
        }
    };

    const theme = {
        themeType, // 'system', 'light', 'dark'
        name: activeTheme, // 'light' or 'dark'
        colors: COLORS[activeTheme] || COLORS.light,
        isDark: activeTheme === "dark",
        setThemePreference,
    };

    return (
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
