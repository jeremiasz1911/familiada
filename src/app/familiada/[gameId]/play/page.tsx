"use client";

import { useMemo } from "react";
import { useCollection, useDoc } from "@/lib/familiada/hooks";
import {
  addStrike,
  awardPoints,
  clearReveals,
  liveStateRef,
  questionsQuery,
  roundsQuery,
  setCurrentQuestion,
  startTimer,
  stopTimer,
  teamsQuery,
  toggleReveal,
} from "@/lib/familiada/service";
import type { LiveStateDoc, QuestionDoc, RoundDoc, TeamDoc } from "@/lib/familiada/types";
import { AnswerBoard } from "@/components/familiada/AnswerBoard";
import { Timer } from "@/components/familiada/Timer";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export default function PlayPage({ params }: { params: { gameId: string } }) {
  const { gameId } = params;

  const { data: live } = useDoc<LiveStateDoc>(liveStateRef(gameId));

  const rq = useMemo(() => roundsQuery(gameId), [gameId]);
  const { data: rounds } = useCollection<RoundDoc>(rq);

  const tq = useMemo(() => teamsQuery(gameId), [gameId]);
  const { data: teams } = useCollection<TeamDoc>(tq);

  const currentRound = rounds.find((r) => r.id === live?.currentRoundId) ?? null;

  const qq = useMemo(() => (live?.currentRoundId ? questionsQuery(gameId, live.currentRoundId) : null), [gameId, live?.currentRoundId]);
  const { data: questions } = useCollection<QuestionDoc>(qq as any);

  const currentQuestion =
    live?.currentRoundId && live?.currentQuestionId
      ? useDoc<QuestionDoc>(doc(db, "familiadaGames", gameId, "rounds", live.currentRoundId, "questions", live.currentQuestionId)).data
      : null;

  const revealed = live?.revealedIdx ?? [];
  const multiplier = currentRound?.multiplier ?? 1;

  const bank =
    (currentQuestion?.answers ?? [])
      .map((a, idx) => (revealed.includes(idx) ? a.points : 0))
      .reduce((a, b) => a + b, 0) * multiplier;

  const startedAtMs =
    live?.timer?.startedAt?.toMillis ? live.timer.startedAt.toMillis() : null;

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-black">Prowadzący</h1>

      <div className="mt-4 grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4 bg-white/5 md:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm opacity-70">Aktualne pytanie</div>
              <div className="text-2xl font-black">{currentQuestion?.text ?? "—"}</div>
              <div className="opacity-70 mt-1">Mnożnik rundy: x{multiplier}</div>
            </div>

            <div className="text-right">
              <div className="text-sm opacity-70">Czas</div>
              <Timer running={!!live?.timer?.running} startedAtMs={startedAtMs} durationSec={live?.timer?.durationSec ?? 20} />
            </div>
          </div>

          <div className="mt-4">
            {currentQuestion ? (
              <AnswerBoard
                answers={currentQuestion.answers}
                revealedIdx={revealed}
                onToggle={(idx) => toggleReveal(gameId, idx)}
              />
            ) : (
              <div className="opacity-70">Wybierz rundę i pytanie po prawej.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border p-4 bg-white/5">
          <div className="font-bold">Sterowanie</div>

          <div className="mt-3 grid gap-2">
            <div className="text-sm opacity-70">Wybierz rundę</div>
            <div className="grid gap-2">
              {rounds.map((r) => (
                <button
                  key={r.id}
                  className={`rounded-xl border p-2 text-left ${live?.currentRoundId === r.id ? "bg-white text-black" : ""}`}
                  onClick={() => {
                    // ustaw rundę + pierwsze pytanie (jeśli istnieje)
                    const firstQ = questions[0];
                    if (firstQ) setCurrentQuestion(gameId, r.id, firstQ.id);
                  }}
                >
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs opacity-70">x{r.multiplier}</div>
                </button>
              ))}
            </div>

            <div className="text-sm opacity-70 mt-2">Wybierz pytanie</div>
            <div className="grid gap-2 max-h-56 overflow-auto pr-1">
              {questions.map((q) => (
                <button
                  key={q.id}
                  className={`rounded-xl border p-2 text-left ${live?.currentQuestionId === q.id ? "bg-white text-black" : ""}`}
                  onClick={() => live?.currentRoundId && setCurrentQuestion(gameId, live.currentRoundId, q.id)}
                >
                  {q.text}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button className="rounded-xl border px-3 py-2" onClick={() => startTimer(gameId, currentQuestion?.timeLimitSec ?? 20)}>
                Start
              </button>
              <button className="rounded-xl border px-3 py-2" onClick={() => stopTimer(gameId)}>
                Stop
              </button>
              <button className="rounded-xl border px-3 py-2" onClick={() => clearReveals(gameId)}>
                Reset
              </button>
            </div>

            <div className="mt-3">
              <div className="text-sm opacity-70">Bank (już z mnożnikiem)</div>
              <div className="text-3xl font-black">{bank}</div>
            </div>

            <div className="mt-3 grid gap-2">
              {teams.map((t) => (
                <div key={t.id} className="rounded-xl border p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{t.name}</div>
                    <div className="font-black tabular-nums">{t.score}</div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-xl bg-white text-black px-3 py-2 font-semibold"
                      onClick={async () => {
                        await awardPoints(gameId, t.id, bank);
                        await clearReveals(gameId);
                      }}
                    >
                      Przyznaj bank
                    </button>
                    <button className="rounded-xl border px-3 py-2" onClick={() => addStrike(gameId, t.id)}>
                      X (błąd)
                    </button>
                  </div>
                  <div className="text-xs opacity-70 mt-1">Błędy: {live?.strikesByTeam?.[t.id] ?? 0}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <a className="rounded-xl px-4 py-3 font-semibold border" href={`/familiada/${gameId}/screen`} target="_blank">
          Otwórz ekran TV →
        </a>
      </div>
    </main>
  );
}