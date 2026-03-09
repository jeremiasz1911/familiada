    "use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createGame } from "@/lib/familiada/service";

export default function FamiliadaHome() {
  const router = useRouter();
  const [title, setTitle] = useState("Familiada");
  const [loading, setLoading] = useState(false);

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-black">Familiada</h1>
      <p className="opacity-70 mt-1">Utwórz nową grę i przejdź do konfiguracji.</p>

      <div className="mt-6 rounded-2xl border p-4 bg-white/5">
        <label className="text-sm opacity-70">Tytuł gry</label>
        <input
          className="mt-2 w-full rounded-xl border bg-transparent p-3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <button
          className="mt-4 rounded-xl px-4 py-3 font-semibold bg-white text-black disabled:opacity-60"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            const id = await createGame(title || "Familiada");
            router.push(`/familiada/${id}/setup`);
          }}
        >
        <a className="rounded-xl border px-4 py-3 inline-block" href="/familiada/games">
          Panel gier →
        </a>
          {loading ? "Tworzę..." : "Utwórz grę"}
        </button>
      </div>
    </main>
  );
}