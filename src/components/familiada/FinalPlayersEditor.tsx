"use client";

import { useMemo, useState } from "react";
import { addDoc, doc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCollection } from "@/lib/familiada/hooks";
import { finalPlayersQuery, finalPlayersCol } from "@/lib/familiada/final.service";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type FinalPlayerDoc = { name: string; index: number; score: number; updatedAt?: any };

export function FinalPlayersEditor({ gameId }: { gameId: string }) {
  const q = useMemo(() => finalPlayersQuery(gameId), [gameId]);
  const { data: players } = useCollection<FinalPlayerDoc>(q);

  const [name, setName] = useState("");

  async function addPlayer() {
    const nextIndex = players.length ? (players[players.length - 1].index ?? players.length - 1) + 1 : 0;
    await addDoc(finalPlayersCol(gameId), {
      name: name.trim() || `Zawodnik ${nextIndex + 1}`,
      index: nextIndex,
      score: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setName("");
  }

  async function swap(aId: string, aIndex: number, bId: string, bIndex: number) {
    await runTransaction(db, async (tx) => {
      tx.update(doc(finalPlayersCol(gameId), aId), { index: bIndex, updatedAt: serverTimestamp() });
      tx.update(doc(finalPlayersCol(gameId), bId), { index: aIndex, updatedAt: serverTimestamp() });
    });
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Zawodnicy finału</CardTitle>
        <Badge variant="secondary">{players.length}</Badge>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Input placeholder="Imię / nazwa zawodnika…" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={addPlayer}>Dodaj zawodnika</Button>
        </div>

        <div className="grid gap-2">
          {players.map((p, i) => (
            <div key={p.id} className="rounded-2xl border border-white/10 bg-black/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs opacity-70 tabular-nums">score: {p.score ?? 0}</div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={i === 0}
                  onClick={() => swap(p.id, p.index ?? i, players[i - 1].id, players[i - 1].index ?? i - 1)}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  disabled={i === players.length - 1}
                  onClick={() => swap(p.id, p.index ?? i, players[i + 1].id, players[i + 1].index ?? i + 1)}
                >
                  ↓
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => updateDoc(doc(finalPlayersCol(gameId), p.id), { score: 0, updatedAt: serverTimestamp() })}
                >
                  Reset score
                </Button>
                <Button variant="destructive" onClick={() => deleteDoc(doc(finalPlayersCol(gameId), p.id))}>
                  Usuń
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}