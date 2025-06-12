import React, { useCallback, useEffect, useRef, useState } from "react";
import { hexToHsv, interpolateHsv } from "../colors";

export interface ColorStop {
  id: string;
  color: string;
  position: number; // 0 to 1
}

interface GradientEditorProps {
  value: ColorStop[];
  onChange: (stops: ColorStop[]) => void;
  width?: number;
  height?: number;
}

const GradientEditor: React.FC<GradientEditorProps> = ({
  value,
  onChange,
  width = 300,
  height = 30,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingStop, setDraggingStop] = useState<string | null>(null);
  const [editingStop, setEditingStop] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>("");

  // Ensure we always have at least start and end stops
  useEffect(() => {
    if (value.length < 2) {
      onChange([
        { id: "start", color: "#FFFFFF", position: 0 },
        { id: "end", color: "#000000", position: 1 },
      ]);
    }
  }, [value, onChange]);

  // Update input value when editing stop changes
  useEffect(() => {
    if (editingStop) {
      const stop = value.find((s) => s.id === editingStop);
      if (stop) {
        setInputValue(Math.round(stop.position * 100).toString());
      }
    }
  }, [editingStop, value]);

  const handleMouseDown = useCallback((e: React.MouseEvent, stopId: string) => {
    e.stopPropagation(); // Prevent event from reaching container
    if (stopId === "start" || stopId === "end") return; // Don't allow dragging start/end
    setDraggingStop(stopId);
  }, []);

  const handleStopClick = useCallback((e: React.MouseEvent, stopId: string) => {
    e.stopPropagation(); // Prevent event from reaching container
    setEditingStop(stopId);
  }, []);

  // Helper function to constrain position between adjacent stops
  const constrainPosition = useCallback(
    (position: number, stopId: string, stops: ColorStop[]) => {
      const stopIndex = stops.findIndex((stop) => stop.id === stopId);
      if (stopIndex === -1) return position;

      const prevStop = stops[stopIndex - 1];
      const nextStop = stops[stopIndex + 1];

      // Use a smaller minimum distance (0.005 = 0.5%) between stops
      const minDistance = 0.005;
      const minPos = prevStop ? prevStop.position + minDistance : 0;
      const maxPos = nextStop ? nextStop.position - minDistance : 1;

      return Math.max(minPos, Math.min(maxPos, position));
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingStop || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;

      const newStops = [...value];
      const stopIndex = newStops.findIndex((stop) => stop.id === draggingStop);
      if (stopIndex === -1) return;

      const constrainedX = constrainPosition(x, draggingStop, newStops);
      newStops[stopIndex] = { ...newStops[stopIndex], position: constrainedX };
      onChange(newStops);
    },
    [draggingStop, value, onChange, constrainPosition]
  );

  const handleMouseUp = useCallback(() => {
    setDraggingStop(null);
  }, []);

  const handleAddStop = useCallback(
    (e: React.MouseEvent) => {
      // Only add stop if we're not clicking on a stop or its controls
      if ((e.target as HTMLElement).closest(".stop-controls")) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / rect.width;

      // Find the two stops to insert between
      const newStops = [...value];
      let insertIndex = 0;
      for (let i = 0; i < newStops.length - 1; i++) {
        if (x > newStops[i].position && x < newStops[i + 1].position) {
          insertIndex = i + 1;
          break;
        }
      }

      // Calculate color for new stop by interpolating between adjacent stops
      const prevStop = newStops[insertIndex - 1];
      const nextStop = newStops[insertIndex];
      const t =
        (x - prevStop.position) / (nextStop.position - prevStop.position);
      const prevHsv = hexToHsv(prevStop.color);
      const nextHsv = hexToHsv(nextStop.color);
      const { r, g, b } = interpolateHsv(prevHsv, nextHsv, t);
      const newColor = `#${r.toString(16).padStart(2, "0")}${g
        .toString(16)
        .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

      const newStop: ColorStop = {
        id: `stop-${Date.now()}`,
        color: newColor,
        position: constrainPosition(x, "new", newStops),
      };

      newStops.splice(insertIndex, 0, newStop);
      onChange(newStops);
    },
    [value, onChange, constrainPosition]
  );

  const handleRemoveStop = useCallback(
    (stopId: string) => {
      if (stopId === "start" || stopId === "end") return; // Don't allow removing start/end
      onChange(value.filter((stop) => stop.id !== stopId));
    },
    [value, onChange]
  );

  const handleColorChange = useCallback(
    (stopId: string, color: string) => {
      const newStops = value.map((stop) =>
        stop.id === stopId ? { ...stop, color } : stop
      );
      onChange(newStops);
    },
    [value, onChange]
  );

  const handlePositionInputChange = useCallback(
    (stopId: string, newValue: string) => {
      // Allow empty input and numbers
      if (newValue === "" || /^\d*$/.test(newValue)) {
        setInputValue(newValue);
      }
    },
    []
  );

  const handlePositionInputComplete = useCallback(
    (stopId: string) => {
      const num = parseFloat(inputValue);
      if (isNaN(num) || num < 0 || num > 100) {
        // Reset to current position if invalid
        const stop = value.find((s) => s.id === stopId);
        if (stop) {
          setInputValue(Math.round(stop.position * 100).toString());
        }
        return;
      }

      const newStops = [...value];
      const position = constrainPosition(num / 100, stopId, newStops);

      const stopIndex = newStops.findIndex((stop) => stop.id === stopId);
      if (stopIndex === -1) return;

      newStops[stopIndex] = { ...newStops[stopIndex], position };
      onChange(newStops);
      setInputValue(Math.round(position * 100).toString());
    },
    [inputValue, value, onChange, constrainPosition]
  );

  const handlePositionInputKeyDown = useCallback(
    (e: React.KeyboardEvent, stopId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handlePositionInputComplete(stopId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        const stop = value.find((s) => s.id === stopId);
        if (stop) {
          setInputValue(Math.round(stop.position * 100).toString());
        }
        setEditingStop(null);
      }
    },
    [handlePositionInputComplete, value]
  );

  // Draw gradient preview
  const drawGradient = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    value.forEach((stop) => {
      gradient.addColorStop(stop.position, stop.color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL();
  }, [value, width, height]);

  return (
    <div className="flex flex-col gap-2 justify-center items-center">
      <div
        ref={containerRef}
        className="relative cursor-pointer"
        style={{ width, height }}
        onMouseDown={handleAddStop}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="w-full h-full rounded"
          style={{ backgroundImage: `url(${drawGradient()})` }}
        />
        {value.map((stop) => (
          <div
            key={stop.id}
            className={`absolute top-0 w-4 h-full -ml-2 cursor-ew-resize stop-controls ${
              stop.id === "start" || stop.id === "end"
                ? "cursor-not-allowed"
                : ""
            }`}
            style={{ left: `${stop.position * 100}%` }}
          >
            <div
              className="w-6 h-6 rounded-full border-2 border-white shadow-md transform -translate-y-1/2"
              style={{ backgroundColor: stop.color }}
              onMouseDown={(e) => handleMouseDown(e, stop.id)}
              onClick={(e) => handleStopClick(e, stop.id)}
            />
            {editingStop === stop.id && (
              <div
                className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 stop-controls bg-white p-2 rounded shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col gap-2 items-center">
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => handleColorChange(stop.id, e.target.value)}
                    className="w-8 h-8"
                    onBlur={() => setEditingStop(null)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={inputValue}
                      onChange={(e) =>
                        handlePositionInputChange(stop.id, e.target.value)
                      }
                      onBlur={() => handlePositionInputComplete(stop.id)}
                      onKeyDown={(e) => handlePositionInputKeyDown(e, stop.id)}
                      className="w-16 px-1 py-0.5 text-sm border rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm">%</span>
                  </div>
                  {stop.id !== "start" && stop.id !== "end" && (
                    <button
                      className="absolute -top-2 -right-2 w-6 h-6 text-red-500 hover:text-red-700 bg-white shadow-sm rounded-full shadow-sm m-0 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStop(stop.id);
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-500 text-center">
        Click to add stops, drag to move, click stop to edit color and position
      </div>
    </div>
  );
};

export default GradientEditor;
