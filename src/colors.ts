import type { ColorStop } from "./components/GradientEditor";

// Convert hex color to HSV
export const hexToHsv = (hex: string) => {
  hex = hex.replace("#", "");

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    if (max === r) {
      h = 60 * ((g - b) / diff + (g < b ? 6 : 0));
    } else if (max === g) {
      h = 60 * ((b - r) / diff + 2);
    } else {
      h = 60 * ((r - g) / diff + 4);
    }
  }

  return { h, s, v };
};

// Convert HSV to RGB
const hsvToRgb = (h: number, s: number, v: number) => {
  if (s === 0) {
    // Achromatic (grey)
    const value = Math.round(v * 255);
    return { r: value, g: value, b: value };
  }

  h = h / 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));

  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
};

const interpolateHue = (h1: number, h2: number, t: number) => {
  // Ensure both hues are in 0-360 range
  h1 = ((h1 % 360) + 360) % 360;
  h2 = ((h2 % 360) + 360) % 360;

  // Find shortest path around the circle
  const diff = h2 - h1;
  if (Math.abs(diff) > 180) {
    // Go the other way around
    if (diff > 0) {
      h1 += 360;
    } else {
      h2 += 360;
    }
  }

  // Now we can interpolate normally
  return (((h1 + (h2 - h1) * t) % 360) + 360) % 360;
};

// Interpolate between two HSV colors
export const interpolateHsv = (
  hsv1: { h: number; s: number; v: number },
  hsv2: { h: number; s: number; v: number },
  t: number
) => {
  // Use proper hue interpolation
  const h = interpolateHue(hsv1.h, hsv2.h, t);

  // Linear interpolation of saturation and value
  const s = hsv1.s + (hsv2.s - hsv1.s) * t;
  const v = hsv1.v + (hsv2.v - hsv1.v) * t;

  return hsvToRgb(h, s, v);
};

// Helper function to interpolate between multiple gradient stops
export function interpolateGradientStops(
  stops: ColorStop[],
  t: number
): { r: number; g: number; b: number } {
  // Find the two stops to interpolate between
  let startStop = stops[0];
  let endStop = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].position && t <= stops[i + 1].position) {
      startStop = stops[i];
      endStop = stops[i + 1];
      break;
    }
  }

  // Calculate local t between these two stops
  const localT =
    (t - startStop.position) / (endStop.position - startStop.position);

  // Interpolate between the two colors
  const startHsv = hexToHsv(startStop.color);
  const endHsv = hexToHsv(endStop.color);

  return interpolateHsv(startHsv, endHsv, localT);
}
