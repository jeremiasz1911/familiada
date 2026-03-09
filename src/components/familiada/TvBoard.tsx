"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Answer } from "@/lib/familiada/types";

function LedBG() {
  return (
    <div
      className="absolute inset-0 opacity-35 pointer-events-none"
      style={{
        backgroundImage:
          "radial-gradient(rgba(0,0,0,0.55) 1px, transparent 1px)",
        backgroundSize: "10px 10px",
      }}
    />
  );
}

export function TvBoard({
  answers,
  revealedIdx,
}: {
  answers: Answer[];
  revealedIdx: number[];
}) {
  return (
    <div className="relative rounded-[28px] border border-white/10 bg-black/60 overflow-hidden">
      <LedBG />

      {/* “ramka” jak w teleturnieju */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 rounded-[28px] ring-1 ring-white/10" />
        <div className="absolute inset-0 rounded-[28px] shadow-[0_0_60px_rgba(255,210,80,0.10)]" />
      </div>

      <div className="relative p-5 md:p-7">
        <div className="grid grid-cols-1 gap-2">
          {answers.map((a, idx) => {
            const revealed = revealedIdx.includes(idx);

            return (
              <div
                key={idx}
                className="group relative rounded-2xl border border-white/10 bg-black/40 px-4 py-3 md:px-5 md:py-4"
              >
                <div className="flex items-center gap-4">
                  {/* numer */}
                  <div className="w-10 md:w-12 text-center text-lg md:text-2xl font-black text-amber-200/90 tabular-nums">
                    {idx + 1}
                  </div>

                  {/* tekst + punkty */}
                  <div className="flex-1">
                    <AnimatePresence mode="wait">
                      {revealed ? (
                        <motion.div
                          key="rev"
                          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="text-amber-200 text-lg md:text-2xl font-black tracking-wide">
                            {a.text}
                          </div>
                          <div className="text-amber-200 text-lg md:text-2xl font-black tabular-nums">
                            {a.points}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="hid"
                          initial={{ opacity: 0.7 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0.7 }}
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="text-amber-200/40 text-lg md:text-2xl font-black tracking-widest">
                            ▓▓▓▓▓▓▓▓▓▓▓▓▓▓
                          </div>
                          <div className="text-amber-200/25 text-lg md:text-2xl font-black tabular-nums">
                            —
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* “ikonki” po prawej jak w Familiadzie (symbolicznie) */}
                  <div className="w-10 md:w-14 flex justify-end">
                    <div className="h-6 w-6 md:h-8 md:w-8 rounded-full border border-amber-200/30 bg-amber-200/10" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}