"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { doc } from "firebase/firestore";
import { Doto } from "next/font/google";

import { db } from "@/lib/firebase/client";
import { useCollection, useDoc } from "@/lib/familiada/hooks";
import { liveStateRef, roundsQuery, teamsQuery } from "@/lib/familiada/service";
import type { LiveStateDoc, QuestionDoc, RoundDoc, TeamDoc } from "@/lib/familiada/types";

import { TvBoard } from "@/components/familiada/TvBoard";
import { Timer } from "@/components/familiada/Timer";

// (opcjonalnie) jeśli chcesz, żeby /screen sam przełączał się na finał:
import FinalScreenPage from "@/app/familiada/[gameId]/final/screen/page";

const pixel = Doto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});

export default function ScreenPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  // tylko live w tym komponencie (żeby nie mieszać hooków przy przełączaniu na finał)
  const liveRef = useMemo(() => liveStateRef(gameId), [gameId]);
  const { data: live } = useDoc<LiveStateDoc>(liveRef);

  // jeśli finał włączony -> pokaż finał
  if (live?.final?.enabled) return <FinalScreenPage />;

  return <RoundTvScreen gameId={gameId} />;
}

function RoundTvScreen({ gameId }: { gameId: string }) {
  // LIVE
  const liveRef = useMemo(() => liveStateRef(gameId), [gameId]);
  const { data: live, error: liveError } = useDoc<LiveStateDoc>(liveRef);

  // TEAMS / ROUNDS
  const rq = useMemo(() => roundsQuery(gameId), [gameId]);
  const { data: rounds } = useCollection<RoundDoc>(rq);

  const tq = useMemo(() => teamsQuery(gameId), [gameId]);
  const { data: teams } = useCollection<TeamDoc>(tq);

  const currentRound = useMemo(
    () => rounds.find((r) => r.id === live?.currentRoundId) ?? null,
    [rounds, live?.currentRoundId]
  );

  // CURRENT QUESTION DOC (hook zawsze, ref może być null)
  const questionRef = useMemo(() => {
    if (!live?.currentRoundId || !live?.currentQuestionId) return null;
    return doc(
      db,
      "familiadaGames",
      gameId,
      "rounds",
      live.currentRoundId,
      "questions",
      live.currentQuestionId
    );
  }, [gameId, live?.currentRoundId, live?.currentQuestionId]);

  const { data: currentQuestion } = useDoc<QuestionDoc>(questionRef as any);

  const revealedIdx = live?.revealedIdx ?? [];
  const multiplier = currentRound?.multiplier ?? 1;

  // SUMA
  const baseSum =
    (currentQuestion?.answers ?? [])
      .map((a, idx) => (revealedIdx.includes(idx) ? a.points : 0))
      .reduce((a, b) => a + b, 0);

  const totalSum = baseSum * multiplier;

  // TIMER default OFF
  const timerEnabled = live?.timerEnabled ?? false;
  const startedAtMs = live?.timer?.startedAt?.toMillis ? live.timer.startedAt.toMillis() : null;

  // X-y: prawa (aktywny team) max 3, lewa (steal) tylko 1
  const activeTeamId = live?.activeTeamId ?? teams?.[0]?.id ?? null;
  const stealTeamId = live?.steal?.enabled ? (live?.steal?.teamId ?? null) : null;

  const activeStrikes = activeTeamId ? (live?.strikesByTeam?.[activeTeamId] ?? 0) : 0;
  const activeStrikeCount = Math.min(3, activeStrikes);

  const stealStrikes = stealTeamId ? (live?.strikesByTeam?.[stealTeamId] ?? 0) : 0;
  const stealStrikeFilled = stealTeamId ? stealStrikes > 0 : false;

  // OVERLAY (np. RUNDA II / FINAŁ! / GRATULACJE!)
  const [overlayVisible, setOverlayVisible] = useState(false);
  const overlayTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (overlayTimerRef.current) {
      window.clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    }

    const at = live?.overlay?.at?.toMillis ? live.overlay.at.toMillis() : null;
    const durationMs = live?.overlay?.durationMs ?? 0;

    if (!at || !durationMs) {
      setOverlayVisible(false);
      return;
    }

    const remaining = at + durationMs - Date.now();
    if (remaining <= 0) {
      setOverlayVisible(false);
      return;
    }

    setOverlayVisible(true);
    overlayTimerRef.current = window.setTimeout(() => setOverlayVisible(false), remaining + 50);

    return () => {
      if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = null;
    };
  }, [live?.overlay?.at, live?.overlay?.durationMs, live?.overlay?.text]);

  // TV SFX (wymaga user gesture)
  const [tvSfxEnabled, setTvSfxEnabled] = useState(false);
  const prevAtRef = useRef<number | null>(null);

  function playTv(name: "reveal" | "wrong" | "intro" | "win") {
    const a = new Audio(`/sfx/${name}.mp3`);
    a.volume = 1.0;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }

  useEffect(() => {
    if (!tvSfxEnabled) return;

    const at = live?.sfx?.at?.toMillis ? live.sfx.at.toMillis() : null;
    const name = (live?.sfx?.name ?? null) as any;

    if (!at || !name) return;
    if (prevAtRef.current === at) return;

    prevAtRef.current = at;
    playTv(name);
  }, [tvSfxEnabled, live?.sfx?.at, live?.sfx?.name]);

  if (liveError) {
    return (
      <main className="min-h-screen p-10 text-white bg-black">
        <div className="max-w-3xl mx-auto rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-2xl font-black">Błąd</div>
          <div className="mt-2 opacity-70">{String((liveError as any)?.message ?? liveError)}</div>
        </div>
      </main>
    );
  }

  function SingleX({ filled }: { filled: boolean }) {
    return (
      <div
        className={[
          "h-24 w-24 md:h-28 md:w-28 rounded-3xl border grid place-items-center",
          filled
            ? "border-red-300/60 bg-red-500/25 shadow-[0_0_50px_rgba(255,70,70,0.35)]"
            : "border-white/10 bg-white/5",
        ].join(" ")}
      >
        <div className={filled ? "text-red-200 text-6xl md:text-7xl font-black" : "text-white/15 text-6xl md:text-7xl font-black"}>
          X
        </div>
      </div>
    );
  }

  function BigX({ filled }: { filled: boolean }) {
    return (
      <div
        className={[
          "h-16 w-16 md:h-20 md:w-20 rounded-2xl border grid place-items-center",
          filled
            ? "border-red-300/60 bg-red-500/25 shadow-[0_0_40px_rgba(255,70,70,0.35)]"
            : "border-white/10 bg-white/5",
        ].join(" ")}
      >
        <div className={filled ? "text-red-200 text-5xl md:text-6xl font-black" : "text-white/15 text-5xl md:text-6xl font-black"}>
          X
        </div>
      </div>
    );
  }

  return (
    <main className={["min-h-screen bg-black text-white", pixel.className].join(" ")}>
      {/* klik aby włączyć dźwięk na TV */}
      {!tvSfxEnabled && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur">
          <button
            className="rounded-3xl border border-white/20 bg-white/10 px-6 py-4 text-white font-black hover:bg-white/15 transition"
            onClick={() => {
              setTvSfxEnabled(true);
              playTv("intro");
            }}
          >
            Kliknij, aby włączyć dźwięk na TV
          </button>
        </div>
      )}

      {/* overlay tekstowy */}
      {overlayVisible && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/75 backdrop-blur">
          <div className="rounded-[28px] border border-amber-200/30 bg-amber-200/10 px-8 py-6 text-center shadow-[0_0_80px_rgba(255,210,80,0.12)]">
            <div className="text-amber-200 text-4xl md:text-6xl font-black tracking-widest">
              {live?.overlay?.text ?? ""}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6 md:p-10">
        {/* HEADER: runda + timer */}
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-xs opacity-70 tracking-widest">RUNDA</div>
            <div className="text-3xl md:text-5xl font-black truncate">
              {currentRound?.title ?? "—"}
            </div>
            <div className="opacity-60 text-xs mt-1">
              mnożnik: x{multiplier}
            </div>
            <div className="mt-3 text-xl md:text-3xl font-black truncate">
              {currentQuestion?.text ?? "Czekam na pytanie…"}
            </div>
          </div>

          {timerEnabled && (
            <div className="text-right">
              <div className="text-xs opacity-70 tracking-widest">CZAS</div>
              <Timer
                running={!!live?.timer?.running}
                startedAtMs={startedAtMs}
                durationSec={live?.timer?.durationSec ?? 20}
              />
            </div>
          )}
        </div>

        {/* TOP SCORES */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          {teams
            .slice()
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
            .map((t) => {
              const on = t.id === activeTeamId;
              return (
                <div
                  key={t.id}
                  className={[
                    "rounded-3xl border p-4 bg-white/5",
                    on ? "border-amber-200/30 shadow-[0_0_50px_rgba(255,210,80,0.10)]" : "border-white/10",
                  ].join(" ")}
                >
                  <div className="text-xs opacity-70 truncate">{t.name}</div>
                  <div className="mt-1 text-3xl md:text-4xl font-black tabular-nums text-amber-200">
                    {t.score ?? 0}
                  </div>
                </div>
              );
            })}
        </div>

        {/* MAIN BOARD + X */}
        <div className="mt-6 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
          {/* LEFT: 1 X (steal) */}
          <div className="flex flex-col items-center gap-3">
            <div className="text-[10px] opacity-60">STEAL</div>
            <SingleX filled={!!stealStrikeFilled} />
          </div>

          {/* CENTER: TV board */}
          <div className="min-w-0">
            <TvBoard
              answers={currentQuestion?.answers ?? []}
              revealedIdx={revealedIdx}
            />
          </div>

          {/* RIGHT: 3 X (active team) */}
          <div className="flex flex-col items-center gap-3">
            <div className="text-[10px] opacity-60">BŁĘDY</div>
            <div className="grid gap-2">
              <BigX filled={activeStrikeCount >= 1} />
              <BigX filled={activeStrikeCount >= 2} />
              <BigX filled={activeStrikeCount >= 3} />
            </div>
          </div>
        </div>

        {/* BOTTOM SUMA */}
        <div className="mt-6 md:mt-8 flex items-center justify-end">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 md:px-8 md:py-5 shadow-[0_0_50px_rgba(255,210,80,0.08)]">
            <div className="text-[10px] md:text-xs opacity-70">SUMA</div>
            <div className="mt-1 text-3xl md:text-5xl font-black tabular-nums text-amber-200">
              {totalSum}
            </div>
            <div className="mt-1 text-[10px] md:text-xs opacity-60">
              (bazowo {baseSum} × x{multiplier})
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}