"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export default function HeroSection({ children }: { children: ReactNode }) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLElement>) {
    // Walk up from the click target — if we hit an <a> or <button>, let it handle itself
    let el = e.target as HTMLElement | null;
    while (el && el !== e.currentTarget) {
      if (el.tagName === "A" || el.tagName === "BUTTON") return;
      el = el.parentElement;
    }
    router.push("/predict");
  }

  return (
    <section
      className="relative overflow-hidden hud-grid cursor-pointer"
      onClick={handleClick}
    >
      {children}
    </section>
  );
}
