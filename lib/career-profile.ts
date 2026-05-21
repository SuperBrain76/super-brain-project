// ─────────────────────────────────────────────────────────────────────────────
// SuperBrain — Career Cognitive Profile
// Data layer: questions, scoring engine, archetypes, career matches
// ─────────────────────────────────────────────────────────────────────────────

// ── Dimension types ──────────────────────────────────────────────────────────

export type DimKey =
  | "analyticalRatio"  // 0 = pure intuition ←→ 100 = data-driven
  | "cognitiveSpeed"   // 0 = deliberate ←→ 100 = instinctive
  | "riskTolerance"    // 0 = risk-averse ←→ 100 = risk-seeking
  | "systemsThinking"  // 0 = detail/execution ←→ 100 = strategy/big-picture
  | "autonomyDrive"    // 0 = collaborative ←→ 100 = independent
  | "leadershipMode"   // 0 = directive ←→ 100 = facilitative/coaching
  | "adaptability";    // 0 = structure-seeking ←→ 100 = change-embracing

export type Dimensions = Record<DimKey, number>;

export const DIM_META: Record<DimKey, { label: string; low: string; high: string; description: string }> = {
  analyticalRatio: {
    label:       "Analytical Ratio",
    low:         "Intuitive",
    high:        "Data-Driven",
    description: "How heavily you weight hard data versus pattern recognition and gut feel when making decisions.",
  },
  cognitiveSpeed: {
    label:       "Cognitive Speed",
    low:         "Deliberate",
    high:        "Instinctive",
    description: "Whether you process and decide quickly on instinct, or prefer slowing down to reason through options.",
  },
  riskTolerance: {
    label:       "Risk Tolerance",
    low:         "Risk-Averse",
    high:        "Risk-Seeking",
    description: "Your natural appetite for uncertainty, upside variance, and ambiguous outcomes versus guaranteed results.",
  },
  systemsThinking: {
    label:       "Systems Thinking",
    low:         "Detail-Focused",
    high:        "Big-Picture",
    description: "Whether you naturally zoom into execution and precision, or zoom out to strategy and second-order effects.",
  },
  autonomyDrive: {
    label:       "Autonomy Drive",
    low:         "Collaborative",
    high:        "Independent",
    description: "Your preference for self-directed, solo deep work versus collaborative, team-first problem solving.",
  },
  leadershipMode: {
    label:       "Leadership Mode",
    low:         "Directive",
    high:        "Facilitative",
    description: "Whether you lead by deciding and directing, or by asking questions, empowering, and building consensus.",
  },
  adaptability: {
    label:       "Adaptability",
    low:         "Structure-Led",
    high:        "Change-Led",
    description: "Your comfort with ambiguity, pivots, and evolving scope versus defined processes and stable environments.",
  },
};

// ── Question types ───────────────────────────────────────────────────────────

export type DimDeltas = Partial<Record<DimKey, number>>;

export interface SpeedOption {
  label:    string;
  deltas:   DimDeltas;
}

export interface SpeedQuestion {
  type:      "speed";
  id:        string;
  prompt:    string;
  options:   [SpeedOption, SpeedOption];
  timeLimit: number; // ms
}

export interface ScenarioOption {
  label:  string;
  deltas: DimDeltas;
}

export interface ScenarioQuestion {
  type:    "scenario";
  id:      string;
  context: string;
  prompt:  string;
  options: [ScenarioOption, ScenarioOption, ScenarioOption, ScenarioOption];
}

export interface RankingItem {
  id:      string;
  label:   string;
  detail:  string;
  deltas:  DimDeltas; // applied at +20/+10/0/-10 based on rank position
}

export interface RankingQuestion {
  type:   "ranking";
  id:     string;
  prompt: string;
  items:  [RankingItem, RankingItem, RankingItem, RankingItem];
}

export interface TradeoffOption {
  label:  string;
  tag:    string;
  deltas: DimDeltas;
}

export interface TradeoffQuestion {
  type:    "tradeoff";
  id:      string;
  prompt:  string;
  optionA: TradeoffOption;
  optionB: TradeoffOption;
}

export interface AllocCategory {
  id:        string;
  label:     string;
  detail:    string;
  deltas:    DimDeltas; // scaled by allocation%: (pct/100) * scale
  scale:     number;
}

export interface AllocationQuestion {
  type:       "allocation";
  id:         string;
  prompt:     string;
  categories: [AllocCategory, AllocCategory, AllocCategory, AllocCategory];
}

export type Question =
  | SpeedQuestion
  | ScenarioQuestion
  | RankingQuestion
  | TradeoffQuestion
  | AllocationQuestion;

// ── Question bank ─────────────────────────────────────────────────────────────

