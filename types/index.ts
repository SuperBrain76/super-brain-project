// ── Fighter-pilot test types ─────────────────────────────────────────────────
export type ModuleId = 'reaction' | 'visual' | 'spatial' | 'multitask' | 'math';

export interface ModuleResult {
  moduleId: ModuleId;
  moduleName: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
  completedAt: number;
  details: Record<string, number | string | boolean>;
}

export interface TestSession {
  sessionId: string;
  startedAt: number;
  completedAt: number;
  modules: ModuleResult[];
  totalScore: number;
  ranking: string;
}

// stepShape replaced zShape — the linter-updated spatialQuestions.ts uses stepShape
export interface SpatialQuestion {
  id: string;
  shapeType: 'arrow' | 'lShape' | 'tShape' | 'fShape' | 'stepShape';
  referenceRotation: number;
  targetDegrees: number;
  targetLabel: string;
  choices: Array<{ rotation: number; mirrored: boolean }>;
  correctIndex: number;
}

export interface MathQuestion {
  id: string;
  display: string;
  answer: number;
  difficulty: number;
}

export type ReactionTrial = {
  stimulusAt: number;
  respondedAt: number;
  rt: number;
  falsStart: boolean;
};

// ── Platform-wide unified result ─────────────────────────────────────────────
export type TestId = 'fighter-pilot' | 'reaction' | 'pressure' | 'memory';

export interface TestResult {
  testId: TestId;
  testName: string;
  score: number;           // 0–100
  percentileEstimate: number;
  resultTitle: string;     // "Elite", "Superhuman", etc.
  resultDescription: string;
  rawMetrics: Record<string, number | string | boolean>;
  createdAt: string;       // ISO timestamp
}

export interface SavedResult extends TestResult {
  id: string;              // UUID from Supabase
  userId: string;
  shareId: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string | null;
}
