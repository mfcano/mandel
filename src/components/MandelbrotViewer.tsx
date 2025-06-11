import React, { useEffect, useRef, useMemo, useState } from "react";
import debounce from "lodash.debounce";

import MandelbrotWorker from "../worker.ts?worker";
import { hexToHsv, interpolateHsv } from "../colors";

// Favorite spots
const FAVORITE_SPOTS = {
  "Full Set": { x: -0.5, y: 0, zoom: 1.5 },
  "Favorite 1": { x: -1.768778829, y: 0.001738924, zoom: 3247000 },
  "Favorite 2": { x: -1.394420575, y: 0.001827212, zoom: 30000 },
  "Favorite 3": { x: 0.235336955, y: 0.515262305, zoom: 1000 },
  "Favorite 4": { x: 0.286016756, y: 0.011559813, zoom: 3000 },
  "Favorite 5": { x: 0.286016756, y: 0.011559813, zoom: 500 },
  "Favorite 6": { x: 0.382308869, y: 0.389587017, zoom: 13000 },
  "Favorite 7": { x: -1.940157353, y: 0, zoom: 600000 },
  "Favorite 8": { x: -1.403445777, y: 0.000000012, zoom: 10000 },
  "Favorite 9": { x: -1.009078747, y: 0.3108562, zoom: 50 },
};

const CANVAS_MAX_SIZE = 1500;

function getDimensions() {
  const dpr = window.devicePixelRatio || 1;
  const maxW = Math.min(window.innerWidth * 0.9, CANVAS_MAX_SIZE);
  const maxH = Math.min(window.innerHeight * 0.85, CANVAS_MAX_SIZE);
  const ar = window.innerWidth / window.innerHeight;
  let width, height;
  if (ar > 1) {
    height = maxH;
    width = height * ar;
  } else {
    width = maxW;
    height = width / ar;
  }
  return { width: Math.round(width * dpr), height: Math.round(height * dpr) };
}

function formatNumber(num: number) {
  if (Math.abs(num) < 0.0001 || Math.abs(num) > 9999) {
    return num.toExponential(4);
  }
  return num.toPrecision(6);
}

