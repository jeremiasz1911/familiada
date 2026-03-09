"use client";

export function RevealPad({
  count,
  revealedIdx,
  onPress,
}: {
  count: number;
  revealedIdx: number[];
  onPress: (idx: number) => void;
}) {
  const n = Math.max(0, Math.min(12, count)); // max 12 przycisków na MVP
  return (
    <div className="grid grid-cols-6 gap-2">
      {Array.from({ length: n }).map((_, i) => {
        const on = revealedIdx.includes(i);
        return (
          <button
            key={i}
            className={[
              "h-12 rounded-2xl border font-black text-lg transition active:scale-[0.98]",
              on
                ? "bg-amber-200 text-black border-amber-200 shadow-[0_0_24px_rgba(255,210,80,0.20)]"
                : "bg-white/5 border-white/10 hover:bg-white/10",
            ].join(" ")}
            onClick={() => onPress(i)}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}