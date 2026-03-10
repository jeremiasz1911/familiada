"use client";

import { useMemo, useState, useEffect } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
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

type TeamDoc = {
  name: string;
  members?: string[];
  score?: number;
  createdAt?: any;
  updatedAt?: any;
};

function parseMembers(text: string) {
  // linie + dopuszczamy przecinki
  return text
    .split("\n")
    .flatMap((line) => line.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TeamsEditor({ gameId }: { gameId: string }) {
  const q = useMemo(
    () => query(collection(db, "familiadaGames", gameId, "teams"), orderBy("createdAt", "asc")),
    [gameId]
  );

  const { data: teams, loading, error } = useCollection<TeamDoc>(q);

  const [newName, setNewName] = useState("");
  const [newMembers, setNewMembers] = useState("");

  async function addTeam() {
    const name = newName.trim() || "Nowa drużyna";
    const members = parseMembers(newMembers);

    await addDoc(collection(db, "familiadaGames", gameId, "teams"), {
      name,
      members,
      score: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setNewName("");
    setNewMembers("");
  }

  async function saveTeam(teamId: string, name: string, membersText: string) {
    await updateDoc(doc(db, "familiadaGames", gameId, "teams", teamId), {
      name: name.trim() || "Drużyna",
      members: parseMembers(membersText),
      updatedAt: serverTimestamp(),
    });
  }

  async function resetScore(teamId: string) {
    await updateDoc(doc(db, "familiadaGames", gameId, "teams", teamId), {
      score: 0,
      updatedAt: serverTimestamp(),
    });
  }

  async function removeTeam(teamId: string) {
    await deleteDoc(doc(db, "familiadaGames", gameId, "teams", teamId));
  }

  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Drużyny</CardTitle>
          <div className="text-xs opacity-70 mt-1">Dodawanie, edycja składu i reset wyniku.</div>
        </div>

        <Badge variant="secondary">
          {loading ? "Ładuję…" : `${teams.length} druż.`}
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
            <AccordionTrigger>Dodaj drużynę</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3">
                <Input
                  placeholder="Nazwa drużyny…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Textarea
                  placeholder={"Zawodnicy (1 linia = 1 osoba)\nMoże być też: Ania, Bartek, Kuba"}
                  value={newMembers}
                  onChange={(e) => setNewMembers(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={addTeam}>Dodaj</Button>
                  <Button variant="secondary" onClick={() => { setNewName(""); setNewMembers(""); }}>
                    Wyczyść
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="list" className="border-white/10">
            <AccordionTrigger>Lista drużyn</AccordionTrigger>
            <AccordionContent>
              {teams.length === 0 ? (
                <div className="text-sm opacity-70">Brak drużyn. Dodaj pierwszą wyżej.</div>
              ) : (
                <div className="grid gap-3">
                  {teams.map((t) => (
                    <TeamRow
                      key={t.id}
                      team={t}
                      onSave={(name, membersText) => saveTeam(t.id, name, membersText)}
                      onResetScore={() => resetScore(t.id)}
                      onDelete={() => removeTeam(t.id)}
                    />
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator className="bg-white/10" />
        <div className="text-xs opacity-60">
          Tip: wynik w trakcie gry edytujesz w panelu prowadzącego (UNDO/±).
        </div>
      </CardContent>
    </Card>
  );
}

function TeamRow({
  team,
  onSave,
  onResetScore,
  onDelete,
}: {
  team: TeamDoc & { id: string };
  onSave: (name: string, membersText: string) => Promise<void>;
  onResetScore: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(team.name ?? "");
  const [membersText, setMembersText] = useState((team.members ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  // jeśli dokument się zmieni z zewnątrz, odśwież local state
  useEffect(() => {
    setName(team.name ?? "");
    setMembersText((team.members ?? []).join("\n"));
  }, [team.id, team.updatedAt]);

  return (
    <Card className="border-white/10 bg-black/10">
      <CardHeader className="py-3 flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{team.name}</div>
          <div className="text-xs opacity-70">
            Zawodnicy: {(team.members ?? []).length} • Wynik: <span className="tabular-nums">{team.score ?? 0}</span>
          </div>
        </div>

        <Badge variant="secondary" className="tabular-nums">
          {team.score ?? 0}
        </Badge>
      </CardHeader>

      <CardContent className="pb-4 grid gap-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa…" />
        <Textarea
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          placeholder="Zawodnicy (1 linia = 1 osoba)…"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(name, membersText);
              setSaving(false);
            }}
          >
            {saving ? "Zapisuję…" : "Zapisz"}
          </Button>

          <Button variant="secondary" onClick={onResetScore}>
            Reset wyniku
          </Button>

          <Button variant="destructive" onClick={onDelete}>
            Usuń
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}