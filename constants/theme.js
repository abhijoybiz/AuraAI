export const COLORS = {
    light: {
        primary: "#18181B", // Zinc 900
        background: "#FFFFFF",
        card: "#FFFFFF",
        text: "#09090B", // Zinc 950
        textSecondary: "#71717A", // Zinc 500
        border: "#E4E4E7", // Zinc 200
        notification: "#EF4444", // Red 500
        success: "#22C55E",      // Green 500
        error: "#EF4444",        // Red 500
        overlay: "rgba(0,0,0,0.4)",
        inputBackground: "#F4F4F5", // Zinc 100
        shadow: "#000000",
        tint: "#F4F4F5", // Zinc 100 for secondary buttons/chips
    },
    dark: {
        primary: "#F4F4F5", // Soft Zinc 100
        background: "#0D0D0F", // Deep neutral gray-black
        card: "#17171C", // Slightly lighter for depth
        text: "#E4E4E7", // Muted Zinc 200
        textSecondary: "#9DA3AE", // Muted cool gray
        border: "#2D2D33", // Subtle borders
        notification: "#F87171", // Softer Red 400
        success: "#4ADE80", // Softer Green 400
        error: "#F87171",
        overlay: "rgba(0,0,0,0.7)",
        inputBackground: "#1C1C21", // Between card and background
        shadow: "#000000",
        tint: "#26262E", // For secondary actions
    },
};

export const SPACING = {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
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
