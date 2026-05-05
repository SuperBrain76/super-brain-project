import type { SpatialQuestion } from "@/types";

/**
 * Shapes defined in a 100×100 viewBox.
 * Every shape is deliberately asymmetric — no rotational symmetry — so all four
 * 90° rotations (0, 90, 180, 270) produce visually distinct images.
 * The original zShape had 180° point-symmetry causing identical-looking options;
 * it has been replaced with stepShape.
 */
export const SHAPE_PATHS: Record<string, string> = {
  arrow:    "M50,8 L72,38 L60,38 L60,92 L40,92 L40,38 L28,38 Z",
  lShape:   "M20,15 L42,15 L42,72 L80,72 L80,90 L20,90 Z",
  tShape:   "M15,15 L85,15 L85,38 L60,38 L60,88 L40,88 L40,38 L15,38 Z",
  fShape:   "M20,12 L82,12 L82,32 L40,32 L40,50 L74,50 L74,68 L40,68 L40,90 L20,90 Z",
  // Staircase — no symmetry axis or rotational symmetry
  stepShape: "M15,65 L15,45 L35,45 L35,28 L55,28 L55,12 L82,12 L82,32 L62,32 L62,48 L42,48 L42,65 Z",
};

// Only use 90° increments so every pair of choices is always visually distinct
const ROTATIONS = [0, 90, 180, 270] as const;

const TARGET_ROTATIONS: { deg: number; label: string }[] = [
  { deg: 90,  label: "90° clockwise" },
  { deg: 180, label: "180°" },
  { deg: 270, label: "90° counter-clockwise" },
];

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateSpatialQuestions(count = 20, seed = 42): SpatialQuestion[] {
  const rand = seededRand(seed);
  const shapeTypes = Object.keys(SHAPE_PATHS) as SpatialQuestion["shapeType"][];
  const questions: SpatialQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const shapeType = shapeTypes[Math.floor(rand() * shapeTypes.length)];
    const referenceRotation = ROTATIONS[Math.floor(rand() * ROTATIONS.length)];
    const targetInfo = TARGET_ROTATIONS[Math.floor(rand() * TARGET_ROTATIONS.length)];
    const correctRotation = (referenceRotation + targetInfo.deg) % 360;

    // All four choices are the four distinct rotations — guaranteed no duplicates
    const allChoices: SpatialQuestion["choices"] = (ROTATIONS as readonly number[]).map((r) => ({
      rotation: r,
      mirrored: false,
    }));

    // Shuffle choices
    for (let j = allChoices.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [allChoices[j], allChoices[k]] = [allChoices[k], allChoices[j]];
    }

    const correctIndex = allChoices.findIndex((c) => c.rotation === correctRotation);

    questions.push({
      id: `sq_${i}`,
      shapeType,
      referenceRotation,
      targetDegrees: targetInfo.deg,
      targetLabel: targetInfo.label,
      choices: allChoices,
      correctIndex,
    });
  }

  return questions;
}
