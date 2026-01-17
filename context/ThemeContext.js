import React, { createContext, useState, useContext, useEffect } from "react";
import { useColorScheme } from "react-native";
import { fetchUserPreferences, updateUserPreference } from "../services/lectureStorage";
import { COLORS } from "../constants/theme";

const ThemeContext = createContext();

// Theme preference now managed in Supabase metadata

export const ThemeProvider = ({ children }) => {
    const systemScheme = useColorScheme();
    const [themeType, setThemeType] = useState("system"); // 'system', 'light', 'dark'
    const [activeTheme, setActiveTheme] = useState(systemScheme || "light");

    // Load persisted theme preference
    useEffect(() => {
        const loadThemePreference = async () => {
            const prefs = await fetchUserPreferences();
            if (prefs.theme) {
                setThemeType(prefs.theme);
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
        setThemeType(type);
        await updateUserPreference('theme', type);
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
