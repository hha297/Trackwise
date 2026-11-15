import { describe, expect, it } from 'vitest';

import { colors } from './colors';
import { hexToRgbChannels, withAlpha } from './color-utils';
import { brand, darkColors, lightColors } from './themes';

describe('brand colors', () => {
  it('locks Trackwise primary on Replicate bone foundations', () => {
    expect(colors.primary).toBe('#00D95F');
    expect(colors.primary).toBe(brand.primary);
    expect(colors.background).toBe(brand.canvas);
    expect(colors.secondary).toBe(brand.secondary);
    expect(colors.primaryPressed).toBe(brand.primaryPressed);
  });

  it('keeps light and dark palettes aligned with brand foundations', () => {
    expect(lightColors.primary).toBe(brand.primary);
    expect(darkColors.primary).toBe(brand.primary);
    expect(darkColors.background).toBe(brand.surfaceDark);
    expect(lightColors.background).toBe(brand.canvas);
    expect(lightColors.overlay).toBe(darkColors.overlay);
  });

  it('keeps macro series distinct from status colors', () => {
    for (const palette of [lightColors, darkColors]) {
      expect(palette.macroCalories).toBe(brand.primary);
      expect(palette.macroProtein).not.toBe(palette.error);
      expect(palette.macroCarbs).not.toBe(palette.primary);
      expect(palette.macroCarbs).not.toBe(palette.warning);
      expect(palette.macroFat).not.toBe(palette.error);
      expect(palette.macroProtein).not.toBe(palette.info);
    }
  });
});

describe('color utils', () => {
  it('converts hex to rgb channels and alpha', () => {
    expect(hexToRgbChannels('#00D95F')).toBe('0 217 95');
    expect(withAlpha('#202020', 0.55)).toBe('rgba(32,32,32,0.55)');
  });
});
