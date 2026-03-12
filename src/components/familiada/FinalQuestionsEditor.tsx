"use client";

import { useMemo, useState } from "react";
import { addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useCollection } from "@/lib/familiada/hooks";
import { finalQuestionsQuery, finalQuestionsCol } from "@/lib/familiada/final.service";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Answer = { text: string; points: number };
type FinalQuestionDoc = { text: string; index: number; timeLimitSec?: number; answers: Answer[]; updatedAt?: any };

export function FinalQuestionsEditor({ gameId }: { gameId: string }) {
  const q = useMemo(() => finalQuestionsQuery(gameId), [gameId]);
  const { data: questions } = useCollection<FinalQuestionDoc>(q);

  const [text, setText] = useState("");
  const [time, setTime] = useState(20);
  const [answersText, setAnswersText] = useState("mleko;32\nmięso;27\nsery;19");

   async function seed15() {
    const target = 15;
    const missing = Math.max(0, target - questions.length);
    if (!missing) return;

    for (let i = 0; i < missing; i++) {
      const idx = questions.length + i;
      await addDoc(finalQuestionsCol(gameId), {
        text: `Pytanie ${idx + 1}`,
        index: idx,
        timeLimitSec: 20,
        answers: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }
  
  function parseAnswers(raw: string): Answer[] {
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [t, p] = l.split(";");
        return { text: (t ?? "").trim(), points: Number(p ?? 0) || 0 };
      })
      .filter((a) => a.text.length > 0);
  }

  async function addQuestion() {
    const nextIndex = questions.length ? (questions[questions.length - 1].index ?? questions.length - 1) + 1 : 0;
    await addDoc(finalQuestionsCol(gameId), {
      text: text.trim() || `Pytanie ${nextIndex + 1}`,
      index: nextIndex,
      timeLimitSec: Number(time) || 20,
      answers: parseAnswers(answersText),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setText("");
    setTime(20);
  }
  
 
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pytania finałowe</CardTitle>
        <Badge variant="secondary">{questions.length}</Badge>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3 grid gap-2">
          <Input placeholder="Treść pytania…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Czas(s)</span>
            <Input className="w-24" inputMode="numeric" value={time} onChange={(e) => setTime(Number(e.target.value) || 20)} />
          </div>
          <Textarea
            value={answersText}
            onChange={(e) => setAnswersText(e.target.value)}
            placeholder={"Format: tekst;punkty\nmleko;32\nmięso;27"}
          />
          <Button onClick={addQuestion}>Dodaj pytanie</Button>
        </div>

        <div className="grid gap-2">
          {questions.map((q) => (
            <FinalQuestionRow key={q.id} gameId={gameId} qdoc={q} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FinalQuestionRow({ gameId, qdoc }: { gameId: string; qdoc: FinalQuestionDoc & { id: string } }) {
  const [text, setText] = useState(qdoc.text ?? "");
  const [time, setTime] = useState<number>(qdoc.timeLimitSec ?? 20);

  async function save() {
    await updateDoc(doc(finalQuestionsCol(gameId), qdoc.id), {
      text: text.trim() || "Pytanie",
      timeLimitSec: Number(time) || 20,
      updatedAt: serverTimestamp(),
    });
  }
  
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-3 grid gap-2">
      <div className="text-xs opacity-70">index: {qdoc.index}</div>
      <Input value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center gap-2">
        <span className="text-xs opacity-70">Czas(s)</span>
        <Input className="w-24" inputMode="numeric" value={time} onChange={(e) => setTime(Number(e.target.value) || 20)} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" onClick={()=> console.log("TODO: edycja odpowiedzi")}>
          Uzupełnij do 15
        </Button>
        <Button onClick={save}>Zapisz</Button>
        <Button variant="destructive" onClick={() => deleteDoc(doc(finalQuestionsCol(gameId), qdoc.id))}>
          Usuń
        </Button>
      </div>
    </div>
  );
}