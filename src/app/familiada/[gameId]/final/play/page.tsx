"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useCollection, useDoc } from "@/lib/familiada/hooks";
import { liveStateRef, triggerSfx } from "@/lib/familiada/service";
import { finalPlayersQuery, finalQuestionsQuery, setFinalEnabled } from "@/lib/familiada/final.service";

import type { LiveStateDoc, FinalPlayerDoc, FinalQuestionDoc } from "@/lib/familiada/types";
import type { FinalFlowDoc } from "@/lib/familiada/finalFlow.service";

import {
  finalFlowRef,
  ensureFinalFlow,
  startAnswering,
  stopTimer,
  setPhase,
  setCurrentQuestionIndex,
  setInput,
  assignMapping,
  markRepeat,
  startReveal,
  revealNextRow,
  resetFinalFlow,
} from "@/lib/familiada/finalFlow.service";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FinalPlayPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;

  const { data: live } = useDoc<LiveStateDoc>(useMemo(() => liveStateRef(gameId), [gameId]));
  const { data: flow } = useDoc<FinalFlowDoc>(useMemo(() => finalFlowRef(gameId), [gameId]));

  const { data: playersAll } = useCollection<FinalPlayerDoc>(useMemo(() => finalPlayersQuery(gameId), [gameId]));
  const { data: questionsAll } = useCollection<FinalQuestionDoc>(useMemo(() => finalQuestionsQuery(gameId), [gameId]));

  const players = playersAll.slice(0, 2);
  const questions = questionsAll.slice(0, 5);

  useEffect(() => {
    ensureFinalFlow(gameId, 5, 200);
  }, [gameId]);

  useEffect(() => {
    if (!live) return; // ważne, żeby nie było "flash i powrót"
    if (live.final?.enabled === false) {
      router.replace(`/familiada/${gameId}/play`);
    }
  }, [live?.final?.enabled, router, gameId]);

  const phase = flow?.phase ?? "idle";
  const qIndex = flow?.currentQuestionIndex ?? 0;
  const target = flow?.targetScore ?? 200;

  const assignedTotal = flow?.sums?.assignedTotal ?? 0;
  const revealedTotal = flow?.sums?.revealedTotal ?? 0;

  const p1Name = players[0]?.name ?? "Gracz 1";
  const p2Name = players[1]?.name ?? "Gracz 2";

  const answeringPlayer: "p1" | "p2" = phase.startsWith("p2") ? "p2" : "p1";
  const answeringName = answeringPlayer === "p1" ? p1Name : p2Name;

  const inputValue = flow?.inputs?.[answeringPlayer]?.[qIndex] ?? "";
  const p1TextThis = flow?.inputs?.p1?.[qIndex]?.trim().toLowerCase() ?? "";
  const p2TextThis = flow?.inputs?.p2?.[qIndex]?.trim().toLowerCase() ?? "";
  const isRepeatText = answeringPlayer === "p2" && p1TextThis && p2TextThis && p1TextThis === p2TextThis;

  const [manualPoints, setManualPoints] = useState<number[]>(Array(5).fill(0));


  async function enableFinal() {
    await setFinalEnabled(gameId, true);
    await triggerSfx(gameId, "intro");
  }

  async function disableFinal() {
    await setFinalEnabled(gameId, false);
    await resetFinalFlow(gameId);
    router.replace(`/familiada/${gameId}/play`);
  }

  async function startP1() {
    await enableFinal();
    await startAnswering(gameId, "p1");
  }

  async function nextAnswerQuestion() {
    const last = 4;

    if (answeringPlayer === "p2" && isRepeatText) {
      await markRepeat(gameId, qIndex, true);
      return;
    }

    if (qIndex >= last) {
      await stopTimer(gameId);
      await setPhase(gameId, answeringPlayer === "p1" ? "p1_review" : "p2_review");
      await triggerSfx(gameId, "intro");
      return;
    }

    await setCurrentQuestionIndex(gameId, qIndex + 1);
  }

  async function startP2() {
    await startAnswering(gameId, "p2");
  }

  async function finishP1ReviewGoP2() {
    await setPhase(gameId, "p2_answer");
    await startP2();
  }

  async function goReveal() {
    await startReveal(gameId);
    await triggerSfx(gameId, "intro");
  }

  async function finishFinal() {
    await setPhase(gameId, "done");
    await triggerSfx(gameId, revealedTotal >= target ? "win" : "wrong");
  }
 
  return (
    <main className="p-4 md:p-6 max-w-3xl mx-auto">
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl">Finał – kontrola</CardTitle>
              <div className="text-sm opacity-70 truncate">{p1Name} vs {p2Name}</div>
            </div>

            <div className="flex gap-2 shrink-0">
              {!live?.final?.enabled ? (
                <Button onClick={enableFinal}>Włącz finał</Button>
              ) : (
                <Button variant="secondary" onClick={disableFinal}>
                  Wyłącz
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">phase: {phase}</Badge>
            <Badge variant="secondary">cel: {target}</Badge>
            <Badge variant="secondary">assigned: {assignedTotal}</Badge>
            <Badge className="bg-amber-200 text-black">revealed: {revealedTotal}</Badge>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={startP1} disabled={players.length < 2 || questions.length < 5}>
              Start gracz 1 (20s)
            </Button>
            <Button variant="secondary" onClick={() => resetFinalFlow(gameId)}>
              Reset flow
            </Button>
            <Button variant="secondary" onClick={() => window.open(`/familiada/${gameId}/final/screen`, "_blank")}>
              TV finału
            </Button>
            <Button variant="secondary" onClick={() => triggerSfx(gameId, "intro")}>
              SFX Intro
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Accordion type="multiple" defaultValue={["answer", "review", "reveal"]} className="space-y-3">
            {/* ANSWER */}
            <AccordionItem value="answer" className="border border-white/10 rounded-2xl px-3">
              <AccordionTrigger>Odpowiadanie (20s)</AccordionTrigger>
              <AccordionContent className="pb-4">
                {(phase === "p1_answer" || phase === "p2_answer") ? (
                  <div className="grid gap-3">
                    <div className="text-sm">
                      Odpowiada: <b className="text-amber-200">{answeringName}</b> • pytanie <b>{qIndex + 1}/5</b>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                      {questions[qIndex]?.text ?? "—"}
                    </div>

                    <Input
                      placeholder="Wpisz odpowiedź…"
                      value={inputValue}
                      onChange={(e) => setInput(gameId, answeringPlayer, qIndex, e.target.value)}
                    />

                    {answeringPlayer === "p2" && (isRepeatText || (flow?.repeat?.p2?.[qIndex] ?? false)) && (
                      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm">
                        Powtórka! Gracz 2 musi podać inną odpowiedź.
                      </div>
                    )}

                    <div className="flex gap-2 flex-wrap">
                      {answeringPlayer === "p2" && (
                        <Button variant="secondary" onClick={() => markRepeat(gameId, qIndex, true)}>
                          POWTÓRKA (zaznacz)
                        </Button>
                      )}
                      <Button onClick={nextAnswerQuestion}>Dalej</Button>
                      <Button variant="secondary" onClick={() => stopTimer(gameId)}>
                        Stop timer
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm opacity-70">Aktywne w fazie p1_answer / p2_answer.</div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* REVIEW */}
            <AccordionItem value="review" className="border border-white/10 rounded-2xl px-3">
              <AccordionTrigger>Ocena (dopasowanie + punkty)</AccordionTrigger>
              <AccordionContent className="pb-4">
                {(phase === "p1_review" || phase === "p2_review") ? (
                  <div className="grid gap-3">
                    <div className="text-sm">
                      Oceniasz:{" "}
                      <b className="text-amber-200">{phase === "p1_review" ? p1Name : p2Name}</b>
                    </div>

                    <div className="grid gap-3">
                      {questions.map((q, i) => {
                        const player: "p1" | "p2" = phase === "p1_review" ? "p1" : "p2";
                        const inputText = flow?.inputs?.[player]?.[i] ?? "";
                        const selected = flow?.mapIndex?.[player]?.[i] ?? -1;
                        const p1Selected = flow?.mapIndex?.p1?.[i] ?? -1;

                        return (
                          <div key={q.id} className="rounded-2xl border border-white/10 bg-black/20 p-3 grid gap-2">
                            <div className="text-sm font-semibold">#{i + 1} — {q.text}</div>
                            <div className="text-sm opacity-80">odpowiedź: <b>{inputText || "—"}</b></div>

                            <Select
                              value={String(selected)}
                              onValueChange={(v) => {
                                const idx = Number(v);
                                if (!Number.isFinite(idx)) return;

                                if (idx === -1) {
                                  assignMapping(gameId, player, i, -1, 0).catch((e: any) => alert(e?.message ?? "Błąd"));
                                  return;
                                }

                                if (idx === -2) {
                                  const pts = manualPoints[i] ?? 0;
                                  assignMapping(gameId, player, i, -2, pts).catch((e: any) => alert(e?.message ?? "Błąd"));
                                  return;
                                }

                                const pts = q.answers?.[idx]?.points ?? 0;
                                assignMapping(gameId, player, i, idx, pts).catch((e: any) => alert(e?.message ?? "Błąd"));
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={String(-1)}>Nie przypisano…</SelectItem>
                                <SelectItem value={String(-2)}>Poza tablicą (ręczne punkty)</SelectItem>
                                {(q.answers ?? []).map((a, idx) => (
                                  <SelectItem
                                    key={idx}
                                    value={String(idx)}
                                    disabled={player === "p2" && p1Selected === idx && p1Selected !== -1}
                                  >
                                    #{idx + 1} — {a.text} ({a.points})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {selected === -2 && (
                              <div className="flex items-center gap-2">
                                <div className="text-xs opacity-70">Punkty</div>
                                <Input
                                  className="w-28"
                                  inputMode="numeric"
                                  value={String(manualPoints[i] ?? 0)}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    setManualPoints((arr) => {
                                      const next = [...arr];
                                      next[i] = Number.isFinite(n) ? n : 0;
                                      return next;
                                    });
                                  }}
                                />
                              </div>
                            )}

                            {player === "p2" && selected >= 0 && p1Selected === selected && (
                              <div className="text-sm text-red-200">Powtórka (nie wolno) — wybierz inną odpowiedź.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {phase === "p1_review" ? (
                        <Button onClick={finishP1ReviewGoP2}>Start gracz 2 (20s)</Button>
                      ) : (
                        <Button onClick={goReveal}>Start odkrywania (po 2 graczach)</Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm opacity-70">Aktywne w fazie p1_review / p2_review.</div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* REVEAL */}
            <AccordionItem value="reveal" className="border border-white/10 rounded-2xl px-3">
              <AccordionTrigger>Odkrywanie (po obu graczach)</AccordionTrigger>
              <AccordionContent className="pb-4">
                {phase === "reveal" ? (
                  <div className="grid gap-3">
                    <div className="text-sm opacity-70">
                      Odkryte wiersze: <b>{flow?.revealRow ?? 0}/5</b>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => revealNextRow(gameId)}>Odkryj następny wiersz</Button>
                      <Button variant="secondary" onClick={finishFinal}>
                        Zakończ finał
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm opacity-70">Aktywne w fazie reveal.</div>
                )}
              </AccordionContent>
            </AccordionItem>

            {/* DONE */}
            <AccordionItem value="done" className="border border-white/10 rounded-2xl px-3">
              <AccordionTrigger>Wynik</AccordionTrigger>
              <AccordionContent className="pb-4">
                {phase === "done" ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-2xl font-black">
                      {revealedTotal >= target ? "✅ WYGRALI FINAŁ!" : "❌ NIE UDAŁO SIĘ"}
                    </div>
                    <div className="mt-2 opacity-80">
                      Revealed: <b className="text-amber-200">{revealedTotal}</b> / {target}
                    </div>
                    <div className="mt-1 text-sm opacity-60">Assigned: {assignedTotal}</div>
                  </div>
                ) : (
                  <div className="text-sm opacity-70">Pojawi się po zakończeniu finału.</div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </main>
  );
}