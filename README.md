# Mandelbrot Set Visualizer

![Mandelbrot Set](/public/fractal.png)

This project is an interactive visualization of the Mandelbrot set, one of the most famous examples of fractals in mathematics. If you're not familiar with the Mandelbrot set, you can learn more from these resources:

- [The Mandelbrot Set: A Mathematical Wonder](https://mathworld.wolfram.com/MandelbrotSet.html) - A mathematical introduction
- [Understanding the Mandelbrot Set](https://en.wikipedia.org/wiki/Mandelbrot_set) - A general overview

## About this Project

This is a practical exercise for software engineering candidates. The project provides a basic implementation of a Mandelbrot set visualizer with features like zoom, panning, and color customization. Your task is to improve upon this foundation.

## Time Allocation

Please spend a maximum of 8 hours on this exercise. We understand there are always more improvements possible, but we want to see what you prioritize within a realistic time constraint.

## The Task

Your mission is to improve this project. What "better" means is deliberately left open to your interpretation - we're interested in understanding which aspects of software development you prioritize and why.

### Specific Requirements

1. **UI Performance**: The current UI freezes during computation, which is unacceptable. The UI must remain completely responsive and interactive at all times.

2. **Gradient Visualization**: You must implement a new feature that visually shows in the UI how the color gradient is affected by the power factor.

3. **Manual Coordinate Editing**: Add the ability to manually edit/input the center point coordinates and zoom level.

4. **Extra Credit - Intermediate Gradient Points**: Implement support for:
   - Adding multiple color points along the gradient
   - Setting each point's position as a percentage
   - Choosing the color for each point
   - Removing points (except start and end)

## Delivery Requirements

1. Write a document (maximum two pages) that:

   - Describes the changes made
   - Explains the reasoning behind your decisions
   - Lists what you would do differently if this were a production project without time constraints
   - Add this document to the project

2. Submit your changes in one or more pull requests. Make sure your commits are logical and well documented.

## Getting Started

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Development Stack

This project uses:

- React + TypeScript
- Vite
- TailwindCSS

The project structure follows standard React conventions, so you should be able to get started quickly if you're familiar with React development.
