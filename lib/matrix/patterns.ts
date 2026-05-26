import { makeRng, shuffle } from "./rng";
import type {
  MatrixQuestion, PatternType,
  Cell, ShapeSpec, ShapeType, FillType, SizeType,
} from "./types";

// ── Vocabulary pools ──────────────────────────────────────────

const SHAPES:  ShapeType[] = ["circle", "square", "triangle", "diamond", "cross", "arrow", "pentagon", "hexagon"];
const FILLS:   FillType[]  = ["solid", "half", "outline"];
const SIZES:   SizeType[]  = ["sm", "md", "lg"];
const ROTS     = [0, 45, 90, 135, 180, 225, 270, 315];

// ── Helpers ───────────────────────────────────────────────────

function mkSpec(type: ShapeType, fill: FillType = "solid", size: SizeType = "md", rotation = 0): ShapeSpec {
  return { type, fill, size, rotation };
}

function mkCell(...specs: ShapeSpec[]): Cell {
  return specs;
}

/** Randomise which of 4 positions the correct answer sits at */
function placeOptions(rng: () => number, correct: Cell, distractors: Cell[]): { options: Cell[]; correctIndex: number } {
  const idx = Math.floor(rng() * 4);
  const opts = [...distractors.slice(0, 3)];
  opts.splice(idx, 0, correct);
  return { options: opts, correctIndex: idx };
}

// ── 1. SHAPE_ROW ──────────────────────────────────────────────
// Row determines shape; column determines count.

function genShapeRow(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as [ShapeType, ShapeType, ShapeType];
  const fill: FillType = difficulty <= 2 ? "solid" : FILLS[Math.floor(rng() * 3)];
  const size: SizeType = "md";

  // Grid: cells[row*3 + col]
  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const count = col + 1;
      cells.push(mkCell(...Array.from({ length: count }, () => mkSpec(shapes[row], fill, size))));
    }
  }

  const correct = mkCell(...Array.from({ length: 3 }, () => mkSpec(shapes[2], fill, size)));

  // Distractors: wrong shape or wrong count
  const d1 = mkCell(...Array.from({ length: 3 }, () => mkSpec(shapes[1], fill, size)));
  const d2 = mkCell(...Array.from({ length: 2 }, () => mkSpec(shapes[2], fill, size)));
  const d3 = mkCell(mkSpec(shapes[0], fill, size));

  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);
  return {
    id: `SR-${seed}-${difficulty}`,
    patternType: "SHAPE_ROW",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 50,
    variant: seed % 10,
  };
}

// ── 2. FILL_CYCLE ─────────────────────────────────────────────
// All cells use one shape; fills cycle in a Latin square across rows.

function genFillCycle(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shape = SHAPES[Math.floor(rng() * 6)] as ShapeType;
  const size: SizeType = difficulty >= 4 ? (SIZES[Math.floor(rng() * 3)]) : "md";
  const count = difficulty >= 3 ? Math.floor(rng() * 3) + 1 : 1;

  // Latin square of fills:
  // Row 0: solid, half, outline
  // Row 1: half, outline, solid
  // Row 2: outline, solid, ?  → answer = half
  const fillGrid: FillType[][] = [
    ["solid", "half", "outline"],
    ["half",  "outline", "solid"],
    ["outline", "solid", "half"],
  ];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const f = fillGrid[row][col];
      cells.push(mkCell(...Array.from({ length: count }, () => mkSpec(shape, f, size))));
    }
  }

  // Answer: fill = half (row 2, col 2)
  const correct = mkCell(...Array.from({ length: count }, () => mkSpec(shape, "half", size)));

  const d1 = mkCell(...Array.from({ length: count }, () => mkSpec(shape, "solid", size)));
  const d2 = mkCell(...Array.from({ length: count }, () => mkSpec(shape, "outline", size)));
  // D3: wrong shape entirely
  const wrongShape = SHAPES.find(s => s !== shape) ?? "circle";
  const d3 = mkCell(...Array.from({ length: count }, () => mkSpec(wrongShape as ShapeType, "half", size)));

  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);
  return {
    id: `FC-${seed}-${difficulty}`,
    patternType: "FILL_CYCLE",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 50,
    variant: seed % 10,
  };
}

