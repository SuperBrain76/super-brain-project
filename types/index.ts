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
export type TestId = 'fighter-pilot' | 'reaction' | 'pressure' | 'memory' | 'tap-speed' | 'verbal-memory' | 'stroop' | 'career-profile';

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

export interface SavedResult {
  id: string;           // UUID from Supabase
  userId: string;
  testName: string;
  score: number;
  percentile: number;
  resultTitle: string;
  shareId: string | null;
  createdAt: string;
}

export interface ChallengeResult extends SavedResult {
  displayName: string;
  country: string | null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string | null;
  createdAt: string | null;
}

// ── User profile (user_profiles table) ───────────────────────────────────────
export interface UserProfile {
  id: string;
  displayName: string;
  country: string | null;
  birthYear: number | null;
  gender: string | null;       // 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
  industry: string | null;
  avatarColor: string;         // hex colour for avatar circle, defaults to #00d4ff
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}
