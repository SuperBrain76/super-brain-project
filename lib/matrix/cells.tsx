"use client";

import React from "react";
import type { Cell, ShapeSpec, ShapeType, FillType, SizeType } from "./types";

// ── Constants ─────────────────────────────────────────────────

const SIZE_R: Record<SizeType, number> = { sm: 11, md: 16, lg: 22 };

// Positions for 1, 2, or 3 shapes within a 100×100 viewBox
const POSITIONS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[32, 50], [68, 50]],
  3: [[20, 50], [50, 50], [80, 50]],
};

const SHAPE_COLOR = "#e2e8f0";

// ── Fill helpers ──────────────────────────────────────────────

function fillProps(fill: FillType) {
  switch (fill) {
    case "solid":
      return { fill: SHAPE_COLOR, stroke: "none", strokeWidth: 0, fillOpacity: 1 };
    case "outline":
      return { fill: "none", stroke: SHAPE_COLOR, strokeWidth: 2, fillOpacity: 0 };
    case "half":
      return { fill: SHAPE_COLOR, stroke: SHAPE_COLOR, strokeWidth: 1.5, fillOpacity: 0.28 };
  }
}

// ── Shape renderers ───────────────────────────────────────────

function pt(x: number, y: number) { return `${x},${y}`; }

function renderShape(type: ShapeType, cx: number, cy: number, r: number, fill: FillType, rotation: number, key: string) {
  const fp = fillProps(fill);
  const props = { key, ...fp };
  const withRotation = (el: React.ReactElement) =>
    rotation === 0 ? el : (
      <g key={key} transform={`rotate(${rotation} ${cx} ${cy})`}>{el}</g>
    );

  switch (type) {
    case "circle":
      return withRotation(<circle {...props} cx={cx} cy={cy} r={r} />);

    case "square":
      return withRotation(<rect {...props} x={cx - r} y={cy - r} width={r * 2} height={r * 2} />);

    case "triangle": {
      // Equilateral pointing up, circumradius = r
      const h = r * 0.866;
      const points = [
        pt(cx, cy - r),
        pt(cx + h, cy + r * 0.5),
        pt(cx - h, cy + r * 0.5),
      ].join(" ");
      return withRotation(<polygon {...props} points={points} />);
    }

    case "diamond": {
      const points = [pt(cx, cy - r), pt(cx + r, cy), pt(cx, cy + r), pt(cx - r, cy)].join(" ");
      return withRotation(<polygon {...props} points={points} />);
    }

    case "pentagon": {
      const pts = Array.from({ length: 5 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }).join(" ");
      return withRotation(<polygon {...props} points={pts} />);
    }

    case "hexagon": {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 6;
        return pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }).join(" ");
      return withRotation(<polygon {...props} points={pts} />);
    }

    case "cross": {
      const t = r * 0.35; // half-thickness
      // Create cross as two overlapping rectangles
      const path = [
        `M ${cx - r} ${cy - t}`,
        `H ${cx - t} V ${cy - r}`,
        `H ${cx + t} V ${cy - t}`,
        `H ${cx + r} V ${cy + t}`,
        `H ${cx + t} V ${cy + r}`,
        `H ${cx - t} V ${cy + t}`,
        `H ${cx - r} Z`,
      ].join(" ");
      return withRotation(<path {...props} d={path} />);
    }

    case "arrow": {
      // Right-pointing arrow — rotation makes it directional
      const sw = r * 0.35; // shaft half-height
      const hw = r * 0.65; // head half-height
      const nx = cx + r * 0.15; // notch x (shaft-to-head)
      const points = [
        pt(cx - r,   cy - sw),
        pt(nx,       cy - sw),
        pt(nx,       cy - hw),
        pt(cx + r,   cy),
        pt(nx,       cy + hw),
        pt(nx,       cy + sw),
        pt(cx - r,   cy + sw),
      ].join(" ");
      return withRotation(<polygon {...props} points={points} />);
    }

    default:
      return null;
  }
}

// ── CellSvg ───────────────────────────────────────────────────

interface CellSvgProps {
  cell:    Cell;
  size?:   number; // rendered pixel size (default 100)
  dimmed?: boolean;
}

export function CellSvg({ cell, size = 100, dimmed = false }: CellSvgProps) {
  const count = Math.min(cell.length, 3) as 1 | 2 | 3;
  const positions = POSITIONS[count] ?? POSITIONS[1];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ opacity: dimmed ? 0.35 : 1 }}
      aria-hidden="true"
    >
      {cell.map((spec, i) => {
        const [cx, cy] = positions[i] ?? positions[0];
        const r = SIZE_R[spec.size];
        return renderShape(spec.type, cx, cy, r, spec.fill, spec.rotation, `${i}`);
      })}
    </svg>
  );
}

// ── EmptyCellSvg (the missing cell marker) ────────────────────

export function EmptyCellSvg({ size = 100 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="Missing cell">
      {/* Subtle question mark */}
      <text
        x="50" y="58"
        textAnchor="middle"
        fontSize="32"
        fontWeight="700"
        fill="#00d4ff"
        fillOpacity="0.3"
        fontFamily="monospace"
      >?</text>
    </svg>
  );
}
