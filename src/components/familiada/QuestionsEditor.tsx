"use client";

import { useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { useCollection } from "@/lib/familiada/hooks";

type Answer = { text: string; points: number };

type RoundDoc = {
  title: string;
  index: number;
  multiplier?: number;
  type?: string;
};

type QuestionDoc = {
  text?: string;
  index?: number;
  timeLimitSec?: number;
  answers?: Answer[];
  createdAt?: any;
  updatedAt?: any;
};

function toNum(x: any, fallback = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function emptyAnswer(): Answer {
  return { text: "", points: 0 };
}

export function QuestionsEditor({ gameId }: { gameId: string }) {
  // rounds
  const roundsQ = useMemo(
    () => query(collection(db, "familiadaGames", gameId, "rounds"), orderBy("index", "asc")),
    [gameId]
  );
  const { data: rounds, loading: roundsLoading } = useCollection<RoundDoc>(roundsQ);

  const [roundId, setRoundId] = useState<string>("");

  // default round auto-select
  const selectedRoundId = roundId || rounds[0]?.id || "";
  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null;

  // questions for selected round
  const questionsQ = useMemo(() => {
    if (!selectedRoundId) return null;
    return query(
      collection(db, "familiadaGames", gameId, "rounds", selectedRoundId, "questions"),
      orderBy("index", "asc")
    );
  }, [gameId, selectedRoundId]);

  const { data: questions, loading: questionsLoading, error: questionsError } =
    useCollection<QuestionDoc>(questionsQ);

  // add form
  const [newText, setNewText] = useState("");
  const [newTime, setNewTime] = useState<number>(20);
  const [newAnswers, setNewAnswers] = useState<Answer[]>([
    { text: "", points: 30 },
    { text: "", points: 20 },
    { text: "", points: 10 },
  ]);

  async function addQuestion() {
    if (!selectedRoundId) return;

    const nextIndex =
      questions.length > 0 ? toNum(questions[questions.length - 1].index, questions.length - 1) + 1 : 0;

    const cleanAnswers = newAnswers
      .map((a) => ({ text: (a.text ?? "").trim(), points: toNum(a.points, 0) }))
      .filter((a) => a.text.length > 0);

    await addDoc(collection(db, "familiadaGames", gameId, "rounds", selectedRoundId, "questions"), {
      text: newText.trim() || "Nowe pytanie",
      index: nextIndex,
      timeLimitSec: toNum(newTime, 20),
      answers: cleanAnswers,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setNewText("");
    setNewTime(20);
    setNewAnswers([{ text: "", points: 30 }, { text: "", points: 20 }, { text: "", points: 10 }]);
  }

  async function deleteQuestion(questionId: string) {
    if (!selectedRoundId) return;
    await deleteDoc(doc(db, "familiadaGames", gameId, "rounds", selectedRoundId, "questions", questionId));
  }

  async function swapQuestionIndex(aId: string, aIndex: number, bId: string, bIndex: number) {
    if (!selectedRoundId) return;

    const aRef = doc(db, "familiadaGames", gameId, "rounds", selectedRoundId, "questions", aId);
    const bRef = doc(db, "familiadaGames", gameId, "rounds", selectedRoundId, "questions", bId);

    await runTransaction(db, async (tx) => {
      tx.update(aRef, { index: bIndex, updatedAt: serverTimestamp() });
      tx.update(bRef, { index: aIndex, updatedAt: serverTimestamp() });
    });
  }

  async function normalizeIndexes() {
    if (!selectedRoundId) return;
    const batch = writeBatch(db);

    questions.forEach((q, i) => {
      const qRef = doc(db, "familiadaGames", gameId, "rounds", selectedRoundId, "questions", q.id);
      batch.update(qRef, { index: i, updatedAt: serverTimestamp() });
    });

    await batch.commit();
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">Pytania</h2>
          <div className="text-xs opacity-70 mt-1">
            Edytujesz pytania dla wybranej rundy (ważne: `text` + numeryczny `index`).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-white/10 bg-transparent px-3 py-2"
            value={selectedRoundId}
            onChange={(e) => setRoundId(e.target.value)}
            disabled={roundsLoading || rounds.length === 0}
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {toNum(r.index, 0) + 1}. {r.title}
              </option>
            ))}
          </select>

          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
            onClick={normalizeIndexes}
            disabled={!selectedRoundId || questions.length === 0}
            title="Ustaw index pytań: 0..n-1"
          >
            Napraw indexy
          </button>
        </div>
      </div>

      {questionsError && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {String(questionsError.message ?? questionsError)}
        </div>
      )}

      {/* Add new */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-3">
        <div className="font-semibold text-sm">
          Dodaj pytanie do: <span className="opacity-80">{selectedRound?.title ?? "—"}</span>
        </div>

        <div className="mt-2 grid gap-2">
          <input
            className="w-full rounded-xl border border-white/10 bg-transparent p-3"
            placeholder="Treść pytania…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
          />

          <div className="flex items-center gap-2">
            <div className="text-xs opacity-70">Czas (s)</div>
            <input
              className="w-24 rounded-xl border border-white/10 bg-transparent p-2"
              inputMode="numeric"
              value={newTime}
              onChange={(e) => setNewTime(toNum(e.target.value, 20))}
            />
          </div>

          <div className="text-xs opacity-70 mt-1">Odpowiedzi (tekst + punkty)</div>
          <div className="grid gap-2">
            {newAnswers.map((a, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-white/10 bg-transparent p-3"
                  placeholder={`Odpowiedź ${idx + 1}`}
                  value={a.text}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, text: v } : x)));
                  }}
                />
                <input
                  className="w-24 rounded-xl border border-white/10 bg-transparent p-3"
                  inputMode="numeric"
                  placeholder="pkt"
                  value={a.points}
                  onChange={(e) => {
                    const v = toNum(e.target.value, 0);
                    setNewAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, points: v } : x)));
                  }}
                />
                <button
                  className="rounded-xl border border-white/10 bg-white/5 px-3 hover:bg-white/10 transition"
                  onClick={() => setNewAnswers((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={newAnswers.length <= 1}
                  title="Usuń odpowiedź"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition w-fit"
              onClick={() => setNewAnswers((prev) => [...prev, emptyAnswer()])}
            >
              + Dodaj odpowiedź
            </button>
          </div>

          <button
            className="rounded-xl bg-white text-black px-4 py-3 font-semibold hover:opacity-90 transition"
            onClick={addQuestion}
            disabled={!selectedRoundId}
          >
            Dodaj pytanie
          </button>
        </div>
      </div>

      {/* list */}
      <div className="mt-4">
        <div className="text-xs opacity-70">
          {questionsLoading ? "Ładuję…" : `Pytania w tej rundzie: ${questions.length}`}
        </div>

        <div className="mt-3 grid gap-3">
          {questions.map((q, i) => (
            <QuestionRow
              key={q.id}
              gameId={gameId}
              roundId={selectedRoundId}
              question={q}
              indexInList={i}
              total={questions.length}
              onDelete={() => deleteQuestion(q.id)}
              onMoveUp={async () => {
                if (i === 0) return;
                const above = questions[i - 1];
                await swapQuestionIndex(q.id, toNum(q.index, i), above.id, toNum(above.index, i - 1));
              }}
              onMoveDown={async () => {
                if (i === questions.length - 1) return;
                const below = questions[i + 1];
                await swapQuestionIndex(q.id, toNum(q.index, i), below.id, toNum(below.index, i + 1));
              }}
            />
          ))}

          {!questionsLoading && questions.length === 0 && (
            <div className="opacity-70 text-sm">Brak pytań w tej rundzie. Dodaj pierwsze wyżej.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function QuestionRow({
  gameId,
  roundId,
  question,
  indexInList,
  total,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  gameId: string;
  roundId: string;
  question: QuestionDoc & { id: string };
  indexInList: number;
  total: number;
  onDelete: () => Promise<void>;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
}) {
  const [text, setText] = useState(question.text ?? "");
  const [timeLimitSec, setTimeLimitSec] = useState<number>(toNum(question.timeLimitSec, 20));
  const [answers, setAnswers] = useState<Answer[]>(
    (question.answers ?? []).map((a) => ({ text: a.text ?? "", points: toNum(a.points, 0) }))
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const qRef = doc(db, "familiadaGames", gameId, "rounds", roundId, "questions", question.id);

    const cleanAnswers = answers
      .map((a) => ({ text: (a.text ?? "").trim(), points: toNum(a.points, 0) }))
      .filter((a) => a.text.length > 0);

    await updateDoc(qRef, {
      text: text.trim() || "Pytanie",
      timeLimitSec: toNum(timeLimitSec, 20),
      answers: cleanAnswers,
      updatedAt: serverTimestamp(),
    });

    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-70">
            #{toNum(question.index, indexInList)} (pozycja {indexInList + 1}/{total})
          </div>
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-transparent p-3 font-semibold"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Treść pytania…"
          />
          {!question.text && (
            <div className="mt-1 text-xs text-amber-200/90">
              ⚠️ To pytanie nie miało pola <b>text</b> — tu możesz je dopisać.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
            onClick={onMoveUp}
            disabled={indexInList === 0}
            title="Przesuń w górę"
          >
            ↑
          </button>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition"
            onClick={onMoveDown}
            disabled={indexInList === total - 1}
            title="Przesuń w dół"
          >
            ↓
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="text-xs opacity-70">Czas (s)</div>
        <input
          className="w-24 rounded-xl border border-white/10 bg-transparent p-2"
          inputMode="numeric"
          value={timeLimitSec}
          onChange={(e) => setTimeLimitSec(toNum(e.target.value, 20))}
        />
      </div>

      <div className="mt-3 text-xs opacity-70">Odpowiedzi</div>
      <div className="mt-2 grid gap-2">
        {answers.map((a, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-white/10 bg-transparent p-3"
              value={a.text}
              onChange={(e) => {
                const v = e.target.value;
                setAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, text: v } : x)));
              }}
              placeholder={`Odpowiedź ${idx + 1}`}
            />
            <input
              className="w-24 rounded-xl border border-white/10 bg-transparent p-3"
              inputMode="numeric"
              value={a.points}
              onChange={(e) => {
                const v = toNum(e.target.value, 0);
                setAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, points: v } : x)));
              }}
              placeholder="pkt"
            />
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-3 hover:bg-white/10 transition"
              onClick={() => setAnswers((prev) => prev.filter((_, i) => i !== idx))}
              disabled={answers.length <= 1}
              title="Usuń odpowiedź"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:bg-white/10 transition w-fit"
          onClick={() => setAnswers((prev) => [...prev, emptyAnswer()])}
        >
          + Dodaj odpowiedź
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="rounded-xl bg-white text-black px-4 py-2 font-semibold disabled:opacity-60"
          disabled={saving}
          onClick={save}
        >
          {saving ? "Zapisuję…" : "Zapisz"}
        </button>
        <button
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-red-200 hover:bg-red-500/15 transition"
          onClick={onDelete}
        >
          Usuń pytanie
        </button>
      </div>
    </div>
  );
}