// ── 3. ROTATION_READ ─────────────────────────────────────────
// One shape rotates by STEP° at each step reading left→right, top→bottom.
// Cell[i] has rotation = i * STEP. Answer = cell[8] rotation.

function genRotationRead(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shape: ShapeType = difficulty <= 4 ? "arrow" : (["arrow", "triangle", "diamond"][Math.floor(rng() * 3)] as ShapeType);
  const fill: FillType = difficulty <= 3 ? "solid" : FILLS[Math.floor(rng() * 3)];
  const size: SizeType = "md";

  // Step: 45° easy, 90° medium
  const step = difficulty <= 4 ? 45 : 90;
  const rotations = Array.from({ length: 9 }, (_, i) => (i * step) % 360);

  const cells: (Cell | null)[] = rotations.map((rot, i) => {
    if (i === 8) return null;
    return mkCell(mkSpec(shape, fill, size, rot));
  });

  const correctRot = rotations[8];
  const correct = mkCell(mkSpec(shape, fill, size, correctRot));

  // Distractors: adjacent rotations and wrong rotation
  const d1 = mkCell(mkSpec(shape, fill, size, (correctRot + step) % 360));
  const d2 = mkCell(mkSpec(shape, fill, size, (correctRot + 180) % 360));
  const d3 = mkCell(mkSpec(shape, fill, size, (correctRot - step + 360) % 360));

  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);
  return {
    id: `RR-${seed}-${difficulty}`,
    patternType: "ROTATION_READ",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 45,
    variant: step === 45 ? 0 : 1,
  };
}

// ── 4. SIZE_FILL ──────────────────────────────────────────────
// Two independent rules: row controls size, column controls fill.

function genSizeFill(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shape = SHAPES[Math.floor(rng() * 5)] as ShapeType;

  // Row determines size: [lg, md, sm] OR [sm, md, lg]
  const sizeOrders: SizeType[][] = [["lg", "md", "sm"], ["sm", "md", "lg"], ["md", "lg", "sm"]];
  const sizeSeq = sizeOrders[Math.floor(rng() * 3)];

  // Column determines fill (solid, half, outline)
  const fillOrders: FillType[][] = [
    ["solid", "half", "outline"],
    ["outline", "solid", "half"],
    ["half", "outline", "solid"],
  ];
  const fillSeq = fillOrders[Math.floor(rng() * 3)];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      cells.push(mkCell(mkSpec(shape, fillSeq[col], sizeSeq[row])));
    }
  }

  const correct = mkCell(mkSpec(shape, fillSeq[2], sizeSeq[2]));

  // Distractors: single rule wrong
  const d1 = mkCell(mkSpec(shape, fillSeq[1], sizeSeq[2])); // wrong fill
  const d2 = mkCell(mkSpec(shape, fillSeq[2], sizeSeq[1])); // wrong size
  const wrongShape = SHAPES.find(s => s !== shape) ?? "circle";
  const d3 = mkCell(mkSpec(wrongShape as ShapeType, fillSeq[2], sizeSeq[2])); // wrong shape

  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);
  return {
    id: `SF-${seed}-${difficulty}`,
    patternType: "SIZE_FILL",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 50,
    variant: seed % 6,
  };
}

// ── 5. COUNT_SUM ─────────────────────────────────────────────
// col[2].count = col[0].count + col[1].count (capped at 4, shown as 1–4 shapes).
// Each row uses a different shape.