export const SPEED_QUESTIONS: SpeedQuestion[] = [
  {
    type: "speed",
    id: "s1",
    prompt: "New project arrives — brief is 40% unclear.",
    timeLimit: 4500,
    options: [
      { label: "Clarify everything before touching it", deltas: { analyticalRatio: +14, cognitiveSpeed: -8 } },
      { label: "Dive in, clarify as you go",            deltas: { adaptability: +12, cognitiveSpeed: +10 } },
    ],
  },
  {
    type: "speed",
    id: "s2",
    prompt: "Major decision. Deadline: right now.",
    timeLimit: 4500,
    options: [
      { label: "I trust my read — decide immediately", deltas: { cognitiveSpeed: +14, riskTolerance: +10 } },
      { label: "Give me one more minute",               deltas: { analyticalRatio: +12, cognitiveSpeed: -8 } },
    ],
  },
  {
    type: "speed",
    id: "s3",
    prompt: "You see a faster path to the goal — 30% riskier.",
    timeLimit: 4500,
    options: [
      { label: "Take the fast path",  deltas: { riskTolerance: +14, cognitiveSpeed: +8 } },
      { label: "Stick to the plan",   deltas: { riskTolerance: -10, analyticalRatio: +10 } },
    ],
  },
  {
    type: "speed",
    id: "s4",
    prompt: "Ideal deep work mode:",
    timeLimit: 4500,
    options: [
      { label: "Solo, focused, uninterrupted",      deltas: { autonomyDrive: +14, analyticalRatio: +6 } },
      { label: "High-energy, collaborative, live",  deltas: { leadershipMode: +10, adaptability: +8, autonomyDrive: -6 } },
    ],
  },
  {
    type: "speed",
    id: "s5",
    prompt: "In a room with no clear leader, you:",
    timeLimit: 4500,
    options: [
      { label: "Naturally take over and drive it",   deltas: { leadershipMode: -12, autonomyDrive: +8 } },
      { label: "Facilitate and draw others out",     deltas: { leadershipMode: +14, autonomyDrive: -4 } },
    ],
  },
  {
    type: "speed",
    id: "s6",
    prompt: "Success in a project looks like:",
    timeLimit: 4500,
    options: [
      { label: "The output was excellent",        deltas: { analyticalRatio: +10, systemsThinking: -6 } },
      { label: "The approach was repeatable",     deltas: { systemsThinking: +14, adaptability: +4 } },
    ],
  },
];

export const SCENARIO_QUESTIONS: ScenarioQuestion[] = [
  {
    type: "scenario",
    id: "sc1",
    context: "Three weeks into a project, a core assumption turns out to be wrong.",
    prompt: "Your first move is to…",
    options: [
      { label: "Map what changed, rebuild the plan solo, then share",  deltas: { analyticalRatio: +12, autonomyDrive: +10 } },
      { label: "Immediately call the team together to diagnose it",     deltas: { leadershipMode: +12, autonomyDrive: -8 } },
      { label: "Pivot instantly — adapt around the new information",    deltas: { adaptability: +14, riskTolerance: +8 } },
      { label: "Escalate and get leadership input before moving",       deltas: { autonomyDrive: -12, riskTolerance: -8 } },
    ],
  },
  {
    type: "scenario",
    id: "sc2",
    context: "You're hiring for a critical role. Two strong finalists remain.",
    prompt: "You lean towards…",
    options: [
      { label: "Deep technical expertise, some gaps on soft skills",     deltas: { analyticalRatio: +10, systemsThinking: -4 } },
      { label: "Exceptional culture fit, skill gaps you can close",      deltas: { leadershipMode: +10, adaptability: +8 } },
      { label: "High ceiling, unproven — a bet on potential",            deltas: { riskTolerance: +14, cognitiveSpeed: +6 } },
      { label: "Proven performer, reliable, lower upside",               deltas: { riskTolerance: -12, analyticalRatio: +8 } },
    ],
  },
  {
    type: "scenario",
    id: "sc3",
    context: "Two equally urgent priorities land simultaneously. You can only do one.",
    prompt: "You choose based on…",
    options: [
      { label: "Highest long-term strategic impact",              deltas: { systemsThinking: +14, riskTolerance: +4 } },
      { label: "Which I can finish fastest to free up capacity",  deltas: { cognitiveSpeed: +12, adaptability: +6 } },
      { label: "Delegate one immediately to someone qualified",   deltas: { leadershipMode: +10, autonomyDrive: -4 } },
      { label: "Push back and negotiate the timeline",            deltas: { analyticalRatio: +10, riskTolerance: -6 } },
    ],
  },
  {
    type: "scenario",
    id: "sc4",
    context: "Your work receives unexpected public recognition.",
    prompt: "Your immediate reaction is:",
    options: [
      { label: "Motivation to push the bar even higher",           deltas: { cognitiveSpeed: +8, riskTolerance: +8, systemsThinking: +4 } },
      { label: "Pressure to maintain the standard I just set",     deltas: { analyticalRatio: +10, riskTolerance: -8 } },
      { label: "I think of everyone who contributed — not just me", deltas: { leadershipMode: +12, autonomyDrive: -8 } },
      { label: "Already thinking about the next challenge",        deltas: { adaptability: +12, systemsThinking: +8 } },
    ],
  },
  {
    type: "scenario",
    id: "sc5",
    context: "Your team is in heated disagreement about the right approach. You have a strong view.",
    prompt: "You…",
    options: [
      { label: "State my position clearly and advocate for it",         deltas: { autonomyDrive: +10, leadershipMode: -10 } },
      { label: "Ask questions to deeply understand all perspectives first", deltas: { leadershipMode: +14, analyticalRatio: +6 } },
      { label: "Propose running a quick experiment to test both paths", deltas: { adaptability: +12, riskTolerance: +6 } },
      { label: "Let the group decide — I'll fully execute whatever we align on", deltas: { leadershipMode: +8, autonomyDrive: -14 } },
    ],
  },
  {
    type: "scenario",
    id: "sc6",
    context: "A high-upside career opportunity arrives — but it requires leaving your current comfort zone.",
    prompt: "You…",
    options: [
      { label: "Take it — growth lives outside comfort zones",             deltas: { riskTolerance: +14, adaptability: +10 } },
      { label: "Run a thorough evaluation before committing",              deltas: { analyticalRatio: +12, riskTolerance: -4 } },
      { label: "Negotiate terms to meaningfully reduce the downside risk", deltas: { analyticalRatio: +8, riskTolerance: +6 } },
      { label: "Pass for now — my current trajectory is working",          deltas: { riskTolerance: -14, adaptability: -6 } },
    ],
  },
];