const MandelbrotViewer: React.FC = () => {
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gradientRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState(getDimensions());
  const [center, setCenter] = useState({ x: -0.5, y: 0 });
  const [zoom, setZoom] = useState(1.5);
  const [startColor, setStartColor] = useState("#FFFFFF");
  const [endColor, setEndColor] = useState("#000000");
  const [powerFactor, setPowerFactor] = useState(0.2);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Buffers to handle formatting in inputs
  const [zoomText, setZoomText] = useState(zoom.toString());
  const [centerInputX, setCenterXText] = useState<string>(center.x.toString());
  const [centerInputY, setCenterYText] = useState<string>(center.y.toString());

  useEffect(() => setZoomText(formatNumber(zoom)), [zoom]);
  useEffect(() => setCenterXText(formatNumber(center.x)), [center.x]);
  useEffect(() => setCenterYText(formatNumber(center.y)), [center.y]);

  // Debounced poster
  const postRender = useMemo(
    () =>
      debounce(
        (msg) => {
          workerRef.current?.postMessage(msg);
        },
        100,
        { maxWait: 400 }
      ),
    []
  );

  // Draw gradient preview whenever colors or powerFactor change
  useEffect(() => {
    const canvas = gradientRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    const startHsv = hexToHsv(startColor);
    const endHsv = hexToHsv(endColor);

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    // Fill each pixel for full height
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = Math.pow(x / (w - 1), powerFactor);
        const { r, g, b } = interpolateHsv(startHsv, endHsv, t);
        const idx = 4 * (y * w + x);
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [startColor, endColor, powerFactor]);

  // Init worker
  useEffect(() => {
    if (!canvasRef.current) return;
    const offscreen = canvasRef.current.transferControlToOffscreen();
    const worker = new MandelbrotWorker();
    worker.postMessage({ canvas: offscreen }, [offscreen]);
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // Render updates
  useEffect(() => {
    postRender({
      width: dimensions.width,
      height: dimensions.height,
      center,
      zoom,
      startColor,
      endColor,
      powerFactor,
    });
    return () => {
      postRender.cancel();
    };
  }, [dimensions, center, zoom, startColor, endColor, powerFactor, postRender]);

  // Resize
  useEffect(() => {
    const onResize = () => {
      setDimensions(getDimensions());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const dx = ((e.clientX - dragStart.x) * (2.5 / zoom)) / dimensions.width;
    const dy = ((e.clientY - dragStart.y) * (2.5 / zoom)) / dimensions.width;

    setCenter({
      x: center.x - dx,
      y: center.y - dy,
    });

    setDragStart({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.cancelable) e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const mouseX =
      center.x + ((x - dimensions.width / 2) * (2.5 / zoom)) / dimensions.width;
    const mouseY =
      center.y +
      ((y - dimensions.height / 2) * (2.5 / zoom)) / dimensions.width;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = zoom * zoomFactor;

    setCenter({
      x: mouseX - (mouseX - center.x) * zoomFactor,
      y: mouseY - (mouseY - center.y) * zoomFactor,
    });
    setZoom(newZoom);
  };

  const commitZoom = () => {
    const v = parseFloat(zoomText);
    if (!isNaN(v) && v > 0) {
      setZoom(v);
      setZoomText(formatNumber(v));
    } else {
      setZoomText(zoom.toString());
    }
  };

  const commitCenterX = () => {
    const parsed = parseFloat(centerInputX);
    if (!isNaN(parsed)) {
      setCenter((c) => ({ ...c, x: parsed }));
      setCenterXText(formatNumber(center.x));
    } else {
      setCenterXText(center.x.toString());
    }
  };

  const commitCenterY = () => {
    const parsed = parseFloat(centerInputY);
    if (!isNaN(parsed)) {
      setCenter((c) => ({ ...c, y: parsed }));
      setCenterYText(formatNumber(center.y));
    } else {
      setCenterYText(center.y.toString());
    }
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
          cursor: isDragging ? "grabbing" : "grab",
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
        <div>
          <canvas
            ref={gradientRef}
            width={300}
            height={10}
            className="rounded"
          />
        </div>
        <select
          className="px-2 py-1 border rounded"
          onChange={(e) => {
            const spot =
              FAVORITE_SPOTS[e.target.value as keyof typeof FAVORITE_SPOTS];
            if (spot) {
              setCenter({ x: spot.x, y: spot.y });
              setZoom(spot.zoom);
            }
          }}
        >
          <option value="">Favorite Spots</option>
          {Object.keys(FAVORITE_SPOTS).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex items-center">
          <label className="mr-2">Center X:</label>
          <input
            type="text"
            value={centerInputX}
            pattern="[0-9]+([\.,][0-9]+)?"
            onChange={(e) => setCenterXText(e.target.value)}
            onBlur={commitCenterX}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitCenterX();
                e.preventDefault();
              }
            }}
            className="w-36 px-2 py-1 border rounded mr-4"
          />

          <label className="mr-2">Center Y:</label>
          <input
            type="text"
            pattern="[0-9]+([\.,][0-9]+)?"
            value={centerInputY}
            onChange={(e) => setCenterYText(e.target.value)}
            onBlur={commitCenterY}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitCenterY();
                e.preventDefault();
              }
            }}
            className="w-36 px-2 py-1 border rounded"
          />
        </div>

        <div className="flex items-center">
          <label>Zoom:</label>
          <input
            type="text"
            value={zoomText}
            pattern="[0-9]+([\.,][0-9]+)?"
            onChange={(e) => setZoomText(e.target.value)}
            onBlur={commitZoom}
            onKeyDown={(e) =>
              e.key === "Enter" && (commitZoom(), e.preventDefault())
            }
            className="w-32 px-2 py-1 border rounded"
          />
        </div>
      </div>
      <div className="text-sm font-mono bg-gray-100 px-4 py-2 rounded">
        Center: ({formatNumber(center.x)}, {formatNumber(center.y)}) | Zoom:{" "}
        {formatNumber(zoom)}
      </div>
    </div>
  );
};

export default MandelbrotViewer;
