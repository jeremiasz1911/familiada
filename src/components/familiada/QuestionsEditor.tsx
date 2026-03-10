"use client";

import { useMemo, useState, useEffect } from "react";
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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const roundsQ = useMemo(
    () => query(collection(db, "familiadaGames", gameId, "rounds"), orderBy("index", "asc")),
    [gameId]
  );
  const { data: rounds, loading: roundsLoading } = useCollection<RoundDoc>(roundsQ);

  const [roundId, setRoundId] = useState<string>("");

  const selectedRoundId = roundId || rounds[0]?.id || "";
  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null;

  // kiedy rounds się pojawią, ustaw roundId jeśli pusty (stabilniej dla Select)
  useEffect(() => {
    if (!roundId && rounds[0]?.id) setRoundId(rounds[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds.length]);

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
      questions.length > 0
        ? toNum(questions[questions.length - 1].index, questions.length - 1) + 1
        : 0;

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
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Pytania</CardTitle>
          <div className="text-xs opacity-70 mt-1">
            Edycja pytań w rundzie (text/index/time/answers).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {questionsLoading ? "Ładuję…" : `${questions.length} pytań`}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        {questionsError && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {String(questionsError.message ?? questionsError)}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <div className="text-xs opacity-70 mb-1">Runda</div>
            <Select
              value={selectedRoundId}
              onValueChange={(v) => setRoundId(v)}
              disabled={roundsLoading || rounds.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz rundę…" />
              </SelectTrigger>
              <SelectContent>
                {rounds.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {toNum(r.index, 0) + 1}. {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="text-[11px] opacity-60 mt-1">
              Aktualnie: <b>{selectedRound?.title ?? "—"}</b>
            </div>
          </div>

          <div className="flex gap-2 md:justify-end">
            <Button variant="secondary" onClick={normalizeIndexes} disabled={!selectedRoundId || questions.length === 0}>
              Napraw indexy
            </Button>
          </div>
        </div>

        <Separator className="bg-white/10" />

        {/* Add new */}
        <Accordion type="multiple" defaultValue={["add", "list"]} className="w-full">
          <AccordionItem value="add" className="border-white/10">
            <AccordionTrigger>Dodaj pytanie</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3">
                <Input
                  placeholder="Treść pytania…"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                />

                <div className="flex items-center gap-2">
                  <div className="text-xs opacity-70">Czas (s)</div>
                  <Input
                    className="w-24"
                    inputMode="numeric"
                    value={newTime}
                    onChange={(e) => setNewTime(toNum(e.target.value, 20))}
                  />
                </div>

                <div className="text-xs opacity-70">Odpowiedzi</div>
                <div className="grid gap-2">
                  {newAnswers.map((a, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_96px_40px] gap-2">
                      <Input
                        placeholder={`Odpowiedź ${idx + 1}`}
                        value={a.text}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, text: v } : x)));
                        }}
                      />
                      <Input
                        inputMode="numeric"
                        placeholder="pkt"
                        value={a.points}
                        onChange={(e) => {
                          const v = toNum(e.target.value, 0);
                          setNewAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, points: v } : x)));
                        }}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => setNewAnswers((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={newAnswers.length <= 1}
                        title="Usuń odpowiedź"
                      >
                        ✕
                      </Button>
                    </div>
                  ))}

                  <Button variant="secondary" className="w-fit" onClick={() => setNewAnswers((prev) => [...prev, emptyAnswer()])}>
                    + Dodaj odpowiedź
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button onClick={addQuestion} disabled={!selectedRoundId}>
                    Dodaj pytanie
                  </Button>
                  <Button variant="secondary" onClick={() => { setNewText(""); setNewTime(20); }}>
                    Wyczyść
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="list" className="border-white/10">
            <AccordionTrigger>Lista pytań</AccordionTrigger>
            <AccordionContent>
              <div className="text-xs opacity-70 mb-2">
                {questionsLoading ? "Ładuję…" : `Pytania w tej rundzie: ${questions.length}`}
              </div>

              {questions.length === 0 ? (
                <div className="text-sm opacity-70">Brak pytań w tej rundzie.</div>
              ) : (
                <div className="grid gap-3">
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
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
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

  useEffect(() => {
    setText(question.text ?? "");
    setTimeLimitSec(toNum(question.timeLimitSec, 20));
    setAnswers((question.answers ?? []).map((a) => ({ text: a.text ?? "", points: toNum(a.points, 0) })));
  }, [question.id, question.updatedAt]);

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

  const header = `${toNum(question.index, indexInList)}. ${question.text || "(brak treści)"}`;

  return (
    <Card className="border-white/10 bg-black/10">
      <CardHeader className="py-3 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{header}</div>
          <div className="text-xs opacity-70">
            Pozycja {indexInList + 1}/{total} • Czas: {toNum(question.timeLimitSec, 20)}s • Odp: {(question.answers ?? []).length}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={onMoveUp} disabled={indexInList === 0} title="W górę">↑</Button>
          <Button variant="secondary" onClick={onMoveDown} disabled={indexInList === total - 1} title="W dół">↓</Button>
        </div>
      </CardHeader>

      <CardContent className="pb-4 grid gap-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Treść pytania…" />

        <div className="flex items-center gap-2">
          <div className="text-xs opacity-70">Czas (s)</div>
          <Input
            className="w-24"
            inputMode="numeric"
            value={timeLimitSec}
            onChange={(e) => setTimeLimitSec(toNum(e.target.value, 20))}
          />
        </div>

        <div className="text-xs opacity-70">Odpowiedzi</div>
        <div className="grid gap-2">
          {answers.map((a, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_96px_40px] gap-2">
              <Input
                value={a.text}
                onChange={(e) => {
                  const v = e.target.value;
                  setAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, text: v } : x)));
                }}
                placeholder={`Odpowiedź ${idx + 1}`}
              />
              <Input
                inputMode="numeric"
                value={a.points}
                onChange={(e) => {
                  const v = toNum(e.target.value, 0);
                  setAnswers((prev) => prev.map((x, i) => (i === idx ? { ...x, points: v } : x)));
                }}
                placeholder="pkt"
              />
              <Button
                variant="secondary"
                onClick={() => setAnswers((prev) => prev.filter((_, i) => i !== idx))}
                disabled={answers.length <= 1}
                title="Usuń"
              >
                ✕
              </Button>
            </div>
          ))}

          <Button variant="secondary" className="w-fit" onClick={() => setAnswers((prev) => [...prev, emptyAnswer()])}>
            + Dodaj odpowiedź
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={save}>
            {saving ? "Zapisuję…" : "Zapisz"}
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Usuń pytanie
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}