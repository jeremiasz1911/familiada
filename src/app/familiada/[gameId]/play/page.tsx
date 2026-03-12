"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  doc,
  increment,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  ArrowLeft,
  ArrowRight,
  Monitor,
  Menu,
  Volume2,
  RotateCcw,
  X,
  Minus,
  Plus,
  HandCoins,
  Users,
  Shuffle,
  Timer as TimerIcon,
  Trash2,
  Undo2,
} from "lucide-react";

import { db } from "@/lib/firebase/client";

import { useCollection, useDoc } from "@/lib/familiada/hooks";
import {
  liveStateRef,
  roundsQuery,
  teamsQuery,
  setCurrentQuestion,
  clearReveals,
  toggleReveal,
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
} from "@/lib/familiada/service";

import type { LiveStateDoc, RoundDoc, TeamDoc, QuestionDoc } from "@/lib/familiada/types";

import { AnswerControlList } from "@/components/familiada/AnswerControlList";
import { Timer } from "@/components/familiada/Timer";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

function toNum(x: any, fallback = 0) {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
  variant = "secondary",
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive";
}) {
  return (
    <Button
      type="button"
      title={title}
      variant={variant}
      size="icon"
      disabled={disabled}
      onClick={onClick}
      className="h-11 w-11 rounded-2xl"
    >
      {children}
    </Button>
  );
}

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  // LIVE
  const liveRef = useMemo(() => liveStateRef(gameId), [gameId]);
  const { data: live } = useDoc<LiveStateDoc>(liveRef);

  // jeśli finał ON -> kontrola finału
  useEffect(() => {
    if (!live) return;
    if ((live as any)?.final?.enabled) {
      router.replace(`/familiada/${gameId}/final/play`);
    }
  }, [live, (live as any)?.final?.enabled, router, gameId]);

  // ROUNDS / TEAMS
  const rq = useMemo(() => roundsQuery(gameId), [gameId]);
  const { data: roundsRaw } = useCollection<RoundDoc>(rq);
  const rounds = useMemo(
    () => [...roundsRaw].sort((a: any, b: any) => toNum(a.index) - toNum(b.index)),
    [roundsRaw]
  );

  const tq = useMemo(() => teamsQuery(gameId), [gameId]);
  const { data: teamsRaw } = useCollection<TeamDoc>(tq);
  const teams = useMemo(() => [...teamsRaw], [teamsRaw]);

  // current round + indices
  const currentRoundIndex = useMemo(() => {
    if (!live?.currentRoundId) return -1;
    return rounds.findIndex((r) => r.id === live.currentRoundId);
  }, [rounds, live?.currentRoundId]);

  const currentRound = currentRoundIndex >= 0 ? rounds[currentRoundIndex] : null;

  // questions query for current round
  const questionsQ = useMemo(() => {
    if (!live?.currentRoundId) return null;
    return query(
      collection(db, "familiadaGames", gameId, "rounds", live.currentRoundId, "questions"),
      orderBy("index", "asc")
    );
  }, [gameId, live?.currentRoundId]);

  const { data: questionsRaw } = useCollection<QuestionDoc>(questionsQ as any);
  const questions = useMemo(
    () => [...questionsRaw].sort((a: any, b: any) => toNum(a.index) - toNum(b.index)),
    [questionsRaw]
  );

  const currentQuestionIndex = useMemo(() => {
    if (!live?.currentQuestionId) return -1;
    return questions.findIndex((q) => q.id === live.currentQuestionId);
  }, [questions, live?.currentQuestionId]);

  // current question doc (no conditional hooks)
  const questionRef = useMemo(() => {
    if (!live?.currentRoundId || !live?.currentQuestionId) return null;
    return doc(db, "familiadaGames", gameId, "rounds", live.currentRoundId, "questions", live.currentQuestionId);
  }, [gameId, live?.currentRoundId, live?.currentQuestionId]);

  const { data: currentQuestion } = useDoc<QuestionDoc>(questionRef as any);

  // init round if empty
  useEffect(() => {
    if (!live) return;
    if (live.currentRoundId) return;
    if (!rounds.length) return;
    setCurrentQuestion(gameId, rounds[0].id, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.currentRoundId, rounds.length, gameId]);

  // init first question in round
  useEffect(() => {
    if (!live?.currentRoundId) return;
    if (!questions.length) return;
    const firstQId = questions[0]?.id ?? null;
    if (!firstQId) return;

    const ok = !!live.currentQuestionId && questions.some((q) => q.id === live.currentQuestionId);
    if (!ok) setCurrentQuestion(gameId, live.currentRoundId, firstQId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, live?.currentRoundId, questions.length, live?.currentQuestionId]);

  // ACTIVE / SELECTED
  const strikesByTeam = (live as any)?.strikesByTeam ?? {};
  const activeTeamId = (live as any)?.activeTeamId ?? teams[0]?.id ?? null;
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedTeamId && teams[0]?.id) setSelectedTeamId(teams[0].id);
  }, [selectedTeamId, teams]);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  const activeStrikes = activeTeamId ? (strikesByTeam[activeTeamId] ?? 0) : 0;

  // STEAL
  const stealEnabled = !!(live as any)?.steal?.enabled;
  const stealTeamId = (live as any)?.steal?.teamId ?? null;
  const stealTeam = teams.find((t) => t.id === stealTeamId) ?? null;

  // revealed / bank
  const revealedIdx = (live as any)?.revealedIdx ?? [];
  const multiplier = (currentRound as any)?.multiplier ?? 1;

  const baseSum =
    (currentQuestion?.answers ?? [])
      .map((a, idx) => (revealedIdx.includes(idx) ? a.points : 0))
      .reduce((a, b) => a + b, 0);

  const bank = baseSum * multiplier;

  // timer (ukryty w menu)
  const timerEnabled = !!(live as any)?.timerEnabled;
  const startedAtMs = (live as any)?.timer?.startedAt?.toMillis ? (live as any).timer.startedAt.toMillis() : null;

  // ---------- QUICK NAV ----------
  const prevRoundId = currentRoundIndex > 0 ? rounds[currentRoundIndex - 1].id : null;
  const nextRoundId = currentRoundIndex >= 0 && currentRoundIndex < rounds.length - 1 ? rounds[currentRoundIndex + 1].id : null;

  const prevQId = currentQuestionIndex > 0 ? questions[currentQuestionIndex - 1].id : null;
  const nextQId = currentQuestionIndex >= 0 && currentQuestionIndex < questions.length - 1 ? questions[currentQuestionIndex + 1].id : null;

  // ---------- actions ----------
  async function goToRound(roundId: string) {
    const r = rounds.find((x) => x.id === roundId);

    // jeśli runda finalowa -> tylko flip switch (screen przełączy się sam)
    if ((r as any)?.type === "final") {
      await updateDoc(liveStateRef(gameId), { "final.enabled": true } as any);
      router.replace(`/familiada/${gameId}/final/play`);
      return;
    }

    await resetForNewRound(gameId);
    await setCurrentQuestion(gameId, roundId, "");
    await clearReveals(gameId);
    await showRoundOverlay(gameId, ((r as any)?.title ?? "RUNDA").toUpperCase(), 900);
    await triggerSfx(gameId, "intro");
  }

  async function goToQuestion(questionId: string) {
    if (!live?.currentRoundId) return;
    await setCurrentQuestion(gameId, live.currentRoundId, questionId);
    await clearReveals(gameId);
  }

  async function bankToActive() {
    if (!activeTeamId || !bank) return;
    await awardPoints(gameId, activeTeamId, bank);
    await triggerSfx(gameId, "win");
  }

  async function addX() {
    if (!activeTeamId) return;
    await addStrike(gameId, activeTeamId);
    await triggerSfx(gameId, "wrong");
  }

  // ✅ cofnij X (minus 1) dla aktywnej drużyny
  async function undoX() {
    if (!activeTeamId) return;
    const cur = Number(strikesByTeam?.[activeTeamId] ?? 0);
    const next = Math.max(0, cur - 1);
    await updateDoc(liveStateRef(gameId), { [`strikesByTeam.${activeTeamId}`]: next } as any);
  }

  async function resetRevealsOnly() {
    await clearReveals(gameId);
  }

  async function startSteal(teamId: string) {
    await setSteal(gameId, true, teamId);
  }
  async function stealSuccess() {
    if (!stealTeamId || !bank) return;
    await awardPoints(gameId, stealTeamId, bank);
    await triggerSfx(gameId, "win");
    await setSteal(gameId, false, null);
    await clearReveals(gameId);
  }
  async function stealFail() {
    if (!stealTeamId) return;
    const cur = Number(strikesByTeam?.[stealTeamId] ?? 0);
    await updateDoc(liveStateRef(gameId), { [`strikesByTeam.${stealTeamId}`]: cur + 1 } as any);
    await triggerSfx(gameId, "wrong");
    await setSteal(gameId, false, null);
    await clearReveals(gameId);
  }

  async function resetBoardSoft() {
    await clearReveals(gameId);
    await setSteal(gameId, false, null);
    await updateDoc(liveStateRef(gameId), { strikesByTeam: {} } as any);
  }

  // ---------- manual scoring + undo ----------
  const [setScoreValue, setSetScoreValue] = useState<string>("0");
  const [deltaValue, setDeltaValue] = useState<string>("10");
  const [lastScoreUndo, setLastScoreUndo] = useState<Record<string, number>>({});

  useEffect(() => {
    if (selectedTeam?.score != null) setSetScoreValue(String(selectedTeam.score ?? 0));
  }, [selectedTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setTeamScore(teamId: string, score: number) {
    const prev = teams.find((t) => t.id === teamId)?.score ?? 0;
    setLastScoreUndo((m) => ({ ...m, [teamId]: prev }));
    await updateDoc(doc(db, "familiadaGames", gameId, "teams", teamId), {
      score: Math.max(0, Number(score) || 0),
    });
  }

  async function addTeamScore(teamId: string, delta: number) {
    const prev = teams.find((t) => t.id === teamId)?.score ?? 0;
    setLastScoreUndo((m) => ({ ...m, [teamId]: prev }));
    await updateDoc(doc(db, "familiadaGames", gameId, "teams", teamId), {
      score: increment(Number(delta) || 0),
    });
  }

  async function undoScore(teamId: string) {
    const prev = lastScoreUndo[teamId];
    if (prev === undefined) return;
    await updateDoc(doc(db, "familiadaGames", gameId, "teams", teamId), { score: prev });
  }

  async function hardResetGame() {
    const batch = writeBatch(db);

    for (const t of teams) {
      batch.update(doc(db, "familiadaGames", gameId, "teams", t.id), { score: 0 });
    }

    batch.update(liveStateRef(gameId), {
      revealedIdx: [],
      strikesByTeam: {},
      activeTeamId: teams[0]?.id ?? null,
      steal: { enabled: false, teamId: null },
      timerEnabled: false,
      timer: { running: false, startedAt: null, durationSec: 20 },
      final: { enabled: false },
    } as any);

    await batch.commit();
    await triggerSfx(gameId, "intro");
  }

  // ---------- UI ----------
  const roundLabel = currentRound ? `R${(currentRound as any).index + 1}` : "R—";
  const qLabel = currentQuestionIndex >= 0 ? `Q${currentQuestionIndex + 1}` : "Q—";

  return (
    <main className="p-3 md:p-6 max-w-4xl mx-auto">
      {/* Compact top bar (minimal text) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className="rounded-xl">{roundLabel}</Badge>
          <Badge variant="secondary" className="rounded-xl">{qLabel}</Badge>
          <div className="truncate text-sm opacity-80">
            {currentQuestion?.text ?? "—"}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <IconBtn title="TV (/screen)" onClick={() => window.open(`/familiada/${gameId}/screen`, "_blank", "noopener,noreferrer")}>
            <Monitor size={18} />
          </IconBtn>

          <IconBtn title="SFX Intro" onClick={() => triggerSfx(gameId, "intro")}>
            <Volume2 size={18} />
          </IconBtn>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="icon" className="h-11 w-11 rounded-2xl" title="Menu">
                <Menu size={18} />
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-[95vw] sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Menu prowadzącego</DialogTitle>
              </DialogHeader>

              <Accordion type="multiple" defaultValue={["teams"]} className="space-y-3">
                {/* NAV */}
                <AccordionItem value="nav" className="border border-white/10 rounded-2xl px-3">
                  <AccordionTrigger>Nawigacja (rundy / pytania)</AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm opacity-70 truncate">
                        Runda: <b>{(currentRound as any)?.title ?? "—"}</b>
                      </div>
                      <div className="flex gap-2">
                        <IconBtn title="Poprzednia runda" onClick={() => prevRoundId && goToRound(prevRoundId)} disabled={!prevRoundId}>
                          <ArrowLeft size={18} />
                        </IconBtn>
                        <IconBtn title="Następna runda" onClick={() => nextRoundId && goToRound(nextRoundId)} disabled={!nextRoundId}>
                          <ArrowRight size={18} />
                        </IconBtn>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {rounds.map((r) => (
                        <Button
                          key={r.id}
                          size="sm"
                          variant={r.id === live?.currentRoundId ? "default" : "secondary"}
                          onClick={() => goToRound(r.id)}
                          className="rounded-2xl"
                        >
                          {(r as any).index + 1}
                        </Button>
                      ))}
                    </div>

                    <Separator className="bg-white/10" />

                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm opacity-70 truncate">Pytanie: <b>{currentQuestion?.text ?? "—"}</b></div>
                      <div className="flex gap-2">
                        <IconBtn title="Poprzednie pytanie" onClick={() => prevQId && goToQuestion(prevQId)} disabled={!prevQId}>
                          <ArrowLeft size={18} />
                        </IconBtn>
                        <IconBtn title="Następne pytanie" onClick={() => nextQId && goToQuestion(nextQId)} disabled={!nextQId}>
                          <ArrowRight size={18} />
                        </IconBtn>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {questions.map((q, idx) => (
                        <Button
                          key={q.id}
                          size="sm"
                          variant={q.id === live?.currentQuestionId ? "default" : "secondary"}
                          onClick={() => goToQuestion(q.id)}
                          className="rounded-2xl"
                        >
                          {idx + 1}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* TEAMS + MANUAL SCORE */}
                <AccordionItem value="teams" className="border border-white/10 rounded-2xl px-3">
                  <AccordionTrigger>Drużyny + punkty</AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-3">
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge className="bg-amber-200 text-black rounded-xl">
                        ACTIVE: {activeTeam?.name ?? "—"} (X:{activeStrikes})
                      </Badge>
                      <Badge variant="secondary" className="rounded-xl">
                        SELECTED: {selectedTeam?.name ?? "—"}
                      </Badge>
                      <Badge variant="secondary" className="rounded-xl">
                        BANK: {bank}
                      </Badge>
                    </div>

                    <div className="grid gap-2">
                      {teams
                        .slice()
                        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                        .map((t) => {
                          const isActive = t.id === activeTeamId;
                          const isSel = t.id === selectedTeamId;
                          return (
                            <div key={t.id} className={["rounded-2xl border p-3 bg-black/20", isActive ? "border-amber-200/35" : "border-white/10"].join(" ")}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">
                                    {t.name}
                                    {isActive && <span className="ml-2 text-amber-200">●</span>}
                                    {isSel && !isActive && <span className="ml-2 opacity-60">●</span>}
                                  </div>
                                  <div className="text-xs opacity-70">X: {strikesByTeam?.[t.id] ?? 0}</div>
                                </div>
                                <div className="text-2xl font-black tabular-nums text-amber-200">{t.score ?? 0}</div>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => setSelectedTeamId(t.id)} className="rounded-2xl">
                                  Select
                                </Button>
                                <Button size="sm" onClick={() => setActiveTeam(gameId, t.id)} className="rounded-2xl">
                                  Active
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => bank && awardPoints(gameId, t.id, bank)} disabled={!bank} className="rounded-2xl">
                                  Bank→
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => undoScore(t.id)}
                                  disabled={lastScoreUndo[t.id] === undefined}
                                  className="rounded-2xl"
                                  title="Cofnij ostatnią zmianę punktów tej drużyny"
                                >
                                  <Undo2 className="mr-2 h-4 w-4" /> Undo
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <Separator className="bg-white/10" />

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Users size={18} className="opacity-70" />
                        <div className="font-semibold truncate">
                          Ręczna korekta: <span className="text-amber-200">{selectedTeam?.name ?? "—"}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <div className="text-xs opacity-70">SET</div>
                          <Input value={setScoreValue} onChange={(e) => setSetScoreValue(e.target.value)} inputMode="numeric" />
                          <Button className="w-full rounded-2xl" onClick={() => selectedTeamId && setTeamScore(selectedTeamId, Number(setScoreValue))} disabled={!selectedTeamId}>
                            Ustaw
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs opacity-70">Δ</div>
                          <Input value={deltaValue} onChange={(e) => setDeltaValue(e.target.value)} inputMode="numeric" />
                          <div className="grid grid-cols-2 gap-2">
                            <Button className="rounded-2xl" variant="secondary" onClick={() => selectedTeamId && addTeamScore(selectedTeamId, Number(deltaValue))} disabled={!selectedTeamId}>
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button className="rounded-2xl" variant="secondary" onClick={() => selectedTeamId && addTeamScore(selectedTeamId, -Number(deltaValue))} disabled={!selectedTeamId}>
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* STEAL */}
                <AccordionItem value="steal" className="border border-white/10 rounded-2xl px-3">
                  <AccordionTrigger>Przejęcie (STEAL)</AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-3">
                    {!stealEnabled ? (
                      <div className="space-y-2">
                        <div className="text-sm opacity-70">Wybierz drużynę, która przejmuje BANK.</div>
                        <div className="flex flex-wrap gap-2">
                          {teams.filter((t) => t.id !== activeTeamId).map((t) => (
                            <Button key={t.id} variant="secondary" className="rounded-2xl" onClick={() => startSteal(t.id)}>
                              <Shuffle className="mr-2 h-4 w-4" /> {t.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Badge className="bg-amber-200 text-black rounded-xl">
                          STEAL: {stealTeam?.name ?? "—"} • BANK: {bank}
                        </Badge>

                        <div className="grid grid-cols-2 gap-2">
                          <Button className="rounded-2xl bg-amber-200 text-black hover:bg-amber-200/90" onClick={stealSuccess} disabled={!stealTeamId || !bank}>
                            DOBRZE
                          </Button>
                          <Button className="rounded-2xl" variant="secondary" onClick={stealFail} disabled={!stealTeamId}>
                            ŹLE
                          </Button>
                        </div>

                        <Button className="rounded-2xl" variant="secondary" onClick={() => setSteal(gameId, false, null)}>
                          Anuluj
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                    
                {/* TIMER + SFX + RESET */}
                <AccordionItem value="tools" className="border border-white/10 rounded-2xl px-3">
                  <AccordionTrigger>Narzędzia (timer / reset / sfx)</AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <TimerIcon size={18} className="opacity-70" />
                        <div className="font-semibold">Timer</div>
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={timerEnabled} onChange={(e) => setTimerEnabled(gameId, e.target.checked)} />
                        Pokazuj na TV
                      </label>

                      <div className="flex items-center justify-between gap-2">
                        <Timer running={!!(live as any)?.timer?.running} startedAtMs={startedAtMs} durationSec={(live as any)?.timer?.durationSec ?? 20} />
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" className="rounded-2xl" onClick={() => startTimer(gameId, 20)}>Start</Button>
                          <Button size="sm" variant="secondary" className="rounded-2xl" onClick={() => stopTimer(gameId)}>Stop</Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="rounded-2xl" onClick={() => triggerSfx(gameId, "reveal")}>
                        <Volume2 className="mr-2 h-4 w-4" /> Reveal
                      </Button>
                      <Button variant="secondary" className="rounded-2xl" onClick={() => triggerSfx(gameId, "wrong")}>
                        <X className="mr-2 h-4 w-4" /> Wrong
                      </Button>
                      <Button variant="secondary" className="rounded-2xl" onClick={() => triggerSfx(gameId, "win")}>
                        <HandCoins className="mr-2 h-4 w-4" /> Win
                      </Button>
                      <Button variant="secondary" className="rounded-2xl" onClick={() => triggerSfx(gameId, "intro")}>
                        <Volume2 className="mr-2 h-4 w-4" /> Intro
                      </Button>
                    </div>

                    <Separator className="bg-white/10" />

                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="rounded-2xl" onClick={resetBoardSoft}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Reset tablicy
                      </Button>
                      <Button variant="secondary" className="rounded-2xl" onClick={resetRevealsOnly}>
                        Reset odkryć
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 space-y-2">
                      <div className="font-semibold flex items-center gap-2">
                        <Trash2 size={18} /> HARD RESET
                      </div>
                      <div className="text-sm opacity-80">
                        Zeruje punkty, X, steal, odkrycia i <b>wyłącza finał</b> (TV wraca do rund).
                      </div>
                      <Button className="rounded-2xl bg-red-500/80 hover:bg-red-500 text-white" onClick={hardResetGame}>
                        HARD RESET
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* MAIN: answers + bottom action bar */}
      <div className="mt-3 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">


            <div className="flex items-center justify-between gap-2">
              <div className="text-sm opacity-70 truncate">
                Runda: <b>{(currentRound as any)?.title ?? "—"}</b>
              </div>
              <div className="flex gap-2">
                <IconBtn title="Poprzednia runda" onClick={() => prevRoundId && goToRound(prevRoundId)} disabled={!prevRoundId}>
                  <ArrowLeft size={18} />
                </IconBtn>
                <IconBtn title="Następna runda" onClick={() => nextRoundId && goToRound(nextRoundId)} disabled={!nextRoundId}>
                  <ArrowRight size={18} />
                </IconBtn>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {rounds.map((r) => (
                <Button
                  key={r.id}
                  size="sm"
                  variant={r.id === live?.currentRoundId ? "default" : "secondary"}
                  onClick={() => goToRound(r.id)}
                  className="rounded-2xl"
                >
                  {(r as any).index + 1}
                </Button>
              ))}
            </div>

            <Separator className="bg-white/10" />

            <div className="flex items-center justify-between gap-2">
              <div className="text-sm opacity-70 truncate">Pytanie: <b>{currentQuestion?.text ?? "—"}</b></div>
              <div className="flex gap-2">
                <IconBtn title="Poprzednie pytanie" onClick={() => prevQId && goToQuestion(prevQId)} disabled={!prevQId}>
                  <ArrowLeft size={18} />
                </IconBtn>
                <IconBtn title="Następne pytanie" onClick={() => nextQId && goToQuestion(nextQId)} disabled={!nextQId}>
                  <ArrowRight size={18} />
                </IconBtn>
              </div>
            </div>

       

          <div className="flex ">

            <div className="flex items-center gap-2">
              <div className="gap-2 justify-between w-100 items-center bg ">
                {teams
                  .slice()
                  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                  .map((t) => {
                    const isActive = t.id === activeTeamId;
                    const isSel = t.id === selectedTeamId;
                    return (
                      <Badge
                        key={t.id}
                      
                        onClick={() => setActiveTeam(gameId,t.id)}
                        className={[
                          "rounded-2xl border bg-sky-950 p-3 text-left transition active:scale-[0.99]",
                          "bg-white/5 hover:bg-white/10 bg-gray-300 hover:bg-gray-400/30 cursor-pointer",
                          isActive ? "border-amber-200/50 shadow-[0_0_45px_rgba(255,210,80,0.16)]" : "border-white/10",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2 ">
                          <div className="min-w-0">
                            <div className="font-semibold truncate ">
                              {t.name}
                              {isActive && <span className="ml-2 text-amber-200">●</span>}
                              {isSel && !isActive && <span className="ml-2 opacity-60">●</span>}
                            </div>
                            
                          </div>
                          <div className="text-2xl font-black tabular-nums text-amber-200">
                            {t.score ?? 0}
                          </div>
                        </div>
                      </Badge>
                    );
                  })}
              </div>
              <Badge className="bg-amber-200 text-black rounded-xl ">
                BANK {bank}
              </Badge>
            </div>
          </div>

          <Separator className="my-3 bg-white/10" />

          <AnswerControlList
            answers={currentQuestion?.answers ?? []}
            revealedIdx={revealedIdx}
            onToggle={(idx) => toggleReveal(gameId, idx)}
          />
        </div>

        {/* Bottom bar (thumb controls) */}
        <div className="sticky bottom-2 z-10">
          <div className="rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-2 flex items-center gap-2">
            <Button
              className="flex-1 rounded-2xl bg-amber-200 text-black hover:bg-amber-200/90 h-12"
              onClick={bankToActive}
              disabled={!activeTeamId || !bank}
              title="Przyznaj BANK aktywnej drużynie"
            >
              BANK
            </Button>

            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-2xl"
              onClick={addX}
              disabled={!activeTeamId}
              title="Dodaj X aktywnej drużynie"
            >
              <X size={18} />
            </Button>

            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-2xl"
              onClick={undoX}
              disabled={!activeTeamId || activeStrikes <= 0}
              title="Cofnij X (usuń jeden błąd)"
            >
              <Minus size={18} />
            </Button>

            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 rounded-2xl"
              onClick={resetRevealsOnly}
              title="Reset odkryć"
            >
              <RotateCcw size={18} />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}