export const RANKING_QUESTIONS: RankingQuestion[] = [
  {
    type: "ranking",
    id: "r1",
    prompt: "Rank what energises you most at work (tap in order, 1 = most)",
    items: [
      { id: "r1a", label: "Solving a complex technical or strategic problem", detail: "Deep problem-solving",     deltas: { analyticalRatio: +1, systemsThinking: +1 } },
      { id: "r1b", label: "Leading a team through uncertainty",               detail: "People & navigation",      deltas: { leadershipMode: +1, systemsThinking: +1 } },
      { id: "r1c", label: "Building trust and relationships",                 detail: "Human connection",         deltas: { leadershipMode: +1, autonomyDrive: -1 } },
      { id: "r1d", label: "Shipping something fast and iterating on it",      detail: "Execution & momentum",     deltas: { adaptability: +1, cognitiveSpeed: +1 } },
    ],
  },
  {
    type: "ranking",
    id: "r2",
    prompt: "Rank what matters most to you at work (tap in order, 1 = most)",
    items: [
      { id: "r2a", label: "Intellectual challenge and depth of complexity",   detail: "Cognitive stimulation",    deltas: { analyticalRatio: +1, systemsThinking: +1 } },
      { id: "r2b", label: "Speed of execution and forward momentum",          detail: "Pace & throughput",        deltas: { cognitiveSpeed: +1, adaptability: +1 } },
      { id: "r2c", label: "Autonomy and ownership over direction",            detail: "Self-direction",           deltas: { autonomyDrive: +1 } },
      { id: "r2d", label: "Collaborative culture and quality of people",      detail: "Team & belonging",         deltas: { leadershipMode: +1, autonomyDrive: -1 } },
    ],
  },
];

export const TRADEOFF_QUESTIONS: TradeoffQuestion[] = [
  {
    type: "tradeoff",
    id: "t1",
    prompt: "Choose your project:",
    optionA: { label: "Guaranteed $50K impact", tag: "CERTAIN",   deltas: { riskTolerance: -14 } },
    optionB: { label: "40% chance of $150K impact", tag: "UPSIDE",  deltas: { riskTolerance: +14 } },
  },
  {
    type: "tradeoff",
    id: "t2",
    prompt: "Your preferred working style:",
    optionA: { label: "Move fast, ship, learn from the market",   tag: "ITERATE",  deltas: { cognitiveSpeed: +14, adaptability: +8 } },
    optionB: { label: "Plan thoroughly, then execute with precision", tag: "PRECISE", deltas: { analyticalRatio: +12, cognitiveSpeed: -8 } },
  },
  {
    type: "tradeoff",
    id: "t3",
    prompt: "Where would you rather have impact?",
    optionA: { label: "Deep, lasting impact on 5 people",  tag: "DEPTH",  deltas: { analyticalRatio: +8, autonomyDrive: +6 } },
    optionB: { label: "Broad influence across 500 people", tag: "SCALE",  deltas: { systemsThinking: +10, leadershipMode: +8 } },
  },
  {
    type: "tradeoff",
    id: "t4",
    prompt: "Choose your work environment:",
    optionA: { label: "Full autonomy with high ambiguity",    tag: "FREEDOM",    deltas: { autonomyDrive: +14, adaptability: +10, riskTolerance: +6 } },
    optionB: { label: "Clear scope with less decision power", tag: "STRUCTURE",  deltas: { autonomyDrive: -12, analyticalRatio: +8, riskTolerance: -8 } },
  },
];

