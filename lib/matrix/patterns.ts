import { makeRng, shuffle } from "./rng";
import type {
  MatrixQuestion, PatternType,
  Cell, ShapeSpec, ShapeType, FillType, SizeType,
} from "./types";

// ── Vocabulary pools ──────────────────────────────────────────

const SHAPES:  ShapeType[] = ["circle", "square", "triangle", "diamond", "cross", "arrow", "pentagon", "hexagon"];
const FILLS:   FillType[]  = ["solid", "half", "outline"];
const SIZES:   SizeType[]  = ["sm", "md", "lg"];

// ── Helpers ───────────────────────────────────────────────────

function mkSpec(type: ShapeType, fill: FillType = "solid", size: SizeType = "md", rotation = 0): ShapeSpec {
  return { type, fill, size, rotation };
}

function mkCell(...specs: ShapeSpec[]): Cell {
  return specs;
}

/** Deep equality check for two cells. */
function cellEq(a: Cell, b: Cell): boolean {
  if (a.length !== b.length) return false;
  return a.every((sa, i) => {
    const sb = b[i];
    return sa.type === sb.type && sa.fill === sb.fill && sa.size === sb.size && sa.rotation === sb.rotation;
  });
}

/**
 * Build 4 unique options (correct + 3 distinct distractors) from an ordered candidate list.
 * Guarantees: no empty cells, no duplicates of correct, no duplicate distractors.
 * Falls back to shape-variation cells if candidates are exhausted.
 */
function buildOptions(
  rng: () => number,
  correct: Cell,
  candidates: Cell[],
): { options: Cell[]; correctIndex: number } {
  const distractors: Cell[] = [];

  for (const c of candidates) {
    if (distractors.length >= 3) break;
    if (c.length === 0) continue;
    if (cellEq(c, correct)) continue;
    if (distractors.some(d => cellEq(d, c))) continue;
    distractors.push(c);
  }

  // Emergency fallback: guaranteed-unique cells using rotating shape/fill combos
  const FB_SHAPES: ShapeType[] = ["circle", "square", "triangle", "diamond", "hexagon", "pentagon"];
  const FB_FILLS:  FillType[]  = ["solid", "half", "outline"];
  let fi = 0;
  while (distractors.length < 3 && fi < 30) {
    const fb = mkCell(mkSpec(FB_SHAPES[fi % FB_SHAPES.length], FB_FILLS[fi % 3]));
    if (!cellEq(fb, correct) && !distractors.some(d => cellEq(d, fb))) {
      distractors.push(fb);
    }
    fi++;
  }

  // Place correct answer at a random index
  const idx = Math.floor(rng() * 4);
  const opts = [...distractors.slice(0, 3)];
  opts.splice(idx, 0, correct);
  return { options: opts, correctIndex: idx };
}

// ── 1. SHAPE_ROW ──────────────────────────────────────────────
// Row determines shape; column determines count (1, 2, 3).

function genShapeRow(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as [ShapeType, ShapeType, ShapeType];
  const fill: FillType = difficulty <= 2 ? "solid" : FILLS[Math.floor(rng() * 3)];
  const size: SizeType = "md";

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const count = col + 1;
      cells.push(mkCell(...Array.from({ length: count }, () => mkSpec(shapes[row], fill, size))));
    }
  }

  const correct = mkCell(...Array.from({ length: 3 }, () => mkSpec(shapes[2], fill, size)));

  // Candidates: wrong shape or wrong count
  const d1 = mkCell(...Array.from({ length: 3 }, () => mkSpec(shapes[1], fill, size))); // wrong shape
  const d2 = mkCell(...Array.from({ length: 2 }, () => mkSpec(shapes[2], fill, size))); // wrong count
  const d3 = mkCell(mkSpec(shapes[0], fill, size));                                      // very wrong count
  const d4 = mkCell(...Array.from({ length: 3 }, () => mkSpec(shapes[0], fill, size))); // wrong shape, right count

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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
// All cells use one shape; fills cycle in a fixed Latin square.
// Row 0: solid→half→outline, Row 1: half→outline→solid, Row 2: outline→solid→? (half)

