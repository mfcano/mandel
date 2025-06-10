import React, { useEffect, useRef, useMemo, useState } from "react";
import debounce from "lodash.debounce";
import MandelbrotWorker from "../worker.ts?worker";

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

const MandelbrotViewer: React.FC = () => {
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [dimensions, setDimensions] = useState(getDimensions());
  const [center, setCenter] = useState({ x: -0.5, y: 0 });
  const [zoom, setZoom] = useState(1.5);
  const [startColor, setStartColor] = useState("#FFFFFF");
  const [endColor, setEndColor] = useState("#000000");
  const [powerFactor, setPowerFactor] = useState(0.2);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

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
    e.cancelable && e.preventDefault();

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
      </div>
      <div className="text-sm font-mono bg-gray-100 px-4 py-2 rounded">
        Center: ({formatNumber(center.x)}, {formatNumber(center.y)}) | Zoom:{" "}
        {formatNumber(zoom)}
      </div>
    </div>
  );
};

export default MandelbrotViewer;
