import { borders } from './borders';
import { colors } from './colors';
import { elevation } from './elevation';
import { iconSizes } from './icons';
import { motion } from './motion';
import { radii } from './radii';
import { layout, spacing } from './spacing';
import { typography } from './typography';

export { hexToRgbChannels, themeToCssVars, withAlpha } from './color-utils';
export { fonts, useAppFonts } from './fonts';
export { ThemeProvider, useTheme, useThemeColors, type ThemePreference } from './theme-provider';
export { brand, darkColors, lightColors, type ThemeColors } from './themes';
export { borders, colors, elevation, iconSizes, layout, motion, radii, spacing, typography };

/**
 * Replicate-inspired warm bone/ink UI with locked Trackwise primary `#00D95F`.
 * Type: Bricolage Grotesque (display + body) + JetBrains Mono (metrics).
 * Runtime paint: prefer `useThemeColors()`. Static `colors` is the light palette.
 */
