// ── Shape vocabulary ──────────────────────────────────────────

export type ShapeType =
  | "circle" | "square" | "triangle" | "diamond"
  | "cross"  | "arrow"  | "pentagon" | "hexagon";

/** How a shape is filled */
export type FillType = "solid" | "outline" | "half";

/** Relative size inside a cell */
export type SizeType = "sm" | "md" | "lg";

export interface ShapeSpec {
  type:     ShapeType;
  fill:     FillType;
  size:     SizeType;
  rotation: number; // degrees, multiples of 45
}

/** One cell = zero or more shapes */
export type Cell = ShapeSpec[];

// ── Question structure ────────────────────────────────────────

export type PatternType =
  | "SHAPE_ROW"       // row=shape, col=count                  difficulty 1–3
  | "FILL_CYCLE"      // fill Latin square, shape constant      difficulty 2–4
  | "ROTATION_READ"   // shape rotates 45° per step             difficulty 3–5
  | "SIZE_FILL"       // size + fill dual rule                  difficulty 4–6
  | "COUNT_SUM"       // col2.count = col0.count + col1.count   difficulty 4–6
  | "SHAPE_LATIN"     // shapes in Latin-square arrangement     difficulty 5–7
  | "DUAL_RULE"       // two independent rules simultaneous     difficulty 7–10
  | "OVERLAY_XOR";    // XOR of two shape sets                  difficulty 6–8

export interface MatrixQuestion {
  id:           string;          // seed-based unique id
  patternType:  PatternType;
  difficulty:   number;          // 1–10
  cells:        (Cell | null)[]; // 9 entries; index 8 = null (missing)
  options:      Cell[];          // exactly 4; correctIndex says which is correct
  correctIndex: number;          // 0–3
  timeLimit:    number;          // seconds
  variant:      number;          // which variant within pattern type
}

// ── Session / adaptive state ──────────────────────────────────

export interface QuestionAttempt {
  questionId:   string;
  difficulty:   number;
  correct:      boolean;
  responseMs:   number;
  selectedIndex: number; // -1 = timeout
}

export interface SessionState {
  sessionId:        string;
  attempts:         QuestionAttempt[];
  abilityEstimate:  number;   // 1–10 scale
  currentDifficulty: number;  // 1–10
  questionsTotal:   number;
  startedAt:        number;   // Date.now()
  focusViolations:  number;
  suspiciousTimes:  number;
}

// ── Result ────────────────────────────────────────────────────

export interface AssessmentResult {
  sessionId:         string;
  fluidScore:        number;   // 0–100
  percentile:        number;   // 0–99
  speedScore:        number;   // 0–100
  accuracyRate:      number;   // 0–1
  difficultyReached: number;   // 1–10
  consistencyScore:  number;   // 0–100
  questionsAnswered: number;
  avgResponseMs:     number;
  flagged:           boolean;
  profile: {
    label:       string; // e.g. "High-Range Fluid Reasoner"
    description: string;
    strengths:   string[];
  };
}
