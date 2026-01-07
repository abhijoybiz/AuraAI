export const COLORS = {
    light: {
        primary: "#000000",
        background: "#FFFFFF",
        card: "#FFFFFF",
        text: "#000000",
        textSecondary: "#666666",
        border: "#E5E5E5",
        notification: "#000000", // B&W alert
        success: "#000000",      // B&W success
        error: "#000000",        // B&W error
        overlay: "rgba(0,0,0,0.4)",
        inputBackground: "#F5F5F5",
        shadow: "#000000",
    },
    dark: {
        primary: "#FFFFFF",
        background: "#000000",
        card: "#121212",
        text: "#FFFFFF",
        textSecondary: "#A1A1A1",
        border: "#333333",
        notification: "#FFFFFF",
        success: "#FFFFFF",
        error: "#FFFFFF",
        overlay: "rgba(255,255,255,0.1)",
        inputBackground: "#1C1C1E",
        shadow: "#FFFFFF",
    },
};

export const SPACING = {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
};

export const ALIASES = {
    radius: 0, // Modern B&W often uses sharp corners or pill shapes. Let's stick to slight rounded or standard. The previous was 14. Let's keep it clean, maybe 12.
    radiusLarge: 16,
    shadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
};
