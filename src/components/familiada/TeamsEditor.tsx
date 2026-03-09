"use client";

import { useMemo, useState } from "react";
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

type TeamDoc = {
  name: string;
  members?: string[];
  score?: number;
  createdAt?: any;
  updatedAt?: any;
};

function parseMembers(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TeamsEditor({ gameId }: { gameId: string }) {
  const q = useMemo(
    () =>
      query(
        collection(db, "familiadaGames", gameId, "teams"),
        orderBy("createdAt", "asc")
      ),
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
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Drużyny</h2>
        <div className="text-xs opacity-70">
          {loading ? "Ładuję…" : `${teams.length} druż.`}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {String(error.message ?? error)}
        </div>
      )}

      {/* Dodawanie */}
      <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/10 p-3">
        <div className="text-sm font-semibold">Dodaj drużynę</div>
        <input
          className="w-full rounded-xl border border-white/10 bg-transparent p-3"
          placeholder="Nazwa drużyny…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <textarea
          className="w-full rounded-xl border border-white/10 bg-transparent p-3 min-h-[90px]"
          placeholder={"Zawodnicy (1 linia = 1 osoba)\nnp.\nAnia\nBartek\nKuba"}
          value={newMembers}
          onChange={(e) => setNewMembers(e.target.value)}
        />
        <button
          className="rounded-xl bg-white text-black px-4 py-3 font-semibold hover:opacity-90 transition"
          onClick={addTeam}
        >
          Dodaj
        </button>
      </div>

      {/* Lista */}
      <div className="mt-4 grid gap-3">
        {teams.map((t) => (
          <TeamRow
            key={t.id}
            team={t}
            onSave={(name, membersText) => saveTeam(t.id, name, membersText)}
            onResetScore={() => resetScore(t.id)}
            onDelete={() => removeTeam(t.id)}
          />
        ))}

        {!loading && teams.length === 0 && (
          <div className="opacity-70 text-sm">Brak drużyn. Dodaj pierwszą wyżej.</div>
        )}
      </div>
    </section>
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

  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Edytuj</div>
        <div className="text-xs opacity-70 tabular-nums">Wynik: {team.score ?? 0}</div>
      </div>

      <div className="mt-2 grid gap-2">
        <input
          className="w-full rounded-xl border border-white/10 bg-transparent p-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nazwa…"
        />
        <textarea
          className="w-full rounded-xl border border-white/10 bg-transparent p-3 min-h-[90px]"
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          placeholder="Zawodnicy (1 linia = 1 osoba)…"
        />

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl bg-white text-black px-4 py-2 font-semibold disabled:opacity-60"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await onSave(name, membersText);
              setSaving(false);
            }}
          >
            {saving ? "Zapisuję…" : "Zapisz"}
          </button>

          <button
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10 transition"
            onClick={onResetScore}
          >
            Reset wyniku
          </button>

          <button
            className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-red-200 hover:bg-red-500/15 transition"
            onClick={onDelete}
          >
            Usuń
          </button>
        </div>
      </div>
    </div>
  );
}