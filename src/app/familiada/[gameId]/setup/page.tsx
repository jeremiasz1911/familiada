"use client";

import { useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { addTeam, teamsQuery } from "@/lib/familiada/service";
import { useCollection } from "@/lib/familiada/hooks";
import type { TeamDoc } from "@/lib/familiada/types";

export default function SetupPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;

  const q = useMemo(() => teamsQuery(gameId), [gameId]);
  const { data: teams } = useCollection<TeamDoc>(q);

  const [name, setName] = useState("");
  const [members, setMembers] = useState("");

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-black">Setup drużyn</h1>

      <div className="mt-6 grid gap-4 rounded-2xl border p-4 bg-white/5">
        <input
          className="rounded-xl border bg-transparent p-3"
          placeholder="Nazwa drużyny (np. Top Dawgs)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="rounded-xl border bg-transparent p-3"
          placeholder="Uczestnicy (oddziel przecinkami) np. Ala, Olek, Kacper"
          value={members}
          onChange={(e) => setMembers(e.target.value)}
        />
        <button
          className="rounded-xl px-4 py-3 font-semibold bg-white text-black disabled:opacity-60"
          disabled={!name.trim()}
          onClick={async () => {
            await addTeam(
              gameId,
              name.trim(),
              members
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            );
            setName("");
            setMembers("");
          }}
        >
          Dodaj drużynę
        </button>
      </div>

      <div className="mt-6">
        <h2 className="text-xl font-bold">Drużyny</h2>
        <div className="mt-3 grid gap-3">
          {teams.map((t) => (
            <div key={t.id} className="rounded-2xl border p-4 bg-white/5">
              <div className="font-black">{t.name}</div>
              <div className="opacity-70 text-sm">{t.members.join(", ") || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          className="rounded-xl px-4 py-3 font-semibold border"
          onClick={() => router.push(`/familiada/${gameId}/builder`)}
        >
          Dalej: Budowanie pytań →
        </button>
      </div>
    </main>
  );
}