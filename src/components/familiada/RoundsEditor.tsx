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
import { Separator } from "@/components/ui/separator";

type RoundDoc = {
  title: string;
  index: number;
  multiplier?: number;
  createdAt?: any;
  updatedAt?: any;
};

function toNum(x: any, fallback = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

export function RoundsEditor({ gameId }: { gameId: string }) {
  const rq = useMemo(
    () => query(collection(db, "familiadaGames", gameId, "rounds"), orderBy("index", "asc")),
    [gameId]
  );

  const { data: rounds, loading, error } = useCollection<RoundDoc>(rq);

  const [newTitle, setNewTitle] = useState("");
  const [newMultiplier, setNewMultiplier] = useState<number>(1);

  async function addRound() {
    const nextIndex =
      rounds.length > 0 ? toNum(rounds[rounds.length - 1].index, rounds.length - 1) + 1 : 0;

    await addDoc(collection(db, "familiadaGames", gameId, "rounds"), {
      title: newTitle.trim() || `Runda ${nextIndex + 1}`,
      index: nextIndex,
      multiplier: toNum(newMultiplier, 1) || 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setNewTitle("");
    setNewMultiplier(1);
  }

  async function deleteRound(roundId: string) {
    // Uwaga: usuwa tylko dokument rundy (pytania zostaną w subkolekcji).
    // Na MVP OK. Na produkcję -> Cloud Function recursive delete.
    await deleteDoc(doc(db, "familiadaGames", gameId, "rounds", roundId));
  }

  async function swapRoundIndex(aId: string, aIndex: number, bId: string, bIndex: number) {
    const aRef = doc(db, "familiadaGames", gameId, "rounds", aId);
    const bRef = doc(db, "familiadaGames", gameId, "rounds", bId);

    await runTransaction(db, async (tx) => {
      tx.update(aRef, { index: bIndex, updatedAt: serverTimestamp() });
      tx.update(bRef, { index: aIndex, updatedAt: serverTimestamp() });
    });
  }

  async function normalizeIndexes() {
    const batch = writeBatch(db);

    rounds.forEach((r, i) => {
      const ref = doc(db, "familiadaGames", gameId, "rounds", r.id);
      batch.update(ref, { index: i, updatedAt: serverTimestamp() });
    });

    await batch.commit();
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Rundy</CardTitle>
          <div className="text-xs opacity-70 mt-1">
            Dodawanie, edycja, index, mnożnik, reorder.
          </div>
        </div>

        <Badge variant="secondary">
          {loading ? "Ładuję…" : `${rounds.length} rund`}
        </Badge>
      </CardHeader>

      <CardContent className="grid gap-4">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
            {String(error.message ?? error)}
          </div>
        )}

        <Accordion type="multiple" defaultValue={["add", "list"]} className="w-full">
          <AccordionItem value="add" className="border-white/10">
            <AccordionTrigger>Dodaj rundę</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3">
                <Input
                  placeholder="Tytuł rundy (np. Runda I / Runda II / Finał)…"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />

                <div className="flex items-center gap-2">
                  <div className="text-xs opacity-70">Mnożnik</div>
                  <Input
                    className="w-24"
                    inputMode="numeric"
                    value={newMultiplier}
                    onChange={(e) => setNewMultiplier(toNum(e.target.value, 1))}
                  />
                  <div className="text-xs opacity-60">np. 1 / 2 / 3</div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={addRound}>Dodaj</Button>
                  <Button variant="secondary" onClick={() => { setNewTitle(""); setNewMultiplier(1); }}>
                    Wyczyść
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="list" className="border-white/10">
            <AccordionTrigger>Lista rund</AccordionTrigger>
            <AccordionContent>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="text-xs opacity-70">
                  Kolejność jest po <b>index</b> (0..n-1).
                </div>
                <Button variant="secondary" onClick={normalizeIndexes} disabled={rounds.length === 0}>
                  Napraw indexy
                </Button>
              </div>

              {rounds.length === 0 ? (
                <div className="text-sm opacity-70">Brak rund. Dodaj pierwszą wyżej.</div>
              ) : (
                <div className="grid gap-3">
                  {rounds.map((r, i) => (
                    <RoundRow
                      key={r.id}
                      gameId={gameId}
                      round={r}
                      indexInList={i}
                      total={rounds.length}
                      onMoveUp={async () => {
                        if (i === 0) return;
                        const above = rounds[i - 1];
                        await swapRoundIndex(r.id, toNum(r.index, i), above.id, toNum(above.index, i - 1));
                      }}
                      onMoveDown={async () => {
                        if (i === rounds.length - 1) return;
                        const below = rounds[i + 1];
                        await swapRoundIndex(r.id, toNum(r.index, i), below.id, toNum(below.index, i + 1));
                      }}
                      onDelete={() => deleteRound(r.id)}
                    />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator className="bg-white/10" />
        <div className="text-xs opacity-60">
          Tip: jeśli chcesz “Finał”, ustaw mnożnik np. 3 i nazwę “Finał”.
        </div>
      </CardContent>
    </Card>
  );
}

function RoundRow({
  gameId,
  round,
  indexInList,
  total,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  gameId: string;
  round: RoundDoc & { id: string };
  indexInList: number;
  total: number;
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(round.title ?? "");
  const [multiplier, setMultiplier] = useState<number>(toNum(round.multiplier, 1));
  const [index, setIndex] = useState<number>(toNum(round.index, indexInList));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(round.title ?? "");
    setMultiplier(toNum(round.multiplier, 1));
    setIndex(toNum(round.index, indexInList));
  }, [round.id, round.updatedAt]);

  async function save() {
    setSaving(true);
    await updateDoc(doc(db, "familiadaGames", gameId, "rounds", round.id), {
      title: title.trim() || "Runda",
      index: toNum(index, indexInList),
      multiplier: Math.max(1, toNum(multiplier, 1)),
      updatedAt: serverTimestamp(),
    });
    setSaving(false);
  }

  return (
    <Card className="border-white/10 bg-black/10">
      <CardHeader className="py-3 flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {toNum(round.index, indexInList) + 1}. {round.title}
          </div>
          <div className="text-xs opacity-70">
            Pozycja {indexInList + 1}/{total} • index: {toNum(round.index, indexInList)} • mnożnik: x{toNum(round.multiplier, 1)}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={onMoveUp} disabled={indexInList === 0} title="W górę">↑</Button>
          <Button variant="secondary" onClick={onMoveDown} disabled={indexInList === total - 1} title="W dół">↓</Button>
        </div>
      </CardHeader>

      <CardContent className="pb-4 grid gap-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł…" />

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <div className="text-xs opacity-70">Index (kolejność)</div>
            <Input inputMode="numeric" value={index} onChange={(e) => setIndex(toNum(e.target.value, indexInList))} />
          </div>

          <div className="grid gap-1">
            <div className="text-xs opacity-70">Mnożnik</div>
            <Input inputMode="numeric" value={multiplier} onChange={(e) => setMultiplier(toNum(e.target.value, 1))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={save}>
            {saving ? "Zapisuję…" : "Zapisz"}
          </Button>

          <Button variant="destructive" onClick={onDelete}>
            Usuń rundę
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}