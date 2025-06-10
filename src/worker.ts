type RenderMessage = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  center: { x: number; y: number };
  zoom: number;
  startColor: string;
  endColor: string;
  powerFactor: number;
};

const MAX_ITERATIONS = 800;

// Convert hex color to HSV
const hexToHsv = (hex: string) => {
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
const interpolateHsv = (
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

// Quick interior tests
const inMainCardioid = (cr: number, ci: number) => {
  // q = (x–¼)² + y²
  const q = (cr - 0.25) * (cr - 0.25) + ci * ci;
  // cardioid if q*(q + (x–¼)) < ¼·y²
  return q * (q + (cr - 0.25)) < 0.25 * ci * ci;
};
const inPeriod2Bulb = (cr: number, ci: number) =>
  // period-2 bulb: (x+1)² + y² < (1/4)² = 1/16
  (cr + 1) * (cr + 1) + ci * ci < 0.0625;


// Render function
function render({
  canvas,
  width,
  height,
  center,
  zoom,
  startColor,
  endColor,
  powerFactor,
}: RenderMessage) {
  const ctx = canvas.getContext("2d");

  if (ctx === null) return;

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const startHsv = hexToHsv(startColor);
  const endHsv = hexToHsv(endColor);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // map pixel → complex plane
      const real = center.x + ((x - width / 2) * (2.5 / zoom)) / width;
      const imag = center.y + ((y - height / 2) * (2.5 / zoom)) / width;

      let iter;
      // if in cardioid or bulb, it never escapes → treat as MAX
      if (inMainCardioid(real, imag) || inPeriod2Bulb(real, imag)) {
        iter = MAX_ITERATIONS;
      } else {
        // otherwise run the normal escape-time loop
        let zr = 0,
          zi = 0;
        iter = 0;
        while (zr * zr + zi * zi < 4 && iter < MAX_ITERATIONS) {
          const newZr = zr * zr - zi * zi + real;
          const newZi = 2 * zr * zi + imag;
          zr = newZr;
          zi = newZi;
          iter++;
        }
      }

      const idx = 4 * (y * width + x);
      if (iter < MAX_ITERATIONS) {
        const t = Math.pow(iter / MAX_ITERATIONS, powerFactor);
        const { r, g, b } = interpolateHsv(startHsv, endHsv, t);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      } else {
        // interior points → black
        data[idx] = data[idx + 1] = data[idx + 2] = 0;
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

let offscreenCanvas: HTMLCanvasElement | null = null;

self.onmessage = (e) => {
  if (e.data.canvas) {
    offscreenCanvas = e.data.canvas;
    return;
  }
  if (offscreenCanvas) render({ canvas: offscreenCanvas, ...e.data });
};