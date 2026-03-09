"use client";

import type { Answer } from "@/lib/familiada/types";

export function AnswerControlList({
  answers,
  revealedIdx,
  onToggle,
}: {
  answers: Answer[];
  revealedIdx: number[];
  onToggle: (idx: number, willReveal: boolean) => void;
}) {
  return (
    <div className="grid gap-2">
      {answers.map((a, idx) => {
        const revealed = revealedIdx.includes(idx);

        return (
          <button
            key={idx}
            type="button"
            onClick={() => onToggle(idx, !revealed)}
            className={[
              "w-full rounded-2xl border p-4 text-left transition active:scale-[0.99]",
              revealed
                ? "border-amber-200/40 bg-amber-200/10 shadow-[0_0_30px_rgba(255,210,80,0.10)]"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div
                className={[
                  "h-10 w-10 rounded-xl grid place-items-center font-black text-lg tabular-nums",
                  revealed ? "bg-amber-200 text-black" : "bg-black/30 text-white/70 border border-white/10",
                ].join(" ")}
              >
                {idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-base md:text-lg font-black truncate">
                  {a.text}
                </div>
                <div className="text-xs opacity-70">
                  {revealed ? "ODKRYTE" : "UKRYTE"} • tap aby {revealed ? "ukryć" : "odkryć"}
                </div>
              </div>

              <div className="text-2xl font-black tabular-nums text-amber-200">
                {a.points}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}