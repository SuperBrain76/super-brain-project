// Web Audio API sound engine — no external files, all generated
// All functions are no-ops when called server-side (no AudioContext)

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_ctx) _ctx = new AudioContext();
    // Resume if suspended (iOS requirement after user gesture)
    if (_ctx.state === "suspended") _ctx.resume();
    return _ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  vol = 0.18,
  attack = 0.005,
) {
  const c = ctx();
  if (!c) return;
  try {
    const osc  = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration + 0.01);
  } catch { /* ignore */ }
}

export const Sounds = {
  /** Correct action — bright tap */
  hit() { tone(900, 0.07, "sine", 0.14); },

  /** Miss / wrong — low thud */
  miss() { tone(110, 0.15, "square", 0.09); },

  /** Streak milestone — ascending pair */
  streak() {
    tone(660, 0.08, "sine", 0.13);
    setTimeout(() => tone(880, 0.1, "sine", 0.13), 70);
  },

  /** Max streak — triple chime */
  streakMax() {
    tone(660, 0.08, "sine", 0.12);
    setTimeout(() => tone(880, 0.08, "sine", 0.12), 70);
    setTimeout(() => tone(1100, 0.15, "sine", 0.14), 140);
  },

  /** Phase start whoosh */
  phaseStart() {
    tone(220, 0.25, "sine", 0.08);
    setTimeout(() => tone(330, 0.2, "sine", 0.06), 100);
    setTimeout(() => tone(440, 0.15, "sine", 0.05), 200);
  },

  /** Phase complete — satisfying chord */
  phaseComplete() {
    [440, 554, 659].forEach((f, i) => setTimeout(() => tone(f, 0.35, "sine", 0.1), i * 90));
  },

  /** Distraction burst — jarring noise */
  distract() {
    tone(180 + Math.random() * 160, 0.18, "sawtooth", 0.07);
  },

  /** Interruption alert */
  alert() {
    tone(880, 0.06, "square", 0.1);
    setTimeout(() => tone(660, 0.08, "square", 0.09), 80);
  },

  /** Countdown tick */
  tick() { tone(440, 0.04, "sine", 0.08); },

  /** Task expired / critical miss */
  critical() {
    tone(120, 0.2, "square", 0.12);
    setTimeout(() => tone(90, 0.2, "square", 0.1), 150);
  },
};
