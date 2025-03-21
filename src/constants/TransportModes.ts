/**
 * Transport mode styling constants
 * Centralized definitions for colors and styles used across the application
 */

// Mode colors - define selected and unselected versions for each mode
export const TRANSPORT_MODE_COLORS = {
    flight: {
        selected: '#9400FF',     // Neon Violet
        normal: '#9400FF99'      // Semi-transparent Neon Violet
    },
    train: {
        selected: '#FF6EC7',     // Neon Pink
        normal: '#FF6EC799'      // Semi-transparent Neon Pink
    },
    bus: {
        selected: '#FF8800',     // Neon Orange
        normal: '#FF880099'      // Semi-transparent Neon Orange
    },
    cab: {
        selected: '#00FFFF',     // Neon Cyan
        normal: '#00FFFF99'      // Semi-transparent Neon Cyan
    },
    // Default color for fallback
    default: {
        selected: '#FF44CC',     // Neon Purple-Pink
        normal: '#FF44CC99'      // Semi-transparent Neon Purple-Pink
    }
};





// Line widths for each mode (base width - will be adjusted for selected state)
export const TRANSPORT_MODE_WIDTHS = {
    flight: 4,
    train: 4,
    bus: 3,
    cab: 3,
    default: 3
};

// Width multiplier for selected paths
export const SELECTED_WIDTH_MULTIPLIER = 1.5;

// Line dash patterns for each mode
export const TRANSPORT_MODE_DASH_PATTERNS = {
    flight: [1, 8],
    train: [10, 10],
    bus: [],
    cab: [],
    default: []
};

// Human-readable labels for each mode
export const TRANSPORT_MODE_LABELS = {
    flight: 'Flight',
    train: 'Train',
    bus: 'Bus',
    cab: 'Cab'
};

// All available transport modes
export const TRANSPORT_MODES = [
    'flight',
    'train', 
    'bus', 
    'cab'
];

// Helper function to get color based on mode and selection state
export function getTransportModeColor(mode: string, isSelected: boolean): string {
    const modeColors = TRANSPORT_MODE_COLORS[mode as keyof typeof TRANSPORT_MODE_COLORS] || TRANSPORT_MODE_COLORS.default;
    return isSelected ? modeColors.selected : modeColors.normal;
}

// Helper function to get dash pattern for a mode
export function getTransportModeDash(mode: string): number[] {
    return TRANSPORT_MODE_DASH_PATTERNS[mode as keyof typeof TRANSPORT_MODE_DASH_PATTERNS] || TRANSPORT_MODE_DASH_PATTERNS.default;
}

// Helper function to get width for a mode
export function getTransportModeWidth(mode: string, isSelected: boolean): number {
    const baseWidth = TRANSPORT_MODE_WIDTHS[mode as keyof typeof TRANSPORT_MODE_WIDTHS] || TRANSPORT_MODE_WIDTHS.default;
    return isSelected ? baseWidth * SELECTED_WIDTH_MULTIPLIER : baseWidth;
} 