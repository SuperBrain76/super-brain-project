import type { MathQuestion } from "@/types";

let _counter = 0;
function uid() {
  return `mq_${Date.now()}_${_counter++}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate a single math question at the given difficulty level (1–5) */
export function generateMathQuestion(difficulty: number): MathQuestion {
  const d = Math.max(1, Math.min(5, difficulty));

  let display = "";
  let answer = 0;

  switch (d) {
    case 1: {
      const a = randInt(1, 15);
      const b = randInt(1, 15);
      const op = Math.random() < 0.5 ? "+" : "-";
      answer = op === "+" ? a + b : a - b;
      display = `${a} ${op} ${b}`;
      break;
    }
    case 2: {
      const ops = ["+", "-"];
      const op = ops[Math.floor(Math.random() * ops.length)];
      const a = randInt(10, 60);
      const b = randInt(10, 60);
      answer = op === "+" ? a + b : a - b;
      display = `${a} ${op} ${b}`;
      break;
    }
    case 3: {
      const type = randInt(1, 3);
      if (type === 1) {
        // Multiplication 2×2 digit small
        const a = randInt(2, 12);
        const b = randInt(2, 12);
        answer = a * b;
        display = `${a} × ${b}`;
      } else if (type === 2) {
        // 3-digit + 2-digit
        const a = randInt(100, 500);
        const b = randInt(10, 99);
        answer = a + b;
        display = `${a} + ${b}`;
      } else {
        // Simple division (exact)
        const b = randInt(2, 12);
        const a = b * randInt(2, 15);
        answer = a / b;
        display = `${a} ÷ ${b}`;
      }
      break;
    }
    case 4: {
      const type = randInt(1, 3);
      if (type === 1) {
        // 2-digit × 1-digit larger
        const a = randInt(12, 25);
        const b = randInt(3, 9);
        answer = a * b;
        display = `${a} × ${b}`;
      } else if (type === 2) {
        // 3-digit + 3-digit
        const a = randInt(100, 700);
        const b = randInt(100, 700);
        answer = a + b;
        display = `${a} + ${b}`;
      } else {
        // (a + b) × c
        const a = randInt(5, 15);
        const b = randInt(5, 15);
        const c = randInt(2, 8);
        answer = (a + b) * c;
        display = `(${a} + ${b}) × ${c}`;
      }
      break;
    }
    case 5: {
      const type = randInt(1, 3);
      if (type === 1) {
        // 2-digit × 2-digit
        const a = randInt(11, 25);
        const b = randInt(11, 25);
        answer = a * b;
        display = `${a} × ${b}`;
      } else if (type === 2) {
        // 4-digit - 3-digit
        const b = randInt(100, 900);
        const a = randInt(1000, 3000);
        answer = a - b;
        display = `${a} - ${b}`;
      } else {
        // √n (perfect squares up to 225)
        const roots = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225];
        const n = roots[Math.floor(Math.random() * roots.length)];
        answer = Math.sqrt(n);
        display = `√${n}`;
      }
      break;
    }
  }

  return { id: uid(), display, answer, difficulty: d };
}
