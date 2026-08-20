"use client";

import { useState } from "react";
import { KandinskyField } from "@/components/KandinskyField";

export function IntroGate({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return (
      <button
        type="button"
        onClick={() => setEntered(true)}
        className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[var(--bg)] px-6 text-center"
      >
        <KandinskyField />
        <div className="grain" />
        <div className="relative z-10">
          <p className="text-[11px] tracking-[0.32em] text-[var(--muted)] uppercase">
            filmpalette.art
          </p>
          <h1 className="display mt-4 text-5xl leading-none sm:text-8xl">公版色库</h1>
          <p className="mt-8 text-sm tracking-[0.24em] text-[var(--acid)]">点击进入</p>
        </div>
      </button>
    );
  }

  return <>{children}</>;
}
