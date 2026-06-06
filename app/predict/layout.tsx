import type { ReactNode } from "react";

/**
 * Predictor shell layout.
 * Wraps every /predict route in the light-mode `.predict-shell` class,
 * giving the Predictor section a visually distinct feel from Brain Tests.
 */
export default function PredictLayout({ children }: { children: ReactNode }) {
  return (
    <div className="predict-shell flex-1 flex flex-col min-h-full">
      {children}
    </div>
  );
}
