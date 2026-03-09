"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc } from "firebase/firestore";
import {
  Monitor,
  ChevronLeft,
  ChevronRight,
  Layers,
  HelpCircle,
  Users,
  Shuffle,
  Timer as TimerIcon,
  Award,
  XCircle,
  Play as PlayIcon,
  Square,
  RotateCcw,
  PanelTop,
  PanelBottom,
  Volume2,
  Sparkles,
  Zap,
  Trophy,
} from "lucide-react";

import { db } from "@/lib/firebase/client";
import { useCollection, useDoc } from "@/lib/familiada/hooks";
import {
  liveStateRef,
  roundsQuery,
  teamsQuery,
  questionsQuery,
  setCurrentQuestion,
  clearReveals,
  awardPoints,
  addStrike,
  setActiveTeam,
  setSteal,
  startTimer,
  stopTimer,
  setTimerEnabled,
  triggerSfx,
  resetForNewRound,
  showRoundOverlay,
  toggleReveal,
  adjustTeamScore,
  setTeamScore,
  resetTeamScore,
  resetAllTeamScores,
  undoLastAward,
  undoLastStrike
} from "@/lib/familiada/service";

import type { LiveStateDoc, RoundDoc, TeamDoc, QuestionDoc } from "@/lib/familiada/types";
import { Timer } from "@/components/familiada/Timer";
import { AnswerControlList } from "@/components/familiada/AnswerControlList";

