"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { addQuestion, addRound, questionsQuery, roundsQuery } from "@/lib/familiada/service";
import { useCollection } from "@/lib/familiada/hooks";
import type { Answer, QuestionDoc, RoundDoc } from "@/lib/familiada/types";
import { TeamsEditor } from "@/components/familiada/TeamsEditor";
import { QuestionsEditor } from "@/components/familiada/QuestionsEditor";

export default function BuilderPage(){
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;

  const rq = useMemo(() => roundsQuery(gameId), [gameId]);
  const { data: rounds } = useCollection<RoundDoc>(rq);

  const [roundTitle, setRoundTitle] = useState("Runda 1");
  const [mult, setMult] = useState(1);
  const [type, setType] = useState<"normal" | "final">("normal");
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const qq = useMemo(
    () => (selectedRoundId ? questionsQuery(gameId, selectedRoundId) : null),
    [gameId, selectedRoundId]
  );

  const { data: questions, loading: questionsLoading, error: questionsError } =
    useCollection<QuestionDoc>(qq);
  const [qText, setQText] = useState("");
  const [timeLimit, setTimeLimit] = useState(20);
  const [answers, setAnswers] = useState<Answer[]>([
    { text: "mleko", points: 32 },
    { text: "mięso", points: 27 },
  ]);

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-black pb-5">Builder</h1>
      <TeamsEditor gameId={gameId} />
      <div className="mt-6 grid md:grid-cols-2 gap-6">
        {/* RUNDY */}
        <div className="rounded-2xl border p-4 bg-white/5">
          <h2 className="text-xl font-bold">Rundy</h2>

          <div className="mt-3 grid gap-2">
            {rounds.map((r) => (
              <button
                key={r.id}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedRoundId === r.id ? "bg-white text-black" : "bg-transparent"
                }`}
                onClick={() => setSelectedRoundId(r.id)}
              >
                <div className="font-black">
                  {r.title} <span className="opacity-70">x{r.multiplier}</span>
                </div>
                <div className="text-sm opacity-70">{r.type}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2">
            <input className="rounded-xl border bg-transparent p-3" value={roundTitle} onChange={(e) => setRoundTitle(e.target.value)} />
            <div className="flex gap-2">
              <input
                className="rounded-xl border bg-transparent p-3 w-24"
                type="number"
                min={1}
                max={10}
                value={mult}
                onChange={(e) => setMult(Number(e.target.value))}
              />
              <select className="rounded-xl border bg-transparent p-3 flex-1" value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="normal">normal</option>
                <option value="final">final</option>
              </select>
            </div>
            <button
              className="rounded-xl px-4 py-3 font-semibold bg-white text-black"
              onClick={async () => {
                await addRound(gameId, {
                  index: rounds.length,
                  title: roundTitle || `Runda ${rounds.length + 1}`,
                  multiplier: mult || 1,
                  type,
                });
              }}
            >
              Dodaj rundę
            </button>
          </div>
        </div>

        {/* PYTANIA */}
        <div className="rounded-2xl border p-4 bg-white/5">
          <h2 className="text-xl font-bold">Pytania</h2>
          {!selectedRoundId ? (
            <p className="opacity-70 mt-2">Wybierz rundę po lewej.</p>
          ) : (
            <>
              <div className="mt-3 grid gap-2">
                <input
                  className="rounded-xl border bg-transparent p-3"
                  placeholder='Pytanie, np. "Co mamy w lodówce?"'
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                />
                <input
                  className="rounded-xl border bg-transparent p-3 w-40"
                  type="number"
                  min={5}
                  max={120}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                />

                <div className="mt-2 grid gap-2">
                  {answers.map((a, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        className="rounded-xl border bg-transparent p-3 flex-1"
                        value={a.text}
                        onChange={(e) => {
                          const next = [...answers];
                          next[idx] = { ...next[idx], text: e.target.value };
                          setAnswers(next);
                        }}
                      />
                      <input
                        className="rounded-xl border bg-transparent p-3 w-28"
                        type="number"
                        value={a.points}
                        onChange={(e) => {
                          const next = [...answers];
                          next[idx] = { ...next[idx], points: Number(e.target.value) };
                          setAnswers(next);
                        }}
                      />
                      <button
                        className="rounded-xl border px-3"
                        onClick={() => setAnswers(answers.filter((_, i) => i !== idx))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button className="rounded-xl border px-4 py-3" onClick={() => setAnswers([...answers, { text: "", points: 0 }])}>
                    + Dodaj odpowiedź
                  </button>
                </div>
                  <QuestionsEditor gameId={gameId} />
                <button
                  className="rounded-xl px-4 py-3 font-semibold bg-white text-black disabled:opacity-60"
                  disabled={!qText.trim()}
                  onClick={async () => {
                    await addQuestion(gameId, selectedRoundId, {
                      index: questions.length,
                      text: qText.trim(),
                      timeLimitSec: timeLimit,
                      answers: answers.filter((a) => a.text.trim()),
                    });
                    setQText("");
                  }}
                >
                  Zapisz pytanie
                </button>
              </div>

              <div className="mt-5">
                <div className="font-bold">Lista pytań</div>
                <div className="mt-2 grid gap-2">
                  {questions.map((q) => (
                    <div key={q.id} className="rounded-xl border p-3">
                      <div className="font-semibold">{q.text}</div>
                      <div className="text-sm opacity-70">
                        {q.answers.map((a) => `${a.text} (${a.points})`).join(" • ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
          
      <div className="mt-8 flex gap-3">
        <a className="rounded-xl px-4 py-3 font-semibold border" href={`/familiada/${gameId}/play`}>
          Tryb prowadzącego →
        </a>
        <a className="rounded-xl px-4 py-3 font-semibold border" href={`/familiada/${gameId}/screen`} target="_blank">
          Ekran (TV) →
        </a>
      </div>
    </main>
  );
}