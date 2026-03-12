"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Doto } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useCollection, useDoc } from "@/lib/familiada/hooks";
import { finalPlayersQuery, finalQuestionsQuery } from "@/lib/familiada/final.service";
import type { FinalPlayerDoc, FinalQuestionDoc, LiveStateDoc } from "@/lib/familiada/types";

import { liveStateRef } from "@/lib/familiada/service";
import { finalFlowRef, FinalFlowDoc } from "@/lib/familiada/finalFlow.service";

const pixel = Doto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});

export default function FinalScreenPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  
  const router = useRouter();
  const { data: live } = useDoc<LiveStateDoc>(useMemo(() => liveStateRef(gameId), [gameId]));
  const { data: flow } = useDoc<FinalFlowDoc>(useMemo(() => finalFlowRef(gameId), [gameId]));

  const { data: playersAll } = useCollection<FinalPlayerDoc>(useMemo(() => finalPlayersQuery(gameId), [gameId]));
  const { data: questionsAll } = useCollection<FinalQuestionDoc>(useMemo(() => finalQuestionsQuery(gameId), [gameId]));

  const players = playersAll.slice(0, 2);
  const questions = questionsAll.slice(0, 5);

  const p1 = players[0]?.name ?? "Gracz 1";
  const p2 = players[1]?.name ?? "Gracz 2";

  const revealRow = flow?.revealRow ?? 0;
  const phase = flow?.phase ?? "idle";
  const target = flow?.targetScore ?? 200;

  const total = flow?.sums?.revealedTotal ?? 0;
  const p1Sum = flow?.sums?.revealedP1 ?? 0;
  const p2Sum = flow?.sums?.revealedP2 ?? 0;
  
  useEffect(() => {
    if (!live) return;
    if (live.final?.enabled === false) {
      router.replace(`/familiada/${gameId}/screen`);
    }
  }, [live?.final?.enabled, router, gameId]);
  return (
    <main className={["min-h-screen bg-black text-white", pixel.className].join(" ")}>
      <div className="max-w-7xl mx-auto p-6 md:p-10">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-xs opacity-70 tracking-widest">FINAŁ</div>
            <div className="text-3xl md:text-5xl font-black tracking-widest text-amber-200 truncate">
              {p1.toUpperCase()} VS {p2.toUpperCase()}
            </div>
            <div className="mt-1 text-xs opacity-60">
              {live?.final?.enabled ? "LIVE" : "OFF"} • phase: {phase}
            </div>
          </div>

          <div className="rounded-3xl border border-amber-200/25 bg-amber-200/10 px-6 py-4 shadow-[0_0_80px_rgba(255,210,80,0.10)]">
            <div className="text-[10px] opacity-70 tracking-widest">SUMA</div>
            <div className="text-4xl md:text-6xl font-black tabular-nums text-amber-200">{total}</div>
            <div className="text-[10px] opacity-60 mt-1">CEL: {target}</div>
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <ScoreCard name={p1} score={p1Sum} />
          <ScoreCard name={p2} score={p2Sum} />
        </div>

        <div className="mt-6 rounded-[32px] border border-amber-200/20 bg-gradient-to-b from-black to-black/80 p-5 shadow-[0_0_140px_rgba(255,210,80,0.08)]">
          <div className="text-amber-200 font-black tracking-widest text-sm">TABLICA FINAŁU</div>

          <div className="mt-4 grid gap-3">
            {questions.map((q, i) => {
              const show = i < revealRow;

              const p1Text = flow?.inputs?.p1?.[i] ?? "";
              const p2Text = flow?.inputs?.p2?.[i] ?? "";

              const p1Pts = flow?.mapPoints?.p1?.[i] ?? 0;
              const p2Pts = flow?.mapPoints?.p2?.[i] ?? 0;

              return (
                <div key={q.id} className="grid grid-cols-[72px_1fr_1fr] gap-3 items-center">
                  <div className="h-14 w-14 md:h-16 md:w-16 rounded-2xl border border-amber-200/25 bg-amber-200/10 grid place-items-center">
                    <div className="text-amber-200 font-black text-2xl md:text-3xl tabular-nums">
                      {i + 1}
                    </div>
                  </div>

                  <FinalCell show={show} text={p1Text} points={p1Pts} />
                  <FinalCell show={show} text={p2Text} points={p2Pts} />
                </div>
              );
            })}
          </div>

          {phase === "done" && (
            <div className="mt-6 text-center">
              <div className="text-3xl md:text-5xl font-black text-amber-200 tracking-widest">
                {total >= target ? "✅ WYGRALI FINAŁ!" : "❌ NIE UDAŁO SIĘ"}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function ScoreCard({ name, score }: { name: string; score: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs opacity-70 tracking-widest">ZAWODNIK</div>
      <div className="mt-1 text-2xl md:text-3xl font-black truncate">{name.toUpperCase()}</div>
      <div className="mt-3 text-5xl md:text-6xl font-black tabular-nums text-amber-200">{score}</div>
    </div>
  );
}

function FinalCell({ show, text, points }: { show: boolean; text: string; points: number }) {
  return (
    <div className="h-14 md:h-16 rounded-2xl border border-white/10 bg-black/50 px-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-black text-lg md:text-xl truncate">
          {show ? (text ? text.toUpperCase() : "—") : "__________"}
        </div>
      </div>
      <div className="font-black text-amber-200 text-2xl md:text-3xl tabular-nums">
        {show ? points : "••"}
      </div>
    </div>
  );
}