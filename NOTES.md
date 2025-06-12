# Changes made

## 1. UI Performance

### 1a. Fixing unnecessary re-renders in React

To test the UI performance I initially checked the console for any indications and it showed two warnings of `performWorkUntilDeadline` which indicates a rendering issue. In production mode (without StrictMode extra renders), Chrome’s performance profiler showed **three** calls to `renderMandelbrot` in two task attempts. A `useEffect` handler (`setDimensions`) was firing on every load and resize event, even when dimensions didn’t change.

**Resolution:**
Extracted the dimension-calculation logic into a separate function which only calls `setDimensions` when the new values differ and sets the default values using the same `getDimensions` function. This eliminated the redundant state updates and cut the number of unnecessary `renderMandelbrot` calls.

### 1b. Understanding the mandelbrot algorithm long processing times

A single `renderMandelbrot` took **1560 ms**, blocking the UI. The cost is _O(width × height × MAX_ITERATIONS)_. Lowering `MAX_ITERATIONS` helps, but better is to reduce per-pixel work to see if it can still run in the main execution thread. The algorithm could be modified to include some changes for efficient algorithms as [described here](https://en.wikipedia.org/wiki/Plotting_algorithms_for_the_Mandelbrot_set).

**Resolution:**

- **Cardioid/bulb interior test**: skips ~80 % of points instantly.
- **Period-1 periodicity check**: detects a 1-cycle and breaks out early.

Image diffs on all “favorite” spots showed no visual regressions, and full-set render time dropped **1560 ms → 62 ms**. (Deep-zoom spots still occasionally freeze briefly.)

### 1c. Offloading to a Worker with OffscreenCanvas

Even optimized, heavy renders still block the main thread which impact the users interaction with the UI.

**Resolution:**
Moved fractal generation into a Web Worker via `OffscreenCanvas`. The main thread now only posts debounced parameters; the worker draws in parallel, keeping the UI smooth.

## 2. Gradient Visualization

**Implementation:**
Rendered a separate `<canvas>` using the same HSV interpolation logic:

1. For each column _x_, compute `t = (x / (width–1)) ^ powerFactor`
2. Interpolate between multiple color stops in HSV space.
3. Fill every row with that color.

**Production Suggestions:**

- Combine gradient, color pickers, and power-factor slider into one unified component
- Offer a “Quick Preview” + “Apply” button to avoid triggering a full redraw on every edit.

## 3. Manual Coordinate Editing

**Implementation:**

- Switched to **text inputs** with local buffers:
- Users can type `-`, decimals, or `1e-3` notation.
- On **blur** or **Enter**, parse and commit valid values.
- Invalid entries revert to the last valid, formatted value.

**Production Suggestions:**

- Use of seperate components to isolate rerenders on storing temporary buffers from main component rendering
- Use a mask library on coords to provide a single field

## 4. Intermediate Gradient Points

Short on time, I saw this a good use case for cursor, as it is a single component with clear integration points within the existing code.

**Implementation:**

- Creates the `GradientEditor` component
  - has fixed stops for start and end
  - add new points which can set color and percentage position
  - remove existing points with a button except start and end
- Uses the gradient when generating the gradient visualization
- Uses the gradient in the worker when generating the mandelbrot

**Production Suggestions:**

- Make use of other color values (HEX, CMYK, alpha)
- Starting points can also have their percentage changed

## Improvements without time restrictions

- **Loading Indicator**: Show progress/spinner during worker renders.
- **Vector-based** boundary tracing to generate fractal outlines instead of full bitmaps (edge tracing), for instant pan/zoom without re-rasterization.
- **Detail Presets**: Low/Medium/High that adjust `MAX_ITERATIONS` staticly and dynamically, e.g.:
  ```js
  MAX_ITERATIONS = 200 + 1000 * log10(zoom);
  ```
- **Vector Outline Rendering**: Border tracing to generate vector shapes instead of full bitmaps, for instant pan/zoom.
- **Improved UI** A floating/minimizable toolbar overlay to support different display resolutions better
- (Low impact) prettier config to ensure commits don't include unnecessary changes of styles with IDE autoformatters.

**Time Spent:**
~8 hours