function toNum(x: any, fallback = 9999) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function IconBtn({
  onClick,
  disabled,
  title,
  children,
  big,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  big?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        "grid place-items-center rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition active:scale-[0.98]",
        "disabled:opacity-40 disabled:hover:bg-white/5",
        big ? "h-12 w-12" : "h-10 w-10",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Drawer({
  title,
  icon,
  open,
  onToggle,
  right,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="opacity-80">{icon}</span>
          <span className="font-semibold truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          {open ? <PanelBottom size={18} className="opacity-70" /> : <PanelTop size={18} className="opacity-70" />}
        </div>
      </button>

      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

export default function PlayPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  // --- LIVE
  const liveRef = useMemo(() => liveStateRef(gameId), [gameId]);
  const { data: live, loading: liveLoading, error: liveError } = useDoc<LiveStateDoc>(liveRef);

  // --- ROUNDS / TEAMS (raw)
  const rq = useMemo(() => roundsQuery(gameId), [gameId]);
  const { data: roundsRaw } = useCollection<RoundDoc>(rq);

  const tq = useMemo(() => teamsQuery(gameId), [gameId]);
  const { data: teamsRaw } = useCollection<TeamDoc>(tq);

  // --- SORTED
  const rounds = useMemo(() => {
    return [...roundsRaw].sort((a: any, b: any) => toNum(a.index) - toNum(b.index));
  }, [roundsRaw]);

  const teams = useMemo(() => {
    // teams nie muszą być sortowane, ale stabilnie:
    return [...teamsRaw];
  }, [teamsRaw]);

  const currentRoundIndex = useMemo(() => {
    if (!live?.currentRoundId) return -1;
    return rounds.findIndex((r) => r.id === live.currentRoundId);
  }, [rounds, live?.currentRoundId]);

  const currentRound = currentRoundIndex >= 0 ? rounds[currentRoundIndex] : null;

  // --- QUESTIONS for current round
  const qq = useMemo(
    () => (live?.currentRoundId ? questionsQuery(gameId, live.currentRoundId) : null),
    [gameId, live?.currentRoundId]
  );
  const { data: questionsRaw } = useCollection<QuestionDoc>(qq);

  const questions = useMemo(() => {
    return [...questionsRaw].sort((a: any, b: any) => toNum(a.index) - toNum(b.index));
  }, [questionsRaw]);
  
  const questionsKey = useMemo(() => questions.map((q) => q.id).join("|"), [questions]);
  const firstQId = questions[0]?.id ?? null;

  const currentQuestionIndex = useMemo(() => {
    if (!live?.currentQuestionId) return -1;
    return questions.findIndex((q) => q.id === live.currentQuestionId);
  }, [questions, live?.currentQuestionId]);

  // --- CURRENT QUESTION DOC (correct path!)
  const questionRef = useMemo(() => {
    if (!live?.currentRoundId || !live?.currentQuestionId) return null;
    return doc(
      db,
      "familiadaGames",
      gameId,
      "rounds", // <-- ważne: "rounds"
      live.currentRoundId,
      "questions",
      live.currentQuestionId
    );
  }, [gameId, live?.currentRoundId, live?.currentQuestionId]);

  const { data: currentQuestion } = useDoc<QuestionDoc>(questionRef);

  const [manualScore, setManualScore] = useState<string>("");

  // --- auto set first round if none
  useEffect(() => {
    if (!live) return;
    if (live.currentRoundId) return;
    if (rounds.length === 0) return;
    setCurrentQuestion(gameId, rounds[0].id, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, live?.currentRoundId, rounds.length]);

  // --- auto set first question when entering a round
  useEffect(() => {
    if (!live?.currentRoundId) return;
    if (!firstQId) return;

    const ok =
      !!live.currentQuestionId && questions.some((q) => q.id === live.currentQuestionId);

    if (!ok) {
      setCurrentQuestion(gameId, live.currentRoundId, firstQId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, live?.currentRoundId, live?.currentQuestionId, firstQId, questionsKey]);

  // --- scoring
  const revealed = live?.revealedIdx ?? [];
  const multiplier = currentRound?.multiplier ?? 1;

  const baseSum =
    (currentQuestion?.answers ?? [])
      .map((a, idx) => (revealed.includes(idx) ? a.points : 0))
      .reduce((a, b) => a + b, 0);

  const bank = baseSum * multiplier;

  // --- timer
  const startedAtMs = live?.timer?.startedAt?.toMillis ? live.timer.startedAt.toMillis() : null;

  // --- teams state
  const activeTeamId = live?.activeTeamId ?? (teams[0]?.id ?? null);
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  const stealEnabled = live?.steal?.enabled ?? false;
  const stealTeamId = live?.steal?.teamId ?? null;
  const stealTeam = teams.find((t) => t.id === stealTeamId) ?? null;

  // --- UI (domyślnie zwinięte)
  const [openBoard, setOpenBoard] = useState(false);
  const [openTeams, setOpenTeams] = useState(false);
  const [openSteal, setOpenSteal] = useState(false);
  const [openTime, setOpenTime] = useState(false);
  const [openSfx, setOpenSfx] = useState(false);

  const [bankFlash, setBankFlash] = useState(false);

  if (liveError) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-black">Błąd</h1>
        <p className="mt-2 opacity-70">{String(liveError.message ?? liveError)}</p>
      </main>
    );
  }

  // --- navigation helpers
  const canPrevRound = currentRoundIndex > 0;
  const canNextRound = currentRoundIndex >= 0 && currentRoundIndex < rounds.length - 1;
  const prevRoundId = canPrevRound ? rounds[currentRoundIndex - 1].id : null;
  const nextRoundId = canNextRound ? rounds[currentRoundIndex + 1].id : null;

  const canPrevQ = currentQuestionIndex > 0;
  const canNextQ = currentQuestionIndex >= 0 && currentQuestionIndex < questions.length - 1;
  const prevQId = canPrevQ ? questions[currentQuestionIndex - 1].id : null;
  const nextQId = canNextQ ? questions[currentQuestionIndex + 1].id : null;

  async function goToRound(roundId: string) {
    // reset X/steal/timer/odkrycia przy zmianie rundy
    await resetForNewRound(gameId);

    await setCurrentQuestion(gameId, roundId, ""); // pytanie ustawi efekt auto
    const title = (rounds.find((r) => r.id === roundId)?.title ?? "RUNDA").toUpperCase();
    await showRoundOverlay(gameId, title, 2500);
    await triggerSfx(gameId, "intro");
  }

  async function goToQuestion(questionId: string) {
    if (!live?.currentRoundId) return;
    await setCurrentQuestion(gameId, live.currentRoundId, questionId);
    await clearReveals(gameId);
  }

  async function finishGame() {
    await triggerSfx(gameId, "win");
    const text = `GRATULACJE!`;
    await showRoundOverlay(gameId, text, 4500);
  }

  async function advanceAfterBank() {
    // next question
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length - 1) {
      await goToQuestion(questions[currentQuestionIndex + 1].id);
      return;
    }
    // next round
    if (currentRoundIndex >= 0 && currentRoundIndex < rounds.length - 1) {
      await goToRound(rounds[currentRoundIndex + 1].id);
      return;
    }
    // end
    await finishGame();
  }

  return (
    <main className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* TOP STRIP (bez tytułu “Kontrola…”) */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs opacity-70">Aktywna drużyna</div>
          <div className="text-xl font-black truncate">{activeTeam?.name ?? "—"}</div>

          <div
            className={[
              "mt-2 inline-flex items-center gap-2 rounded-2xl border px-3 py-2",
              bankFlash
                ? "border-amber-200/40 bg-amber-200/15 shadow-[0_0_70px_rgba(255,210,80,0.25)] animate-pulse ring-2 ring-amber-200/30"
                : "border-white/10 bg-white/5",
            ].join(" ")}
          >
            <span className="text-[10px] opacity-70">BANK</span>
            <span className="text-2xl font-black tabular-nums text-amber-200">{bank}</span>
            <span className="text-[10px] opacity-60">(bazowo {baseSum} × x{multiplier})</span>
          </div>

          <div className="text-[10px] opacity-60 mt-1">
            Rundy: {rounds.length} • Pytania w rundzie: {questions.length}
            {liveLoading ? " • ładuje…" : ""}
          </div>
        </div>

        <button
          className="rounded-xl border px-3 py-2 hover:bg-white/5 transition flex items-center gap-2 shrink-0"
          onClick={() => window.open(`/familiada/${gameId}/screen`, "_blank", "noopener,noreferrer")}
        >
          <Monitor size={18} />
          TV
        </button>
      </div>

      {/* ALWAYS VISIBLE NAV (strzałki nie znikają) */}
      <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="grid gap-3">
          {/* Round row */}
          <div className="rounded-2xl border border-white/10 bg-black/10 p-3 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Layers size={16} className="opacity-70" /> Runda
              </div>
              <div className="text-xs opacity-70">x{multiplier}</div>
            </div>

            <div className="mt-2 grid grid-cols-[48px_1fr_48px] gap-2 items-center">
              <IconBtn
                big
                disabled={!canPrevRound}
                title="Poprzednia runda"
                onClick={() => prevRoundId && goToRound(prevRoundId)}
              >
                <ChevronLeft />
              </IconBtn>

              <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="text-xs opacity-70">
                  {currentRoundIndex >= 0 ? `${currentRoundIndex + 1}/${rounds.length}` : `—/${rounds.length}`}
                </div>
                <div className="font-black truncate">{currentRound?.title ?? "—"}</div>
              </div>

              <IconBtn
                big
                disabled={!canNextRound}
                title="Następna runda"
                onClick={() => nextRoundId && goToRound(nextRoundId)}
              >
                <ChevronRight />
              </IconBtn>
            </div>
          </div>

          {/* Question row */}
          <div className="rounded-2xl border border-white/10 bg-black/10 p-3 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold flex items-center gap-2">
                <HelpCircle size={16} className="opacity-70" /> Pytanie
              </div>
              <div className="text-xs opacity-70">
                {currentQuestionIndex >= 0 ? `${currentQuestionIndex + 1}/${questions.length}` : `—/${questions.length}`}
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[44px_1fr_44px] gap-2 items-center">
              <IconBtn disabled={!canPrevQ} title="Poprzednie pytanie" onClick={() => prevQId && goToQuestion(prevQId)}>
                <ChevronLeft size={18} />
              </IconBtn>

              <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <div className="font-black truncate">{currentQuestion?.text ?? "—"}</div>
              </div>

              <IconBtn disabled={!canNextQ} title="Następne pytanie" onClick={() => nextQId && goToQuestion(nextQId)}>
                <ChevronRight size={18} />
              </IconBtn>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <div className="mt-4 grid lg:grid-cols-3 gap-4">
        {/* LEFT: Board */}
        <div className="lg:col-span-2 grid gap-4">
          <Drawer
            title="Tablica (odkrywanie)"
            icon={<HelpCircle size={18} />}
            open={openBoard}
            onToggle={() => setOpenBoard((v) => !v)}
            right={<span className="text-xs opacity-70">{currentQuestion?.answers?.length ?? 0} odp.</span>}
          >
            <AnswerControlList
              answers={currentQuestion?.answers ?? []}
              revealedIdx={revealed}
              onToggle={async (idx) => {
                const was = revealed.includes(idx);
                await toggleReveal(gameId, idx);
                if (!was) await triggerSfx(gameId, "reveal");
              }}
            />
          </Drawer>
        </div>

        {/* RIGHT: Teams / Steal / Time / SFX */}
        <div className="grid gap-4">
          <Drawer
            title="Drużyny"
            icon={<Users size={18} />}
            open={openTeams}
            onToggle={() => setOpenTeams((v) => !v)}
            right={<span className="text-xs opacity-70">{teams.length}</span>}
          >
            <div className="flex gap-2 overflow-auto pb-1">
              {teams.map((t) => {
                const on = t.id === activeTeamId;
                return (
                  <button
                    key={t.id}
                    className={[
                      "shrink-0 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                      on ? "bg-amber-200 text-black border-amber-200" : "bg-white/5 border-white/10 hover:bg-white/10",
                    ].join(" ")}
                    onClick={() => setActiveTeam(gameId, t.id)}
                  >
                    {t.name} <span className="opacity-70 tabular-nums">{t.score ?? 0}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl bg-white text-black px-3 py-3 font-black flex items-center justify-center gap-2"
                onClick={async () => {
                  if (!activeTeamId) return;

                  setBankFlash(true);
                  setTimeout(() => setBankFlash(false), 650);

                  await awardPoints(gameId, activeTeamId, bank);
                  await clearReveals(gameId);

                  // await triggerSfx(gameId, "win");

                  await advanceAfterBank();
                }}
              >
                <Award size={28} /> Daj punkty drużynie
              </button>

              <button
                className="rounded-2xl border px-3 py-3 font-black flex items-center justify-center gap-2 hover:bg-white/5 transition"
                onClick={async () => {
                  if (!activeTeamId) return;
                  await addStrike(gameId, activeTeamId);
                  await triggerSfx(gameId, "wrong");
                }}
              >
                <XCircle size={18} /> X
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border px-3 py-2 hover:bg-white/5 transition"
                onClick={() => undoLastAward(gameId)}
                title="Cofnij ostatnie przyznanie banku"
              >
                UNDO Bank
              </button>

              <button
                className="rounded-2xl border px-3 py-2 hover:bg-white/5 transition"
                onClick={() => undoLastStrike(gameId)}
                title="Cofnij ostatni błąd (X)"
              >
                UNDO X
              </button>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <button className="rounded-xl border px-2 py-2" onClick={() => activeTeamId && adjustTeamScore(gameId, activeTeamId, -5)}>-5</button>
              <button className="rounded-xl border px-2 py-2" onClick={() => activeTeamId && adjustTeamScore(gameId, activeTeamId, -1)}>-1</button>
              <button className="rounded-xl border px-2 py-2" onClick={() => activeTeamId && adjustTeamScore(gameId, activeTeamId, +1)}>+1</button>
              <button className="rounded-xl border px-2 py-2" onClick={() => activeTeamId && adjustTeamScore(gameId, activeTeamId, +5)}>+5</button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
                onClick={() => activeTeamId && resetTeamScore(gameId, activeTeamId)}
              >
                Reset wyniku aktywnej
              </button>

              <button
                className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
                onClick={() => resetAllTeamScores(gameId, teams.map(t => t.id))}
              >
                Reset wszystkich
              </button>
            </div>
            <div className="mt-3 flex gap-2">
            <input
              className="w-28 rounded-xl border bg-transparent px-3 py-2"
              inputMode="numeric"
              value={manualScore}
              onChange={(e) => setManualScore(e.target.value)}
              placeholder="np. 120"
            />
            <button
              className="rounded-xl border px-3 py-2 hover:bg-white/5 transition"
              onClick={() => {
                if (!activeTeamId) return;
                const v = Number(manualScore);
                if (!Number.isFinite(v)) return;
                setTeamScore(gameId, activeTeamId, v);
              }}
            >
              Ustaw wynik
            </button>
          </div>
          </Drawer>
                
          <Drawer
            title="Przejęcie"
            icon={<Shuffle size={18} />}
            open={openSteal}
            onToggle={() => setOpenSteal((v) => !v)}
            right={<span className="text-xs opacity-70">{stealEnabled ? "ON" : "OFF"}</span>}
          >
            <div className="text-xs opacity-70">
              Przejmuje: <span className="opacity-90">{stealTeam?.name ?? "—"}</span>
            </div>

            <div className="mt-3 flex gap-2 overflow-auto pb-1">
              {teams
                .filter((t) => t.id !== activeTeamId)
                .map((t) => (
                  <button
                    key={t.id}
                    className={[
                      "shrink-0 rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                      t.id === stealTeamId ? "bg-white text-black" : "bg-white/5 border-white/10 hover:bg-white/10",
                    ].join(" ")}
                    onClick={() => setSteal(gameId, true, t.id)}
                  >
                    {t.name}
                  </button>
                ))}
            </div>

            <div className="mt-3 flex gap-2 flex-wrap">
              <button className="rounded-2xl border px-3 py-2 hover:bg-white/5 transition" onClick={() => setSteal(gameId, false, null)}>
                Wyłącz
              </button>

              {stealEnabled && stealTeamId && (
                <>
                  <button
                    className="rounded-2xl bg-white text-black px-3 py-2 font-black"
                    onClick={async () => {
                      await awardPoints(gameId, stealTeamId, bank);
                      await setSteal(gameId, false, null);
                      await clearReveals(gameId);
                      await triggerSfx(gameId, "win");
                      await advanceAfterBank();
                    }}
                  >
                    Sukces
                  </button>

                  <button
                    className="rounded-2xl border px-3 py-2 hover:bg-white/5 transition"
                    onClick={async () => {
                      await addStrike(gameId, stealTeamId);
                      await triggerSfx(gameId, "wrong");
                      await setSteal(gameId, false, null);
                      await clearReveals(gameId);
                      await advanceAfterBank();
                    }}
                  >
                    Porażka
                  </button>
                </>
              )}
            </div>
          </Drawer>

          <Drawer
            title="Czas / Reset"
            icon={<TimerIcon size={18} />}
            open={openTime}
            onToggle={() => setOpenTime((v) => !v)}
            right={<Timer running={!!live?.timer?.running} startedAtMs={startedAtMs} durationSec={live?.timer?.durationSec ?? 20} />}
          >
            <div className="grid grid-cols-3 gap-2">
              <button
                className="rounded-2xl border px-3 py-3 font-black hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={() => startTimer(gameId, currentQuestion?.timeLimitSec ?? 20)}
              >
                <PlayIcon size={18} /> Start
              </button>
              <button
                className="rounded-2xl border px-3 py-3 font-black hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={() => stopTimer(gameId)}
              >
                <Square size={18} /> Stop
              </button>
              <button
                className="rounded-2xl border px-3 py-3 font-black hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={() => clearReveals(gameId)}
              >
                <RotateCcw size={18} /> Reset
              </button>
            </div>

            <label className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="opacity-80">Timer na TV</span>
              <input
                type="checkbox"
                checked={live?.timerEnabled ?? false}
                onChange={(e) => setTimerEnabled(gameId, e.target.checked)}
              />
            </label>
          </Drawer>

          <Drawer
            title="Dźwięki (TV)"
            icon={<Volume2 size={18} />}
            open={openSfx}
            onToggle={() => setOpenSfx((v) => !v)}
          >
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border px-3 py-3 font-black hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={() => triggerSfx(gameId, "intro")}
              >
                <Sparkles size={18} /> Intro
              </button>
              <button
                className="rounded-2xl border px-3 py-3 font-black hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={() => triggerSfx(gameId, "reveal")}
              >
                <Zap size={18} /> Reveal
              </button>
              <button
                className="rounded-2xl border px-3 py-3 font-black hover:bg-white/5 transition flex items-center justify-center gap-2"
                onClick={() => triggerSfx(gameId, "wrong")}
              >
                <XCircle size={18} /> Wrong
              </button>
              <button
                className="rounded-2xl bg-white text-black px-3 py-3 font-black hover:opacity-90 transition flex items-center justify-center gap-2"
                onClick={() => triggerSfx(gameId, "win")}
              >
                <Trophy size={18} /> Win
              </button>
            </div>

            <div className="mt-2 text-xs opacity-60">
              Pliki: <b>public/sfx/intro.mp3</b>, <b>reveal.mp3</b>, <b>wrong.mp3</b>, <b>win.mp3</b>
            </div>
          </Drawer>
        </div>
      </div>
    </main>
  );
}