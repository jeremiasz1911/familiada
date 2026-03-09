"use client";

import { useMemo, useState } from "react";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCollection } from "@/lib/familiada/hooks";

type GameRow = {
  title: string;
  status?: "setup" | "live" | "ended";
  createdAt?: any;
  updatedAt?: any;
};

function copy(text: string) {
  navigator.clipboard.writeText(text);
}

export default function GamesPanelPage() {
  const q = useMemo(
    () => query(collection(db, "familiadaGames"), orderBy("createdAt", "desc")),
    []
  );

  const { data: games, loading, error } = useCollection<GameRow>(q);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Panel gier – Familiada</h1>
          <p className="opacity-70 mt-1">
            Tu masz wszystkie zapisane gry + linki do TV i kontroli.
          </p>
        </div>

        <a
          className="rounded-xl border px-4 py-3 font-semibold hover:bg-white/5 transition"
          href="/familiada"
        >
          + Utwórz nową grę
        </a>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
          {String(error.message ?? error)}
        </div>
      )}

      {loading ? (
        <div className="mt-6 opacity-70">Ładuję gry…</div>
      ) : games.length === 0 ? (
        <div className="mt-6 opacity-70">Brak zapisanych gier.</div>
      ) : (
        <div className="mt-6 grid gap-4">
          {games.map((g) => {
            const gameId = g.id;
            const tv = `${origin}/familiada/${gameId}/screen`;
            const control = `${origin}/familiada/${gameId}/play`;
            const builder = `${origin}/familiada/${gameId}/builder`;
            const setup = `${origin}/familiada/${gameId}/setup`;

            return (
              <div key={gameId} className="rounded-2xl border bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black">
                      {g.title ?? "Familiada"}
                    </div>
                    <div className="text-sm opacity-70">ID: {gameId}</div>
                    <div className="text-xs opacity-60 mt-1">
                      status: {g.status ?? "setup"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a className="rounded-xl border px-3 py-2 hover:bg-white/5 transition" href={setup}>
                      Setup
                    </a>
                    <a className="rounded-xl border px-3 py-2 hover:bg-white/5 transition" href={builder}>
                      Builder
                    </a>
                    <a className="rounded-xl border px-3 py-2 hover:bg-white/5 transition" href={control}>
                      Kontrola
                    </a>
                    <a
                      className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
                      href={tv}
                      target="_blank"
                      rel="noreferrer"
                    >
                      TV
                    </a>
                  </div>
                </div>

                {/* linki + kopiowanie */}
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-black/10 p-3">
                    <div className="text-xs opacity-70">Link TV</div>
                    <div className="mt-1 text-sm break-all">{tv}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-xl bg-white text-black px-3 py-2 font-semibold"
                        onClick={() => copy(tv)}
                      >
                        Kopiuj TV
                      </button>
                      <a
                        className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
                        href={tv}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Otwórz
                      </a>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-black/10 p-3">
                    <div className="text-xs opacity-70">Link Kontrola</div>
                    <div className="mt-1 text-sm break-all">{control}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-xl bg-white text-black px-3 py-2 font-semibold"
                        onClick={() => copy(control)}
                      >
                        Kopiuj kontrolę
                      </button>
                      <a
                        className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
                        href={control}
                      >
                        Otwórz
                      </a>
                    </div>
                  </div>
                </div>

                {/* rename */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {renameId === gameId ? (
                    <>
                      <input
                        className="rounded-xl border bg-transparent p-3 flex-1 min-w-[240px]"
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        placeholder="Nowy tytuł…"
                      />
                      <button
                        className="rounded-xl bg-white text-black px-3 py-2 font-semibold"
                        onClick={async () => {
                          await updateDoc(doc(db, "familiadaGames", gameId), {
                            title: renameTitle.trim() || "Familiada",
                            updatedAt: serverTimestamp(),
                          });
                          setRenameId(null);
                          setRenameTitle("");
                        }}
                      >
                        Zapisz
                      </button>
                      <button
                        className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
                        onClick={() => {
                          setRenameId(null);
                          setRenameTitle("");
                        }}
                      >
                        Anuluj
                      </button>
                    </>
                  ) : (
                    <button
                      className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
                      onClick={() => {
                        setRenameId(gameId);
                        setRenameTitle(g.title ?? "");
                      }}
                    >
                      Zmień nazwę
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}