/**
 * Transport mode styling constants
 * Centralized definitions for colors and styles used across the application
 */

// Mode colors - define selected and unselected versions for each mode
export const TRANSPORT_MODE_COLORS = {
    FLIGHTS: {
        icon: '#9400FF',     // Neon Violet
        selected: 'rgba(148, 0, 255, 0.7)'  // Semi-transparent Neon Violet
    },
    RAILS: {
        icon: '#FF6EC7',     // Neon Pink
        selected: 'rgba(255, 110, 199, 0.7)'  // Semi-transparent Neon Pink
    },
    BUS: {
        icon: '#FF8800',     // Neon Orange
        selected: 'rgba(255, 136, 0, 0.7)'  // Semi-transparent Neon Orange
    },
    CAB: {
        icon: '#00FFFF',     // Neon Cyan
        selected: 'rgba(0, 255, 255, 0.7)'  // Semi-transparent Neon Cyan
    },
    // Default color for fallback
    default: {
        icon: '#FF44CC',     // Neon Purple-Pink
        selected: 'rgba(255, 68, 204, 0.7)'  // Semi-transparent Neon Purple-Pink
    }
};

// Line widths for each mode (base width - will be adjusted for selected state)
export const TRANSPORT_MODE_WIDTHS = {
    FLIGHTS: 4,
    RAILS: 4,
    BUS: 3,
    CAB: 3,
    default: 3
};

// Width multiplier for selected paths
export const SELECTED_WIDTH_MULTIPLIER = 1.5;

// Line dash patterns for each mode
export const TRANSPORT_MODE_DASH_PATTERNS = {
    FLIGHTS: [],  // Adjusted to be more visible and consistent
    RAILS: [],  // Adjusted for better visibility
    BUS: [],         // Solid line
    CAB: [],         // Solid line
    default: []      // Solid line
};

// Human-readable labels for each mode
export const TRANSPORT_MODE_LABELS = {
    FLIGHTS: 'Flight',
    RAILS: 'Train',
    BUS: 'Bus',
    CAB: 'Cab'
};

// All available transport modes
export const TRANSPORT_MODES = [
    'FLIGHTS',
    'RAILS', 
    'BUS', 
    'CAB'
];

// Helper function to get color based on mode and selection state
export function getTransportModeColor(mode: string, isSelected: boolean): string {
    // Normalize mode to uppercase for consistency
    const normalizedMode = mode?.toUpperCase();
    
    // Map to valid transport mode key
    let modeKey: keyof typeof TRANSPORT_MODE_COLORS;
    switch (normalizedMode) {
        case 'FLIGHTS':
        case 'FLIGHT':
            modeKey = 'FLIGHTS';
            break;
        case 'RAILS':
        case 'RAIL':
        case 'TRAIN':
            modeKey = 'RAILS';
            break;
        case 'BUS':
            modeKey = 'BUS';
            break;
        case 'CAB':
        case 'TAXI':
            modeKey = 'CAB';
            break;
        default:
            modeKey = 'default';
    }
    
    const modeColors = TRANSPORT_MODE_COLORS[modeKey];
    return isSelected ? modeColors.selected : modeColors.icon;
}

// Helper function to get dash pattern for a mode
export function getTransportModeDash(mode: string): number[] {
    // Normalize mode to uppercase for consistency
    const normalizedMode = mode?.toUpperCase();
    
    // Map to valid transport mode key
    let modeKey: keyof typeof TRANSPORT_MODE_DASH_PATTERNS;
    switch (normalizedMode) {
        case 'FLIGHTS':
        case 'FLIGHT':
            modeKey = 'FLIGHTS';
            break;
        case 'RAILS':
        case 'RAIL':
        case 'TRAIN':
            modeKey = 'RAILS';
            break;
        case 'BUS':
            modeKey = 'BUS';
            break;
        case 'CAB':
        case 'TAXI':
            modeKey = 'CAB';
            break;
        default:
            modeKey = 'default';
    }
    
    return TRANSPORT_MODE_DASH_PATTERNS[modeKey];
}

// Helper function to get width for a mode
export function getTransportModeWidth(mode: string, isSelected: boolean): number {
    // Normalize mode to uppercase for consistency
    const normalizedMode = mode?.toUpperCase();
    
    // Map to valid transport mode key
    let modeKey: keyof typeof TRANSPORT_MODE_WIDTHS;
    switch (normalizedMode) {
        case 'FLIGHTS':
        case 'FLIGHT':
            modeKey = 'FLIGHTS';
            break;
        case 'RAILS':
        case 'RAIL':
        case 'TRAIN':
            modeKey = 'RAILS';
            break;
        case 'BUS':
            modeKey = 'BUS';
            break;
        case 'CAB':
        case 'TAXI':
            modeKey = 'CAB';
            break;
        default:
            modeKey = 'default';
    }
    
    const baseWidth = TRANSPORT_MODE_WIDTHS[modeKey];
    return isSelected ? baseWidth * SELECTED_WIDTH_MULTIPLIER : baseWidth;
} 