export const ALLOCATION_QUESTIONS: AllocationQuestion[] = [
  {
    type: "allocation",
    id: "a1",
    prompt: "Distribute your ideal workweek (100 points total):",
    categories: [
      { id: "strategy",   label: "Strategic planning & vision",         detail: "Long-range thinking, positioning", deltas: { systemsThinking: 1, riskTolerance: 0.3 }, scale: 18 },
      { id: "analytical", label: "Deep analytical or technical work",   detail: "Research, modelling, building",   deltas: { analyticalRatio: 1, autonomyDrive: 0.4 }, scale: 18 },
      { id: "people",     label: "Team leadership & people dev",        detail: "Coaching, 1:1s, culture",         deltas: { leadershipMode: 1, autonomyDrive: -0.4 }, scale: 18 },
      { id: "execution",  label: "Fast execution & shipping",           detail: "Getting things done, momentum",   deltas: { adaptability: 1, cognitiveSpeed: 0.5 }, scale: 18 },
    ],
  },
  {
    type: "allocation",
    id: "a2",
    prompt: "How do you actually make important decisions? (100 points total):",
    categories: [
      { id: "data",     label: "Hard data and metrics",           detail: "Quantitative evidence first",         deltas: { analyticalRatio: 1 }, scale: 20 },
      { id: "pattern",  label: "Pattern recognition & intuition", detail: "Reading the room, gut signals",       deltas: { cognitiveSpeed: 0.6, adaptability: 0.4 }, scale: 20 },
      { id: "precedent",label: "Precedent and proven approaches", detail: "What's worked before",               deltas: { riskTolerance: -0.8, analyticalRatio: 0.2 }, scale: 20 },
      { id: "explore",  label: "Experimentation",                 detail: "Test new approaches first",          deltas: { adaptability: 0.8, riskTolerance: 0.6 }, scale: 20 },
    ],
  },
];

// ── All questions in assessment order ────────────────────────────────────────

export const ALL_QUESTIONS: Question[] = [
  ...SPEED_QUESTIONS,
  ...SCENARIO_QUESTIONS,
  ...RANKING_QUESTIONS,
  ...TRADEOFF_QUESTIONS,
  ...ALLOCATION_QUESTIONS,
];

// ── Archetype definitions ─────────────────────────────────────────────────────

export type ArchetypeId =
  | "architect" | "navigator" | "pioneer" | "operator"
  | "catalyst"  | "analyst"  | "visionary" | "connector";

export interface CareerMatch {
  title:    string;
  category: string;
  match:    number; // 0-100
}

export interface Archetype {
  id:          ArchetypeId;
  name:        string;
  tagline:     string;
  summary:     string;
  color:       string;
  ideal:       Dimensions;   // ideal dimension profile for matching
  careers:     CareerMatch[];
  environments:string[];
  drains:      string[];
  leadership:  string;
  communication: string;
  thinkingStyle: string;
  riskProfile: string;
}

// Ideal dimension profiles — each archetype has a "fingerprint"
const BASE: Dimensions = {
  analyticalRatio: 50, cognitiveSpeed: 50, riskTolerance: 50,
  systemsThinking: 50, autonomyDrive: 50,  leadershipMode: 50, adaptability: 50,
};