function genCountSum(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as ShapeType[];
  const fill: FillType = difficulty <= 5 ? "solid" : FILLS[Math.floor(rng() * 3)];
  const size: SizeType = "sm"; // smaller to fit 4 shapes

  // Define count pairs per row: (a, b) → sum = a + b, capped at 4
  const PAIRS: [number, number][] = [[1, 1], [1, 2], [2, 1], [2, 2], [1, 3], [3, 1]];
  const usedPairs = shuffle(rng, PAIRS).slice(0, 3) as [number, number][];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    const [a, b] = usedPairs[row];
    const sum = Math.min(a + b, 4);
    const sh = shapes[row];
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const count = col === 0 ? a : col === 1 ? b : sum;
      cells.push(mkCell(...Array.from({ length: count }, () => mkSpec(sh, fill, size))));
    }
  }

  const [a, b] = usedPairs[2];
  const correctCount = Math.min(a + b, 4);
  const correct = mkCell(...Array.from({ length: correctCount }, () => mkSpec(shapes[2], fill, size)));

  const d1 = mkCell(...Array.from({ length: correctCount - 1 }, () => mkSpec(shapes[2], fill, size)));
  const d2 = mkCell(...Array.from({ length: correctCount + 1 > 4 ? correctCount - 1 : correctCount + 1 }, () => mkSpec(shapes[2], fill, size)));
  const d3 = mkCell(...Array.from({ length: correctCount }, () => mkSpec(shapes[1], fill, size)));

  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);
  return {
    id: `CS-${seed}-${difficulty}`,
    patternType: "COUNT_SUM",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 55,
    variant: seed % 6,
  };
}

// ── 6. SHAPE_LATIN ────────────────────────────────────────────
// 3 shapes arranged in a 3×3 Latin square (each shape exactly once per row/col).
// Harder variant adds fill as a second independent Latin square.

// The 12 valid reduced 3×3 Latin squares (first row fixed as 0,1,2):
const LATIN_SQUARES = [
  [[0,1,2],[1,2,0],[2,0,1]],
  [[0,1,2],[2,0,1],[1,2,0]],
];

function genShapeLatin(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as ShapeType[];
  const doubleLatin = difficulty >= 6; // also apply latin square to fills

  const shapeLs = LATIN_SQUARES[Math.floor(rng() * 2)];
  const fillLs  = LATIN_SQUARES[(Math.floor(rng() * 2) + 1) % 2];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const sh = shapes[shapeLs[row][col]];
      const fi = doubleLatin ? FILLS[fillLs[row][col]] : "solid";
      cells.push(mkCell(mkSpec(sh, fi, "md")));
    }
  }

  const correctShape = shapes[shapeLs[2][2]];
  const correctFill  = doubleLatin ? FILLS[fillLs[2][2]] : "solid";
  const correct = mkCell(mkSpec(correctShape, correctFill, "md"));

  // Distractors: other shapes that appear in row 2 or col 2 (wrong deduction)
  const wrongShapes = shapes.filter(s => s !== correctShape);
  const d1 = mkCell(mkSpec(wrongShapes[0], correctFill, "md"));
  const d2 = mkCell(mkSpec(wrongShapes[1], correctFill, "md"));
  const wrongFill = FILLS.find(f => f !== correctFill) ?? "half";
  const d3 = mkCell(mkSpec(correctShape, wrongFill, "md"));

  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);
  return {
    id: `SL-${seed}-${difficulty}`,
    patternType: "SHAPE_LATIN",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 60,
    variant: doubleLatin ? 1 : 0,
  };
}

// ── 7. DUAL_RULE ──────────────────────────────────────────────
// Shape follows row-based Latin square AND rotation follows a column-based sequence.

