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
        primary: "#FAFAFA", // Zinc 50
        background: "#09090B", // Zinc 950
        card: "#09090B",
        text: "#FAFAFA",
        textSecondary: "#A1A1AA", // Zinc 400
        border: "#27272A", // Zinc 800
        notification: "#EF4444",
        success: "#22C55E",
        error: "#EF4444",
        overlay: "rgba(255,255,255,0.1)",
        inputBackground: "#27272A", // Zinc 800
        shadow: "#000000",
        tint: "#27272A",
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
