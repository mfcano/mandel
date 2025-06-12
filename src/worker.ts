import { interpolateGradientStops } from "./colors";

interface ColorStop {
  id: string;
  color: string;
  position: number;
}

type RenderMessage = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  center: { x: number; y: number };
  zoom: number;
  colorStops: ColorStop[];
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
  colorStops,
  powerFactor,
}: RenderMessage) {
  const ctx = canvas.getContext("2d");

  if (ctx === null) return;

  canvas.width = width;
  canvas.height = height;

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const real = center.x + ((x - width / 2) * (2.5 / zoom)) / width;
      const imag = center.y + ((y - height / 2) * (2.5 / zoom)) / width;

      let zr = 0,
        zi = 0;
      let prevZr = 0,
        prevZi = 0;
      let iter = 0;

      // cardioid/bulb quick test
      if (inMainCardioid(real, imag) || inPeriod2Bulb(real, imag)) {
        iter = MAX_ITERATIONS;
      } else {
        // escape-time with period-1 check
        while (zr * zr + zi * zi < 4 && iter < MAX_ITERATIONS) {
          const newZr = zr * zr - zi * zi + real;
          const newZi = 2 * zr * zi + imag;

          // periodicity check: did we return to the previous z?
          if (newZr === prevZr && newZi === prevZi) {
            iter = MAX_ITERATIONS;
            break;
          }

          // shift history
          prevZr = zr;
          prevZi = zi;

          // advance
          zr = newZr;
          zi = newZi;
          iter++;
        }
      }

      const idx = 4 * (y * width + x);
      if (iter < MAX_ITERATIONS) {
        const t = Math.pow(iter / MAX_ITERATIONS, powerFactor);
        const { r, g, b } = interpolateGradientStops(colorStops, t);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      } else {
        // treat as interior
        data[idx] = data[idx + 1] = data[idx + 2] = 0;
      }
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  console.timeEnd();
}

let offscreenCanvas: HTMLCanvasElement | null = null;

self.onmessage = (e) => {
  if (e.data.canvas) {
    offscreenCanvas = e.data.canvas;
    return;
  }
  if (offscreenCanvas) render({ canvas: offscreenCanvas, ...e.data });
};