export const ARCHETYPES: Archetype[] = [
  {
    id: "architect",
    name: "The Architect",
    tagline: "You build thinking systems, not just solutions.",
    summary: "Your cognitive profile combines deep analytical processing with strong systems orientation. You naturally decompose complexity into components, map dependencies, and design solutions built to scale. You operate at your highest level when given a genuinely hard problem and the autonomy to solve it properly.",
    color: "#00d4ff",
    ideal: { ...BASE, analyticalRatio: 84, cognitiveSpeed: 38, riskTolerance: 28, systemsThinking: 82, autonomyDrive: 72, leadershipMode: 32, adaptability: 44 },
    careers: [
      { title: "Engineering Manager",     category: "Technology",   match: 94 },
      { title: "Technical Lead / Staff",  category: "Technology",   match: 91 },
      { title: "Product Architect",       category: "Product",      match: 87 },
      { title: "Strategy Consultant",     category: "Consulting",   match: 84 },
      { title: "Solutions Architect",     category: "Technology",   match: 82 },
      { title: "Data Engineering Lead",   category: "Data",         match: 79 },
    ],
    environments: ["Engineering-led organizations", "Complex system environments", "Deep autonomy cultures", "High-craft companies"],
    drains: ["Chronic context-switching", "Vague, underdefined scope", "Heavy politics over substance", "Constant interruptions"],
    leadership: "You lead through expertise and structural clarity. Teams trust your judgment on hard technical calls. You set precise expectations, build systems that outlast your involvement, and mentor through depth rather than motivation.",
    communication: "Precise and thorough. You prefer written async communication where nuance is preserved. In meetings, you want an agenda, pre-read materials, and outcomes-focused discussion. You're direct and rarely perform enthusiasm you don't feel.",
    thinkingStyle: "Deliberate and systematic. You build mental models before acting — trading speed for precision and consistently winning that trade.",
    riskProfile: "Calibrated risk-aversion. You don't avoid risk — you price it. You take bets when the analysis supports them, not before.",
  },
  {
    id: "navigator",
    name: "The Navigator",
    tagline: "You find the path when there is no map.",
    summary: "Your profile combines strategic orientation with strong operational discipline — rare and highly valued. You think in systems and outcomes while keeping teams grounded in execution. You read complex organizational environments well and move through them without losing direction.",
    color: "#ffab00",
    ideal: { ...BASE, analyticalRatio: 64, cognitiveSpeed: 62, riskTolerance: 52, systemsThinking: 76, autonomyDrive: 54, leadershipMode: 66, adaptability: 66 },
    careers: [
      { title: "Chief of Staff",           category: "Operations",    match: 95 },
      { title: "General Manager",          category: "Management",    match: 92 },
      { title: "Management Consultant",    category: "Consulting",    match: 89 },
      { title: "Strategy & Operations",    category: "Operations",    match: 86 },
      { title: "Program Director",         category: "Management",    match: 83 },
      { title: "Product Manager (Senior)", category: "Product",       match: 80 },
    ],
    environments: ["Complex multi-team orgs", "Scaling companies", "High-ambiguity environments", "Matrix organizations"],
    drains: ["Pure execution without strategy input", "Rigid bureaucratic processes", "No visibility into the bigger picture", "Constant firefighting"],
    leadership: "Balanced and situational. You read the room and adapt — directive when clarity is needed, facilitative when the team has the answers. You build alignment across functions effortlessly.",
    communication: "Clear and contextual. You calibrate depth to your audience — crisp summaries upward, detail-oriented discussions downward. Excellent at translating between technical and business language.",
    thinkingStyle: "Integrative. You hold the big picture and the operational detail simultaneously, switching between zoom levels without losing either.",
    riskProfile: "Balanced and deliberate. You're not afraid of the hard call — but you do the work to make it an informed one.",
  },
  {
    id: "pioneer",
    name: "The Pioneer",
    tagline: "You move first and figure out the map later.",
    summary: "Your cognitive pattern is built for high-velocity, high-uncertainty environments. You process ambiguity as opportunity rather than threat, decide quickly on incomplete information, and course-correct in motion. You're most valuable when the path hasn't been defined yet — and you're the one who defines it.",
    color: "#ff6d00",
    ideal: { ...BASE, analyticalRatio: 44, cognitiveSpeed: 86, riskTolerance: 86, systemsThinking: 62, autonomyDrive: 76, leadershipMode: 52, adaptability: 86 },
    careers: [
      { title: "Founder / Entrepreneur",  category: "Entrepreneurship", match: 97 },
      { title: "Venture Capitalist",      category: "Finance",          match: 91 },
      { title: "Early-Stage Product Lead",category: "Product",          match: 88 },
      { title: "Head of Innovation",      category: "Strategy",         match: 85 },
      { title: "Growth Lead",             category: "Marketing",        match: 82 },
      { title: "Business Development",    category: "Sales",            match: 79 },
    ],
    environments: ["Early-stage startups", "Innovation labs", "High-velocity teams", "Undefined markets"],
    drains: ["Bureaucratic approval chains", "Slow decision-making cultures", "Overly structured processes", "Optimization of existing things"],
    leadership: "Magnetic and momentum-based. You inspire through energy, conviction, and forward motion. You hire fast, set a direction, and expect people to run. Your biggest leadership risk is moving faster than your team can follow.",
    communication: "High-bandwidth and direct. You compress complex ideas into sharp, compelling narratives. You'd rather communicate too little than too much — and sometimes it shows.",
    thinkingStyle: "Fast and non-linear. You hold multiple hypotheses simultaneously, discard them quickly, and move on without attachment to sunk cost.",
    riskProfile: "Asymmetric risk-seeker. You're not reckless — you're calibrated to upside. When the ceiling is high enough, the floor doesn't bother you.",
  },
  {
    id: "operator",
    name: "The Operator",
    tagline: "You're the reason things actually work.",
    summary: "Your cognitive profile is optimized for excellence, reliability, and precision. You're the person who makes complex systems run without failure — who finds the flaw in the plan before it ships, who raises the quality bar and holds it there. Your value compounds over time because trust you've built doesn't depreciate.",
    color: "#00e676",
    ideal: { ...BASE, analyticalRatio: 80, cognitiveSpeed: 44, riskTolerance: 20, systemsThinking: 44, autonomyDrive: 40, leadershipMode: 30, adaptability: 30 },
    careers: [
      { title: "Senior Software Engineer", category: "Technology",  match: 93 },
      { title: "Financial Analyst / FP&A", category: "Finance",     match: 91 },
      { title: "Risk & Compliance Lead",   category: "Finance",     match: 88 },
      { title: "Data Analyst",             category: "Data",        match: 85 },
      { title: "Technical Program Manager",category: "Management",  match: 82 },
      { title: "Operations Specialist",    category: "Operations",  match: 79 },
    ],
    environments: ["High-craft engineering cultures", "Regulated industries", "Metrics-driven organizations", "Well-defined scope environments"],
    drains: ["Constant pivots and priority changes", "Ambiguous success criteria", "Political decision-making", "Speed over quality pressure"],
    leadership: "Expertise-based and selective. You lead when your knowledge is directly relevant, and defer when it isn't. Your directness and precision create clear accountability in teams you work with.",
    communication: "Exact and evidence-based. You say what you mean, mean what you say, and document it. You dislike ambiguity in communication as much as in work.",
    thinkingStyle: "Sequential and rigorous. You work through problems methodically, validate assumptions before building on them, and rarely skip steps.",
    riskProfile: "Risk-averse by temperament. You don't avoid all risk — you price it carefully and minimize the downside before the upside matters.",
  },
  {
    id: "catalyst",
    name: "The Catalyst",
    tagline: "You make everyone around you better.",
    summary: "Your cognitive profile is oriented around people, systems, and the intersection between them. You understand that sustainable performance comes through others — and you build the conditions for it. You spot what's blocking a team, fix the root cause, and step back. You multiply, not add.",
    color: "#c084fc",
    ideal: { ...BASE, analyticalRatio: 50, cognitiveSpeed: 64, riskTolerance: 55, systemsThinking: 66, autonomyDrive: 28, leadershipMode: 86, adaptability: 76 },
    careers: [
      { title: "People / Culture Lead",    category: "HR",          match: 95 },
      { title: "Sales Leadership",         category: "Sales",       match: 90 },
      { title: "Executive Coach",          category: "Consulting",  match: 88 },
      { title: "Customer Success Lead",    category: "Operations",  match: 85 },
      { title: "Management Consultant",    category: "Consulting",  match: 82 },
      { title: "Community & Partnerships", category: "Marketing",   match: 79 },
    ],
    environments: ["People-first companies", "High-growth scaling teams", "Culture-driven organizations", "Client-relationship roles"],
    drains: ["Pure solo execution", "No human element in the work", "Toxic or low-trust cultures", "Metrics-only environments with no qualitative signal"],
    leadership: "Deeply facilitative. You unlock other people's best thinking, hold space for difficult conversations, and build the psychological safety that high performance requires. Teams grow under your leadership.",
    communication: "Warm, clear, and highly adaptive. You read your audience instantly and adjust tone, depth, and framing accordingly. You're equally credible in a board room and a 1:1.",
    thinkingStyle: "Relational and integrative. You process the human layer alongside the functional layer — understanding what people need as much as what the problem needs.",
    riskProfile: "Moderate and relationship-calibrated. You're comfortable with uncertainty when the people are strong. You bet on teams more than plans.",
  },
  {
    id: "analyst",
    name: "The Analyst",
    tagline: "You see what others miss — because you look harder.",
    summary: "Your cognitive profile is optimized for depth, precision, and evidence-based truth-seeking. You're the person who actually reads the study, checks the methodology, and finds the caveat in the footnote. In a world of surface-level takes, your rigour is a competitive advantage — when applied in environments that value it.",
    color: "#60a5fa",
    ideal: { ...BASE, analyticalRatio: 90, cognitiveSpeed: 30, riskTolerance: 20, systemsThinking: 56, autonomyDrive: 70, leadershipMode: 34, adaptability: 34 },
    careers: [
      { title: "Data Scientist",           category: "Data",        match: 95 },
      { title: "Research Scientist",       category: "Research",    match: 93 },
      { title: "Quantitative Analyst",     category: "Finance",     match: 90 },
      { title: "Policy Analyst",           category: "Government",  match: 86 },
      { title: "Business Intelligence",    category: "Data",        match: 83 },
      { title: "Clinical Research",        category: "Healthcare",  match: 80 },
    ],
    environments: ["Research-led organizations", "Data-rich environments", "Long-feedback-loop roles", "Truth-seeking cultures"],
    drains: ["Move-fast-break-things cultures", "Decisions made without evidence", "Surface-level analysis pressures", "Constant interruptions and context switches"],
    leadership: "Intellectual and expert-driven. You lead through the authority of rigour — people follow your analysis because you've never been caught cutting corners. You're not a natural people manager, but you're an exceptional technical mentor.",
    communication: "Precise, referenced, and measured. You don't speculate. You distinguish between what you know and what you think — and you expect the same from others. Can come across as overly cautious in high-speed environments.",
    thinkingStyle: "Exhaustive and methodical. You'd rather take twice as long and be right. You find errors in reasoning that others don't see.",
    riskProfile: "Low risk tolerance, high evidence threshold. You don't take a position until you've stress-tested it. This is a strength disguised as a bottleneck.",
  },
  {
    id: "visionary",
    name: "The Visionary",
    tagline: "You see 10 years out when others see 10 weeks.",
    summary: "Your cognitive profile is oriented toward pattern synthesis, long-range thinking, and abstract problem-solving. You connect dots across domains that others treat as separate. Your value is highest in early-stage ideation, strategic positioning, and situations where the question itself needs to be redefined before the answer can be found.",
    color: "#f472b6",
    ideal: { ...BASE, analyticalRatio: 54, cognitiveSpeed: 70, riskTolerance: 76, systemsThinking: 90, autonomyDrive: 72, leadershipMode: 54, adaptability: 80 },
    careers: [
      { title: "Chief Strategy Officer",   category: "Leadership",   match: 95 },
      { title: "Creative Director",        category: "Creative",     match: 91 },
      { title: "Product Vision Lead",      category: "Product",      match: 88 },
      { title: "Thought Leadership / IP",  category: "Consulting",   match: 85 },
      { title: "Venture Partner",          category: "Finance",      match: 82 },
      { title: "Innovation Strategist",    category: "Strategy",     match: 79 },
    ],
    environments: ["Vision-driven companies", "Long-horizon problems", "High creative autonomy", "Founder-mode organizations"],
    drains: ["Pure execution roles", "Optimization without innovation", "Short-term metric obsession", "Environments that resist change"],
    leadership: "Narrative and conviction-based. You inspire through clarity of vision and force of idea. Your best leadership happens when you have someone strong translating your vision into operations.",
    communication: "Conceptual and evocative. You speak in frameworks and futures. Your communication works brilliantly for rallying people to a direction, and needs translation partners for execution detail.",
    thinkingStyle: "Non-linear and synthetic. You build frameworks, not just answers. You see systems when others see events.",
    riskProfile: "Asymmetric and vision-anchored. High risk tolerance when the outcome is transformative. You find it hard to justify low-upside safety.",
  },
  {
    id: "connector",
    name: "The Connector",
    tagline: "You make people and ideas find each other.",
    summary: "Your cognitive profile is built for relationship density, trust-building, and network effects. You naturally create bridges — between people, between teams, between ideas that didn't know they needed each other. In high-trust roles, your value is nearly impossible to quantify — which is why it tends to be underestimated and under-compensated until it's gone.",
    color: "#2dd4bf",
    ideal: { ...BASE, analyticalRatio: 38, cognitiveSpeed: 70, riskTolerance: 50, systemsThinking: 56, autonomyDrive: 20, leadershipMode: 80, adaptability: 70 },
    careers: [
      { title: "Business Development",    category: "Sales",        match: 95 },
      { title: "Partnerships Lead",       category: "Operations",   match: 92 },
      { title: "Account Executive",       category: "Sales",        match: 88 },
      { title: "Recruiter / Talent Lead", category: "HR",           match: 85 },
      { title: "Marketing / PR Lead",     category: "Marketing",    match: 82 },
      { title: "Community Manager",       category: "Marketing",    match: 79 },
    ],
    environments: ["Relationship-driven industries", "Network-effect businesses", "Client-facing roles", "High trust cultures"],
    drains: ["Purely solitary work", "Low-trust or political environments", "Heavy data analysis without people context", "Isolated individual contributor roles"],
    leadership: "Facilitative and trust-centered. You lead by connecting people to each other and to resources. You build loyalty through attention, consistency, and genuine investment in others.",
    communication: "Natural and highly adaptive. You're as comfortable closing a deal as you are holding space in a difficult conversation. People feel heard and energized after interactions with you.",
    thinkingStyle: "Relational and associative. You think in people and networks — who knows what, who should meet whom, what relationship unlocks what.",
    riskProfile: "Relationship-calibrated risk. You're comfortable with ambiguity when you trust the people involved. You're cautious when trust hasn't been established.",
  },
];

