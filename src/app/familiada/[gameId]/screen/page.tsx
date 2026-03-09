"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { doc } from "firebase/firestore";
import { Doto } from "next/font/google";

import { db } from "@/lib/firebase/client";
import { useCollection, useDoc } from "@/lib/familiada/hooks";
import { liveStateRef, roundsQuery, teamsQuery } from "@/lib/familiada/service";
import type { LiveStateDoc, QuestionDoc, RoundDoc, TeamDoc } from "@/lib/familiada/types";
import { TvBoard } from "@/components/familiada/TvBoard";
import { Timer } from "@/components/familiada/Timer";
import { useEffect, useRef, useState } from "react";

const pixel = Doto({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
});


export default function ScreenPage() {
  const params = useParams();
  const gameId = params.gameId as string;
  
  // LIVE
  const liveRef = useMemo(() => liveStateRef(gameId), [gameId]);
  const { data: live, loading: liveLoading, error: liveError } = useDoc<LiveStateDoc>(liveRef);

  // TEAMS / ROUNDS
  const rq = useMemo(() => roundsQuery(gameId), [gameId]);
  const { data: rounds } = useCollection<RoundDoc>(rq);

  const tq = useMemo(() => teamsQuery(gameId), [gameId]);
  const { data: teams } = useCollection<TeamDoc>(tq);

  const currentRound = useMemo(
    () => rounds.find((r) => r.id === live?.currentRoundId) ?? null,
    [rounds, live?.currentRoundId]
  );

  // CURRENT QUESTION DOC (zawsze hook, ref może być null)
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

  const { data: currentQuestion } = useDoc<QuestionDoc>(questionRef);

  const revealedIdx = live?.revealedIdx ?? [];
  const multiplier = currentRound?.multiplier ?? 1;

  // SUMA (klasycznie: suma odkrytych punktów; mnożnik pokażemy obok)
  const baseSum =
    (currentQuestion?.answers ?? [])
      .map((a, idx) => (revealedIdx.includes(idx) ? a.points : 0))
      .reduce((a, b) => a + b, 0);

  const totalSum = baseSum * multiplier;

  // TIMER default OFF
  const timerEnabled = live?.timerEnabled ?? false;
  const startedAtMs = live?.timer?.startedAt?.toMillis ? live.timer.startedAt.toMillis() : null;

  // BŁĘDY: max 3
  const activeTeamId = live?.activeTeamId ?? teams?.[0]?.id ?? null;
  const stealTeamId = live?.steal?.enabled ? (live?.steal?.teamId ?? null) : null;

  // PRAWA: aktywna drużyna ma 0..3 błędy
  const activeStrikes = activeTeamId ? (live?.strikesByTeam?.[activeTeamId] ?? 0) : 0;
  const activeStrikeCount = Math.min(3, activeStrikes);

  // LEWA: przejmujący ma TYLKO 1 X (0/1) – jeśli dał złą odpowiedź
  // (możesz używać strikesByTeam[stealTeamId], ale pokazujemy tylko 1 slot)
  const stealStrikes = stealTeamId ? (live?.strikesByTeam?.[stealTeamId] ?? 0) : 0;
  const stealXOn = stealStrikes >= 1;

const [tvSfxEnabled, setTvSfxEnabled] = useState(false);
const prevAtRef = useRef<number | null>(null);

function playTv(name: "reveal" | "wrong" | "intro" | "win") {
  const src = `/sfx/${name}.mp3`;
  const a = new Audio(src);
  a.volume = 1.0;
  a.currentTime = 0;
  void a.play().catch(() => {});
}
const [overlayVisible, setOverlayVisible] = useState(false);
const overlayTimerRef = useRef<number | null>(null);

useEffect(() => {
  // posprzątaj poprzedni timer
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
  overlayTimerRef.current = window.setTimeout(() => {
    setOverlayVisible(false);
  }, remaining + 50);

  return () => {
    if (overlayTimerRef.current) window.clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = null;
  };
}, [live?.overlay?.at, live?.overlay?.durationMs, live?.overlay?.text]);

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
          <div className="mt-2 opacity-70">{String(liveError.message ?? liveError)}</div>
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
    <main className={["min-h-screen", pixel.className].join(" ")}>
      {(() => {
        const at = live?.overlay?.at?.toMillis ? live.overlay.at.toMillis() : null;
        const dur = live?.overlay?.durationMs ?? 0;
        const now = Date.now();
        const visible = at && dur ? now - at < dur : false;

        if (!visible) return null;

        return (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/75 backdrop-blur">
            <div className="rounded-[28px] border border-amber-200/30 bg-amber-200/10 px-8 py-6 text-center shadow-[0_0_80px_rgba(255,210,80,0.12)]">
              <div className="text-amber-200 text-4xl md:text-6xl font-black tracking-widest">
                {live?.overlay?.text ?? "RUNDA"}
              </div>
              <div className="mt-2 text-xs md:text-sm opacity-70">
                Start rundy
              </div>
            </div>
          </div>
        );
      })()}
      {!tvSfxEnabled && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur">
        <button
          className="rounded-3xl border border-white/20 bg-white/10 px-6 py-4 text-white font-black hover:bg-white/15 transition"
          onClick={() => {
            setTvSfxEnabled(true);
            // “user gesture” -> możemy odpalić intro
            playTv("intro");
          }}
        >
          Kliknij, aby włączyć dźwięk na TV
        </button>
        <div className="mt-3 text-xs opacity-70">
          (Przeglądarki blokują audio bez kliknięcia)
        </div>
      </div>
      )}
      <div className="min-h-screen p-6 md:p-10 bg-gradient-to-b from-[#050505] via-[#070707] to-black text-white">
        <div className="max-w-7xl mx-auto">
          {/* TOP BAR: drużyny + wyniki */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-xs md:text-sm opacity-70">RUNDA</div>
              <div className="text-lg md:text-2xl text-amber-200 font-black">
                {currentRound?.title ?? "—"}
              </div>
              <div className="text-xs md:text-sm opacity-70">
                x{multiplier}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {teams
                .slice()
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .map((t) => {
                  const isActive = t.id === activeTeamId;
                  return (
                    <div
                      key={t.id}
                      className={[
                        "rounded-2xl border px-3 py-2 md:px-4 md:py-3",
                        isActive
                          ? "border-amber-200/40 bg-amber-200/10 shadow-[0_0_30px_rgba(255,210,80,0.10)]"
                          : "border-white/10 bg-white/5",
                      ].join(" ")}
                    >
                      <div className="text-[10px] md:text-xs opacity-70">{t.name}</div>
                      <div className="text-xl md:text-3xl font-black tabular-nums text-amber-200">
                        {t.score ?? 0}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* TIMER (opcjonalny) */}
            {timerEnabled && (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] md:text-xs opacity-70">CZAS</div>
                <Timer
                  running={!!live?.timer?.running}
                  startedAtMs={startedAtMs}
                  durationSec={live?.timer?.durationSec ?? 20}
                />
              </div>
            )}
          </div>

          {/* QUESTION */}
          <div className="mt-6 md:mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
            <div className="text-[10px] md:text-xs opacity-70">PYTANIE</div>
            <div className="mt-2 text-base md:text-xl font-black text-amber-200">
              {currentQuestion?.text ?? (liveLoading ? "ŁADUJĘ…" : "CZEKA NA PYTANIE…")}
            </div>
          </div>

          {/* MAIN LAYOUT: X - BOARD - X */}
          <div className="mt-6 md:mt-8 grid grid-cols-[120px_1fr_120px] gap-3 md:gap-6 items-center">
            {/* LEWA: TYLKO 1 X (przejęcie / wróg) */}
            <div className="flex flex-col items-center gap-3">
              <SingleX filled={!!stealTeamId && stealXOn} />
              <div className="text-[10px] opacity-60 text-center">
                {stealTeamId ? (teams.find(t => t.id === stealTeamId)?.name ?? "—") : "PRZEJĘCIE"}
              </div>
            </div>

            {/* BOARD */}
            <div>
              <TvBoard answers={currentQuestion?.answers ?? []} revealedIdx={revealedIdx} />
            </div>

            {/* PRAWA: 3 X (aktywna drużyna) */}
            <div className="flex flex-col items-center gap-3">
              <BigX filled={activeStrikeCount >= 1} />
              <BigX filled={activeStrikeCount >= 2} />
              <BigX filled={activeStrikeCount >= 3} />
              <div className="text-[10px] opacity-60 text-center">
                {teams.find(t => t.id === activeTeamId)?.name ?? "—"}
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

          {/* INFO: aktywna drużyna */}
          <div className="mt-4 text-[10px] md:text-xs opacity-50">
            Aktywna drużyna (dla X):{" "}
            <span className="text-amber-200">
              {teams.find((t) => t.id === activeTeamId)?.name ?? "—"}
            </span>
            {" • "}
            max 3 błędy
          </div>
        </div>
      </div>
    </main>
  );
}