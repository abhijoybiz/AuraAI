import React, { createContext, useState, useContext, useEffect } from "react";
import { useColorScheme } from "react-native";
import { COLORS } from "../constants/theme";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemScheme = useColorScheme();
    const [themeName, setThemeName] = useState(systemScheme || "light");

    useEffect(() => {
        if (systemScheme) {
            setThemeName(systemScheme);
        }
    }, [systemScheme]);

    const toggleTheme = () => {
        setThemeName((prev) => (prev === "light" ? "dark" : "light"));
    };

    const theme = {
        name: themeName,
        colors: COLORS[themeName] || COLORS.light,
        isDark: themeName === "dark",
        toggleTheme,
    };

    return (
        <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