// ── Scoring engine ────────────────────────────────────────────────────────────

const DIMS: DimKey[] = [
  "analyticalRatio", "cognitiveSpeed", "riskTolerance",
  "systemsThinking", "autonomyDrive",  "leadershipMode", "adaptability",
];

export function createBlankDimensions(): Dimensions {
  return Object.fromEntries(DIMS.map((k) => [k, 50])) as Dimensions;
}

function applyDeltas(dims: Dimensions, deltas: DimDeltas): void {
  (Object.entries(deltas) as [DimKey, number][]).forEach(([k, v]) => {
    dims[k] = Math.max(0, Math.min(100, dims[k] + v));
  });
}

// Rankings: positions 1,2,3,4 → multipliers 20,10,0,-10
const RANK_MULTIPLIERS = [20, 10, 0, -10];

// Allocations: (pct/100) * scale applied to each delta
function allocationDeltas(category: AllocCategory, pct: number): DimDeltas {
  const out: DimDeltas = {};
  (Object.entries(category.deltas) as [DimKey, number][]).forEach(([k, weight]) => {
    out[k] = (pct / 100) * category.scale * weight;
  });
  return out;
}

export interface AnswerRecord {
  type:     Question["type"];
  qId:      string;
  value:    unknown;
  responseMs?: number; // for speed questions
}

