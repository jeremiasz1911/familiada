"use client";

import { useMemo } from "react";
import { useCollection, useDoc } from "@/lib/familiada/hooks";
import { liveStateRef, roundsQuery, teamsQuery } from "@/lib/familiada/service";
import type { LiveStateDoc, RoundDoc, TeamDoc, QuestionDoc } from "@/lib/familiada/types";
import { AnswerBoard } from "@/components/familiada/AnswerBoard";
import { Timer } from "@/components/familiada/Timer";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function ScreenPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;

  const { data: live } = useDoc<LiveStateDoc>(liveStateRef(gameId));

  const rq = useMemo(() => roundsQuery(gameId), [gameId]);
  const { data: rounds } = useCollection<RoundDoc>(rq);

  const tq = useMemo(() => teamsQuery(gameId), [gameId]);
  const { data: teams } = useCollection<TeamDoc>(tq);

  const currentRound = rounds.find((r) => r.id === live?.currentRoundId) ?? null;

  const currentQuestion =
    live?.currentRoundId && live?.currentQuestionId
      ? useDoc<QuestionDoc>(
          doc(db, "familiadaGames", gameId, "rounds", live.currentRoundId, "questions", live.currentQuestionId)
        ).data
      : null;

  const startedAtMs =
    live?.timer?.startedAt?.toMillis ? live.timer.startedAt.toMillis() : null;

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-sm opacity-70">Runda</div>
          <div className="text-4xl font-black">{currentRound?.title ?? "—"}</div>
          <div className="opacity-70 mt-1">Mnożnik: x{currentRound?.multiplier ?? 1}</div>
          <div className="text-2xl font-semibold mt-4">{currentQuestion?.text ?? "—"}</div>
        </div>

        <div className="text-right">
          <div className="text-sm opacity-70">Czas</div>
          <Timer running={!!live?.timer?.running} startedAtMs={startedAtMs} durationSec={live?.timer?.durationSec ?? 20} />
        </div>
      </div>

      <div className="mt-8">
        {currentQuestion ? (
          <AnswerBoard answers={currentQuestion.answers} revealedIdx={live?.revealedIdx ?? []} readonly />
        ) : (
          <div className="opacity-70">Czekam na wybrane pytanie…</div>
        )}
      </div>

      <div className="mt-10 grid md:grid-cols-2 gap-4">
        {teams
          .slice()
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .map((t) => (
            <div key={t.id} className="rounded-2xl border p-5 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-black">{t.name}</div>
                <div className="text-4xl font-black tabular-nums">{t.score}</div>
              </div>
              <div className="opacity-70 text-sm mt-1">{t.members.join(", ")}</div>
              <div className="opacity-70 text-sm mt-1">Błędy: {live?.strikesByTeam?.[t.id] ?? 0}</div>
            </div>
          ))}
      </div>
    </main>
  );
}