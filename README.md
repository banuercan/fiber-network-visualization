# Fiber Network Visualization

An interactive fiber-optic network visualization project built with **React**, **Deck.gl**, and **MapLibre**.

The project visualizes fiber network connections on an interactive map and represents different network characteristics using visual properties such as color and line width.

## Features

- Interactive fiber-optic network visualization
- Network latency represented by line color
- Network capacity represented by line width
- Visualization of different connection types
- Region-based filtering
- Interactive map navigation with MapLibre
- High-performance data visualization with Deck.gl

## Technologies

- React
- Vite
- Deck.gl
- MapLibre GL
- JavaScript
- CSS
- JSON

## Project Structure

```text
src/
├── assets/
├── data/
│   └── fiberNetwork.json
├── App.jsx
├── App.css
├── index.css
└── main.jsx
```

The network data used by the application is stored in `fiberNetwork.json`.

## Installation

Clone the repository:

```bash
git clone https://github.com/banuercan/fiber-network-visualization.git
```

Navigate to the project directory:

```bash
cd fiber-network-visualization
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local development URL displayed in the terminal.

## Purpose

This project was developed to explore interactive geospatial visualization techniques using Deck.gl and MapLibre. It demonstrates how network characteristics such as latency, capacity, and connection type can be represented visually on an interactive map.