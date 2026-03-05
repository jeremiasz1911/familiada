"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Answer } from "@/lib/familiada/types";

export function AnswerBoard({
  answers,
  revealedIdx,
  onToggle,
  readonly,
}: {
  answers: Answer[];
  revealedIdx: number[];
  onToggle?: (idx: number) => void;
  readonly?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {answers.map((a, idx) => {
        const revealed = revealedIdx.includes(idx);
        return (
          <button
            key={idx}
            type="button"
            disabled={readonly}
            onClick={() => onToggle?.(idx)}
            className="rounded-2xl border bg-white/5 p-4 text-left hover:bg-white/10 transition disabled:opacity-100"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl font-black w-10 text-center">{idx + 1}</div>

              <div className="flex-1">
                <AnimatePresence mode="wait">
                  {revealed ? (
                    <motion.div
                      key="revealed"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center justify-between"
                    >
                      <div className="text-lg font-semibold">{a.text}</div>
                      <div className="text-lg font-black tabular-nums">{a.points}</div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hidden"
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0.6 }}
                      className="flex items-center justify-between"
                    >
                      <div className="text-lg font-semibold opacity-70">••••••••</div>
                      <div className="text-lg font-black opacity-60">—</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}