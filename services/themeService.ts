import { Theme } from '../types';

// --- Color Conversion Utilities ---

const hexToRgb = (hex: string): [number, number, number] | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
};

const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
};

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max));

// --- Palette Generation ---

const generateNeutralPalette = (baseHex: string, textHex: string) => {
    const baseRgb = hexToRgb(baseHex); // Should be a dark color, equivalent to slate-900
    if (!baseRgb) return {};
    
    const [h, s, l] = rgbToHsl(...baseRgb);
    
    const textRgb = hexToRgb(textHex);
    if (!textRgb) return {};
    const [, , textL] = rgbToHsl(...textRgb);

    const generateShade = (lightness: number) => hslToRgb(h, s, clamp(lightness, 0, 1));
    
    // Create a curve from the darkest background to the lightest text
    return {
        '950': generateShade(l * 0.7),
        '900': baseRgb,
        '800': generateShade(l + (textL - l) * 0.1),
        '700': generateShade(l + (textL - l) * 0.2),
        '600': generateShade(l + (textL - l) * 0.3),
        '500': generateShade(l + (textL - l) * 0.4),
        '400': generateShade(l + (textL - l) * 0.55),
        '300': generateShade(l + (textL - l) * 0.7),
        '200': generateShade(l + (textL - l) * 0.85),
        '100': textRgb,
    };
};

const generateAccentPalette = (baseHex: string) => {
    const baseRgb = hexToRgb(baseHex); // Should be a mid-tone color like 500
    if (!baseRgb) return {};
    const [h, s, l] = rgbToHsl(...baseRgb);

    const generateShade = (lightnessMod: number, saturationMod: number = 0) => 
      hslToRgb(h, clamp(s * (1 + saturationMod), 0, 1), clamp(l * lightnessMod, 0, 1));
    
    return {
        '900': generateShade(0.5, 0.1),
        '800': generateShade(0.65, 0.05),
        '700': generateShade(0.8, 0.02),
        '600': generateShade(0.9),
        '500': baseRgb,
        '400': generateShade(1.1),
        '300': generateShade(1.3, -0.05),
        '200': generateShade(1.5, -0.1),
    };
};

// --- Theme Application ---

export const applyTheme = (theme: Theme | null) => {
  if (!theme) return;
  
  const { primary, secondary, neutral, text } = theme.config;
  const root = document.documentElement;

  const slatePalette = generateNeutralPalette(neutral, text);
  const crimsonPalette = generateAccentPalette(primary);
  const emberPalette = generateAccentPalette(secondary);

  const palettes: Record<string, Record<string, [number, number, number] | undefined>> = {
      slate: slatePalette,
      crimson: crimsonPalette,
      ember: emberPalette
  };

  for (const [paletteName, palette] of Object.entries(palettes)) {
    for (const [shade, rgb] of Object.entries(palette)) {
      if(rgb) {
        root.style.setProperty(`--color-${paletteName}-${shade}`, `${rgb[0]} ${rgb[1]} ${rgb[2]}`);
      }
    }
  }
};