function genDualRule(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as ShapeType[];

  const shapeLs = LATIN_SQUARES[Math.floor(rng() * 2)];

  // Rotation rule: column 0 = 0°, col 1 = 90°, col 2 = 180° (simple column rule)
  const rotByCol = [0, 90, 180];

  // Fill rule: row-based solid/half/outline
  const fillByRow: FillType[] = ["solid", "half", "outline"];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const sh  = shapes[shapeLs[row][col]];
      const fi  = fillByRow[row];
      const rot = rotByCol[col];
      cells.push(mkCell(mkSpec(sh, fi, "md", rot)));
    }
  }

  const correctShape = shapes[shapeLs[2][2]];
  const correct = mkCell(mkSpec(correctShape, "outline", "md", 180));

  // Distractors: one rule wrong each
  const d1 = mkCell(mkSpec(correctShape, "solid",   "md", 180)); // wrong fill
  const d2 = mkCell(mkSpec(correctShape, "outline",  "md", 90));  // wrong rotation
  const wrongShape = shapes.find(s => s !== correctShape) ?? "circle";
  const d3 = mkCell(mkSpec(wrongShape, "outline", "md", 180));    // wrong shape

  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);
  return {
    id: `DR-${seed}-${difficulty}`,
    patternType: "DUAL_RULE",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 60,
    variant: seed % 4,
  };
}

// ── 8. OVERLAY_XOR ───────────────────────────────────────────
// Each row: cell[2] contains shapes present in cell[0] OR cell[1] but NOT both.

function genOverlayXor(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const allShapes = shuffle(rng, SHAPES.slice(0, 6)) as ShapeType[];
  const fill: FillType = "solid";

  // Each row gets 2 shapes in col0, 2 in col1; col2 = XOR
  const rowSets: { a: ShapeType[]; b: ShapeType[]; xor: ShapeType[] }[] = [];
  const pool = [...allShapes];

  for (let row = 0; row < 3; row++) {
    const shared = pool.splice(0, 1)[0];
    const aOnly  = pool.splice(0, 1)[0];
    const bOnly  = pool.splice(0, 1)[0];
    rowSets.push({
      a:   [shared, aOnly],
      b:   [shared, bOnly],
      xor: [aOnly, bOnly],
    });
  }

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    const { a, b, xor } = rowSets[row];
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const shapeArr = col === 0 ? a : col === 1 ? b : xor;
      cells.push(mkCell(...shapeArr.map(sh => mkSpec(sh, fill, "sm"))));
    }
  }

  const { xor, a, b } = rowSets[2];
  const correct = mkCell(...xor.map(sh => mkSpec(sh, fill, "sm")));
  const d1 = mkCell(...a.map(sh => mkSpec(sh, fill, "sm")));          // col0 contents
  const d2 = mkCell(...b.map(sh => mkSpec(sh, fill, "sm")));          // col1 contents
  const d3 = mkCell(...[...a, ...b].slice(0, 2).map(sh => mkSpec(sh, fill, "sm"))); // union variant
  const { options, correctIndex } = placeOptions(rng, correct, [d1, d2, d3]);

  return {
    id: `OX-${seed}-${difficulty}`,
    patternType: "OVERLAY_XOR",
    difficulty,
    cells,
    options,
    correctIndex,
    timeLimit: 65,
    variant: seed % 4,
  };
}

// ── Difficulty → pattern + variant mapping ────────────────────

type Generator = (seed: number, diff: number) => MatrixQuestion;

const DIFFICULTY_MAP: Array<Generator[]> = [
  /* 0 — unused */  [],
  /* 1 */ [genShapeRow, genShapeRow],
  /* 2 */ [genShapeRow, genFillCycle],
  /* 3 */ [genFillCycle, genRotationRead],
  /* 4 */ [genRotationRead, genSizeFill],
  /* 5 */ [genSizeFill, genCountSum],
  /* 6 */ [genCountSum, genShapeLatin],
  /* 7 */ [genShapeLatin, genOverlayXor],
  /* 8 */ [genOverlayXor, genDualRule],
  /* 9 */ [genDualRule, genDualRule],
  /* 10 */ [genDualRule, genDualRule],
];

/**
 * Generate a question deterministically from difficulty + a seed offset.
 * The seed offset provides variety so repeated attempts get different visuals.
 */
export function generateQuestion(difficulty: number, seedOffset: number): MatrixQuestion {
  const d     = Math.max(1, Math.min(10, difficulty));
  const gens  = DIFFICULTY_MAP[d];
  const gen   = gens[seedOffset % gens.length];
  const seed  = d * 1000 + seedOffset * 37 + 7;
  return gen(seed, d);
}