function genFillCycle(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shape = SHAPES[Math.floor(rng() * 8)] as ShapeType;
  const size: SizeType = difficulty >= 4 ? SIZES[Math.floor(rng() * 3)] : "md";
  const count = difficulty >= 3 ? Math.floor(rng() * 3) + 1 : 1;

  const fillGrid: FillType[][] = [
    ["solid",   "half",    "outline"],
    ["half",    "outline", "solid"  ],
    ["outline", "solid",   "half"   ],   // answer = half
  ];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      const f = fillGrid[row][col];
      cells.push(mkCell(...Array.from({ length: count }, () => mkSpec(shape, f, size))));
    }
  }

  const correct = mkCell(...Array.from({ length: count }, () => mkSpec(shape, "half", size)));
  const wrongShape = SHAPES.find(s => s !== shape) ?? "circle";

  const d1 = mkCell(...Array.from({ length: count }, () => mkSpec(shape, "solid",   size)));
  const d2 = mkCell(...Array.from({ length: count }, () => mkSpec(shape, "outline", size)));
  const d3 = mkCell(...Array.from({ length: count }, () => mkSpec(wrongShape as ShapeType, "half", size)));
  const d4 = mkCell(...Array.from({ length: Math.max(1, count - 1) }, () => mkSpec(shape, "half", size)));

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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
// One shape rotates by STEP° at each step (reading left→right, top→bottom).

function genRotationRead(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const rotShapes: ShapeType[] = ["arrow", "triangle", "diamond"];
  const shape: ShapeType = difficulty <= 4
    ? "arrow"
    : rotShapes[Math.floor(rng() * rotShapes.length)];
  const fill: FillType = difficulty <= 3 ? "solid" : FILLS[Math.floor(rng() * 3)];
  const size: SizeType = "md";
  const step = difficulty <= 4 ? 45 : 90;
  const rotations = Array.from({ length: 9 }, (_, i) => (i * step) % 360);

  const cells: (Cell | null)[] = rotations.map((rot, i) => {
    if (i === 8) return null;
    return mkCell(mkSpec(shape, fill, size, rot));
  });

  const correctRot = rotations[8];
  const correct = mkCell(mkSpec(shape, fill, size, correctRot));

  const d1 = mkCell(mkSpec(shape, fill, size, (correctRot + step)        % 360));
  const d2 = mkCell(mkSpec(shape, fill, size, (correctRot + 180)         % 360));
  const d3 = mkCell(mkSpec(shape, fill, size, (correctRot - step + 360)  % 360));
  const d4 = mkCell(mkSpec(shape, fill, size, (correctRot + step * 2)    % 360));

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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
  const shape = SHAPES[Math.floor(rng() * 8)] as ShapeType;

  const sizeOrders: SizeType[][] = [["lg", "md", "sm"], ["sm", "md", "lg"], ["md", "lg", "sm"]];
  const fillOrders: FillType[][] = [
    ["solid", "half",    "outline"],
    ["outline", "solid", "half"   ],
    ["half",  "outline", "solid"  ],
  ];
  const sizeSeq = sizeOrders[Math.floor(rng() * 3)];
  const fillSeq = fillOrders[Math.floor(rng() * 3)];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      cells.push(mkCell(mkSpec(shape, fillSeq[col], sizeSeq[row])));
    }
  }

  const correct = mkCell(mkSpec(shape, fillSeq[2], sizeSeq[2]));
  const wrongShape = SHAPES.find(s => s !== shape) ?? "circle";

  const d1 = mkCell(mkSpec(shape,                 fillSeq[1], sizeSeq[2])); // wrong fill
  const d2 = mkCell(mkSpec(shape,                 fillSeq[2], sizeSeq[1])); // wrong size
  const d3 = mkCell(mkSpec(wrongShape as ShapeType, fillSeq[2], sizeSeq[2])); // wrong shape
  const d4 = mkCell(mkSpec(shape,                 fillSeq[0], sizeSeq[0])); // both wrong

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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
// col[2].count = col[0].count + col[1].count (capped at 4).
// Each row uses a different shape.

