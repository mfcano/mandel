import { hexToHsv, interpolateHsv } from "./colors";

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
