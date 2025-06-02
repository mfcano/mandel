import React, { useEffect, useRef, useState } from 'react';

// Interesting locations in the Mandelbrot set
const FAVORITE_SPOTS = {
  'Full Set': { x: -0.5, y: 0, zoom: 1.5 },
  'Favorite 1': { x: -1.7687788290, y: 0.0017389240, zoom: 3247000 },
  'Favorite 2': { x: -1.3944205750, y: 0.0018272120, zoom: 30000 },
  'Favorite 3': { x: 0.2353369550, y: 0.5152623050, zoom: 1000 },
  'Favorite 4': { x: 0.2860167560, y: 0.0115598130, zoom: 3000 },
  'Favorite 5': { x: 0.2860167560, y: 0.0115598130, zoom: 500 },
  'Favorite 6': { x: 0.3823088690, y: 0.3895870170, zoom: 13000 },
  'Favorite 7': { x: -1.9401573530, y: 0, zoom: 600000 },
  'Favorite 8': { x: -1.4034457770, y: 0.0000000120, zoom: 10000 },
  'Favorite 9': { x: -1.0090787470, y: 0.3108562000, zoom: 50 },
};

const MAX_ITERATIONS = 800;
const CANVAS_MAX_SIZE = 1500;

// Convert hex color to HSV
const hexToHsv = (hex: string) => {
  hex = hex.replace('#', '');

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  let s = max === 0 ? 0 : diff / max;
  let v = max;

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

  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
};

const interpolateHue = (h1: number, h2: number, t: number) => {
  // Ensure both hues are in 0-360 range
  h1 = ((h1 % 360) + 360) % 360;
  h2 = ((h2 % 360) + 360) % 360;

  // Find shortest path around the circle
  let diff = h2 - h1;
  if (Math.abs(diff) > 180) {
    // Go the other way around
    if (diff > 0) {
      h1 += 360;
    } else {
      h2 += 360;
    }
  }

  // Now we can interpolate normally
  return ((h1 + (h2 - h1) * t) % 360 + 360) % 360;
};


// Interpolate between two HSV colors
const interpolateHsv = (hsv1: { h: number, s: number, v: number },
  hsv2: { h: number, s: number, v: number },
  t: number) => {
  // Use proper hue interpolation
  const h = interpolateHue(hsv1.h, hsv2.h, t);

  // Linear interpolation of saturation and value
  const s = hsv1.s + (hsv2.s - hsv1.s) * t;
  const v = hsv1.v + (hsv2.v - hsv1.v) * t;

  return hsvToRgb(h, s, v);
};

const MandelbrotViewer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [center, setCenter] = useState({ x: -0.5, y: 0 });
  const [zoom, setZoom] = useState(1.5);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startColor, setStartColor] = useState('#FFFFFF');
  const [endColor, setEndColor] = useState('#000000');
  const [powerFactor, setPowerFactor] = useState(0.2);

  useEffect(() => {
    const updateDimensions = () => {
      const dpr = window.devicePixelRatio || 1;
      const maxWidth = Math.min(window.innerWidth * 0.9, CANVAS_MAX_SIZE);
      const maxHeight = Math.min(window.innerHeight * 0.85, CANVAS_MAX_SIZE);
      const aspectRatio = window.innerWidth / window.innerHeight;

      let width, height;
      if (aspectRatio > 1) {
        height = maxHeight;
        width = height * aspectRatio;
      } else {
        width = maxWidth;
        height = width / aspectRatio;
      }

      setDimensions({
        width: Math.round(width * dpr),
        height: Math.round(height * dpr)
      });
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const renderMandelbrot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(dimensions.width, dimensions.height);
    const data = imageData.data;

    const startHsv = hexToHsv(startColor);
    const endHsv = hexToHsv(endColor);

    for (let y = 0; y < dimensions.height; y++) {
      for (let x = 0; x < dimensions.width; x++) {
        const real = center.x + (x - dimensions.width / 2) * (2.5 / zoom) / dimensions.width;
        const imag = center.y + (y - dimensions.height / 2) * (2.5 / zoom) / dimensions.width;

        let zr = 0;
        let zi = 0;
        let iter = 0;

        while (zr * zr + zi * zi < 4 && iter < MAX_ITERATIONS) {
          const newZr = zr * zr - zi * zi + real;
          const newZi = 2 * zr * zi + imag;
          zr = newZr;
          zi = newZi;
          iter++;
        }

        const pixelIndex = (y * dimensions.width + x) * 4;
        if (iter < MAX_ITERATIONS) {
          const t = Math.pow(iter / MAX_ITERATIONS, powerFactor);
          const color = interpolateHsv(startHsv, endHsv, t);

          data[pixelIndex] = color.r;
          data[pixelIndex + 1] = color.g;
          data[pixelIndex + 2] = color.b;
        } else {
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 0;
          data[pixelIndex + 2] = 0;
        }

        data[pixelIndex + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  useEffect(() => {
    renderMandelbrot();
  }, [dimensions, center, zoom, startColor, endColor, powerFactor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = (e.clientX - dragStart.x) * (2.5 / zoom) / dimensions.width;
    const dy = (e.clientY - dragStart.y) * (2.5 / zoom) / dimensions.width;

    setCenter({
      x: center.x - dx,
      y: center.y - dy
    });

    setDragStart({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const mouseX = center.x + (x - dimensions.width / 2) * (2.5 / zoom) / dimensions.width;
    const mouseY = center.y + (y - dimensions.height / 2) * (2.5 / zoom) / dimensions.width;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = zoom * zoomFactor;

    setCenter({
      x: mouseX - (mouseX - center.x) * zoomFactor,
      y: mouseY - (mouseY - center.y) * zoomFactor
    });
    setZoom(newZoom);
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) < 0.0001 || Math.abs(num) > 9999) {
      return num.toExponential(4);
    }
    return num.toPrecision(6);
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          width: dimensions.width / (window.devicePixelRatio || 1),
          height: dimensions.height / (window.devicePixelRatio || 1),
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="border border-gray-300 shadow-lg rounded"
      />

      <div className="flex flex-wrap gap-4 items-center justify-center">
        <div className="flex items-center">
          <label className="mr-2">Start Color:</label>
          <input
            type="color"
            value={startColor}
            onChange={(e) => setStartColor(e.target.value)}
            className="w-12 h-8"
          />
        </div>

        <div className="flex items-center">
          <label className="mr-2">End Color:</label>
          <input
            type="color"
            value={endColor}
            onChange={(e) => setEndColor(e.target.value)}
            className="w-12 h-8"
          />
        </div>

        <div className="flex items-center">
          <label className="mr-2">Power Factor:</label>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={powerFactor}
            onChange={(e) => setPowerFactor(Number(e.target.value))}
            className="w-20 px-2 py-1 border rounded"
          />
        </div>

        <select
          className="px-2 py-1 border rounded"
          onChange={(e) => {
            const spot = FAVORITE_SPOTS[e.target.value as keyof typeof FAVORITE_SPOTS];
            if (spot) {
              setCenter({ x: spot.x, y: spot.y });
              setZoom(spot.zoom);
            }
          }}
        >
          <option value="">Favorite Spots</option>
          {Object.entries(FAVORITE_SPOTS).map(([name]) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="text-sm font-mono bg-gray-100 px-4 py-2 rounded">
        Center: ({formatNumber(center.x)}, {formatNumber(center.y)}) |
        Zoom: {formatNumber(zoom)}
      </div>
    </div>
  );
};

export default MandelbrotViewer;