function genCountSum(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as ShapeType[];
  const fill: FillType = difficulty <= 5 ? "solid" : FILLS[Math.floor(rng() * 3)];
  const size: SizeType = "sm";

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

  // Build a spread of count distractors (guaranteed non-empty, no duplicates)
  const counts = [1, 2, 3, 4].filter(n => n !== correctCount);
  const d1 = mkCell(...Array.from({ length: counts[0] }, () => mkSpec(shapes[2], fill, size)));
  const d2 = mkCell(...Array.from({ length: counts[1] }, () => mkSpec(shapes[2], fill, size)));
  const d3 = mkCell(...Array.from({ length: counts[2] }, () => mkSpec(shapes[2], fill, size)));
  const d4 = mkCell(...Array.from({ length: correctCount }, () => mkSpec(shapes[1], fill, size))); // right count, wrong shape

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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
// 3 shapes in a 3×3 Latin square (each shape once per row/col).
// Hard variant overlays a second Latin square for fills.

const LATIN_SQUARES = [
  [[0,1,2],[1,2,0],[2,0,1]],
  [[0,1,2],[2,0,1],[1,2,0]],
];

function genShapeLatin(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as ShapeType[];
  const doubleLatin = difficulty >= 6;

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

  const wrongShapes = shapes.filter(s => s !== correctShape);
  const wrongFills  = FILLS.filter(f => f !== correctFill);

  const d1 = mkCell(mkSpec(wrongShapes[0], correctFill,  "md")); // wrong shape
  const d2 = mkCell(mkSpec(wrongShapes[1], correctFill,  "md")); // wrong shape (other)
  const d3 = mkCell(mkSpec(correctShape,   wrongFills[0], "md")); // wrong fill
  const d4 = mkCell(mkSpec(wrongShapes[0], wrongFills[0], "md")); // both wrong

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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
// Shape: row-based Latin square. Fill: row-based sequence. Rotation: column-based.

function genDualRule(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const shapes = shuffle(rng, SHAPES).slice(0, 3) as ShapeType[];
  const shapeLs    = LATIN_SQUARES[Math.floor(rng() * 2)];
  const rotByCol:  number[]   = [0, 90, 180];
  const fillByRow: FillType[] = ["solid", "half", "outline"];

  const cells: (Cell | null)[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 2 && col === 2) { cells.push(null); continue; }
      cells.push(mkCell(mkSpec(shapes[shapeLs[row][col]], fillByRow[row], "md", rotByCol[col])));
    }
  }

  const correctShape = shapes[shapeLs[2][2]];
  const correct = mkCell(mkSpec(correctShape, "outline", "md", 180));
  const wrongShape = shapes.find(s => s !== correctShape) ?? shapes[0];

  const d1 = mkCell(mkSpec(correctShape, "solid",   "md", 180)); // wrong fill
  const d2 = mkCell(mkSpec(correctShape, "outline", "md",  90)); // wrong rotation
  const d3 = mkCell(mkSpec(wrongShape,   "outline", "md", 180)); // wrong shape
  const d4 = mkCell(mkSpec(wrongShape,   "solid",   "md",  90)); // two rules wrong

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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
// Each row: cell[2] = shapes in col[0] OR col[1] but NOT both (XOR).
// FIXED: each row gets its own fresh shuffle — no shared pool to exhaust.

function genOverlayXor(seed: number, difficulty: number): MatrixQuestion {
  const rng = makeRng(seed);
  const fill: FillType = "solid";

  // Each row independently picks 3 distinct shapes → no pool exhaustion
  const rowSets = Array.from({ length: 3 }, () => {
    const rowShapes = shuffle(rng, SHAPES).slice(0, 3) as [ShapeType, ShapeType, ShapeType];
    const [shared, aOnly, bOnly] = rowShapes;
    return {
      a:   [shared, aOnly]  as ShapeType[],
      b:   [shared, bOnly]  as ShapeType[],
      xor: [aOnly,  bOnly]  as ShapeType[],
    };
  });

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

  // Distractors: column contents and a union variant
  const d1 = mkCell(...a.map(sh => mkSpec(sh, fill, "sm")));                        // col0 (includes shared)
  const d2 = mkCell(...b.map(sh => mkSpec(sh, fill, "sm")));                        // col1 (includes shared)
  const d3 = mkCell(mkSpec(xor[0], fill, "sm"));                                    // only one of xor pair
  const d4 = mkCell(...[...a, ...b].slice(0, 2).map(sh => mkSpec(sh, fill, "sm"))); // union variant

  const { options, correctIndex } = buildOptions(rng, correct, [d1, d2, d3, d4]);
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

// ── Difficulty → pattern mapping ──────────────────────────────

type Generator = (seed: number, diff: number) => MatrixQuestion;

const DIFFICULTY_MAP: Array<Generator[]> = [
  /* 0 — unused */  [],
  /* 1  */ [genShapeRow,    genShapeRow    ],
  /* 2  */ [genShapeRow,    genFillCycle   ],
  /* 3  */ [genFillCycle,   genRotationRead],
  /* 4  */ [genRotationRead, genSizeFill   ],
  /* 5  */ [genSizeFill,    genCountSum    ],
  /* 6  */ [genCountSum,    genShapeLatin  ],
  /* 7  */ [genShapeLatin,  genOverlayXor  ],
  /* 8  */ [genOverlayXor,  genDualRule    ],
  /* 9  */ [genDualRule,    genDualRule    ],
  /* 10 */ [genDualRule,    genDualRule    ],
];

/**
 * Generate a question deterministically from difficulty + seed offset.
 * The seed offset ensures adjacent questions look visually different.
 */
export function generateQuestion(difficulty: number, seedOffset: number): MatrixQuestion {
  const d    = Math.max(1, Math.min(10, difficulty));
  const gens = DIFFICULTY_MAP[d];
  const gen  = gens[seedOffset % gens.length];
  const seed = d * 1000 + seedOffset * 37 + 7;
  return gen(seed, d);
}