export function computeDimensions(answers: AnswerRecord[]): Dimensions {
  const dims = createBlankDimensions();

  answers.forEach(({ type, qId, value, responseMs }) => {
    // ── Speed binary ──────────────────────────────────────────────────────────
    if (type === "speed") {
      const q = SPEED_QUESTIONS.find((q) => q.id === qId);
      if (!q) return;
      const optIdx = value as 0 | 1;
      if (optIdx === 0 || optIdx === 1) {
        applyDeltas(dims, q.options[optIdx].deltas);
      }
      // Speed bonus/penalty based on response time
      const limit = q.timeLimit;
      const ms    = responseMs ?? limit;
      const ratio = ms / limit; // 0 = instant, 1 = at limit
      const speedDelta = (1 - ratio) * 12 - 4; // fast answers push speed up
      dims.cognitiveSpeed = Math.max(0, Math.min(100, dims.cognitiveSpeed + speedDelta));
    }

    // ── Scenario ──────────────────────────────────────────────────────────────
    if (type === "scenario") {
      const q = SCENARIO_QUESTIONS.find((q) => q.id === qId);
      if (!q) return;
      const optIdx = value as number;
      if (optIdx >= 0 && optIdx < q.options.length) {
        applyDeltas(dims, q.options[optIdx].deltas);
      }
    }

    // ── Ranking ───────────────────────────────────────────────────────────────
    if (type === "ranking") {
      const q = RANKING_QUESTIONS.find((q) => q.id === qId);
      if (!q) return;
      const ranked = value as string[]; // item ids in rank order (index 0 = rank 1)
      ranked.forEach((itemId, rankIdx) => {
        const item = q.items.find((i) => i.id === itemId);
        if (!item) return;
        const mult = RANK_MULTIPLIERS[rankIdx] ?? 0;
        const scaled: DimDeltas = {};
        (Object.entries(item.deltas) as [DimKey, number][]).forEach(([k, w]) => {
          scaled[k] = w * mult;
        });
        applyDeltas(dims, scaled);
      });
    }

    // ── Tradeoff ──────────────────────────────────────────────────────────────
    if (type === "tradeoff") {
      const q = TRADEOFF_QUESTIONS.find((q) => q.id === qId);
      if (!q) return;
      const opt = value as "A" | "B";
      applyDeltas(dims, opt === "A" ? q.optionA.deltas : q.optionB.deltas);
    }

    // ── Allocation ────────────────────────────────────────────────────────────
    if (type === "allocation") {
      const q = ALLOCATION_QUESTIONS.find((q) => q.id === qId);
      if (!q) return;
      const alloc = value as Record<string, number>; // catId → pct
      q.categories.forEach((cat) => {
        const pct = alloc[cat.id] ?? 0;
        applyDeltas(dims, allocationDeltas(cat, pct));
      });
    }
  });

  return dims;
}

export interface ArchetypeResult {
  archetype: Archetype;
  match:     number; // 0-100 similarity
}

export function matchArchetypes(dims: Dimensions): ArchetypeResult[] {
  const results: ArchetypeResult[] = ARCHETYPES.map((arch) => {
    let sumSq = 0;
    DIMS.forEach((k) => {
      sumSq += Math.pow(dims[k] - arch.ideal[k], 2);
    });
    const dist  = Math.sqrt(sumSq);
    const maxDist = Math.sqrt(DIMS.length * 100 * 100); // ≈ 264.6
    const match = Math.round((1 - dist / maxDist) * 100);
    return { archetype: arch, match };
  });
  return results.sort((a, b) => b.match - a.match);
}

// "Clarity" = how distinctly one archetype dominated.
// High clarity → decisive, consistent answers → higher score.
export function clarityScore(results: ArchetypeResult[]): number {
  if (results.length < 2) return results[0]?.match ?? 50;
  const top    = results[0].match;
  const second = results[1].match;
  const gap    = top - second; // 0-30 typical range
  // Blend the top match % with the gap to reward decisive profiles
  return Math.min(100, Math.round(top * 0.6 + gap * 1.4));
}
