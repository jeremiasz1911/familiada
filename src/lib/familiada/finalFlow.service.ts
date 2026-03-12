import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  setDoc,
  increment,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

export type FinalPhase =
  | "idle"
  | "p1_answer"
  | "p1_review"
  | "p2_answer"
  | "p2_review"
  | "reveal"
  | "done";

export type FinalFlowDoc = {
  phase: FinalPhase;

  questionCount: number; // 5
  targetScore: number; // 200
  currentQuestionIndex: number;

  timer: {
    running: boolean;
    startedAt: any | null;
    durationSec: number; // 20
  };

  inputs: { p1: string[]; p2: string[] };

  // -1 = brak, -2 = poza tablicą
  mapIndex: { p1: number[]; p2: number[] };
  mapPoints: { p1: number[]; p2: number[] };

  // ✅ wspólne odkrywanie po obu graczach
  revealRow: number; // 0..questionCount

  repeat: { p2: boolean[] };

  sums: {
    assignedP1: number;
    assignedP2: number;
    assignedTotal: number;

    revealedP1: number;
    revealedP2: number;
    revealedTotal: number;
  };
};

export function finalFlowRef(gameId: string) {
  return doc(db, "familiadaGames", gameId, "state", "finalFlow");
}

function emptyArray<T>(n: number, fill: T): T[] {
  return Array.from({ length: n }, () => fill);
}

export async function ensureFinalFlow(gameId: string, questionCount = 5, targetScore = 200) {
  const ref = finalFlowRef(gameId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const data: FinalFlowDoc = {
      phase: "idle",
      questionCount,
      targetScore,
      currentQuestionIndex: 0,
      timer: { running: false, startedAt: null, durationSec: 20 },
      inputs: { p1: emptyArray(questionCount, ""), p2: emptyArray(questionCount, "") },
      mapIndex: { p1: emptyArray(questionCount, -1), p2: emptyArray(questionCount, -1) },
      mapPoints: { p1: emptyArray(questionCount, 0), p2: emptyArray(questionCount, 0) },
      revealRow: 0,
      repeat: { p2: emptyArray(questionCount, false) },
      sums: {
        assignedP1: 0,
        assignedP2: 0,
        assignedTotal: 0,
        revealedP1: 0,
        revealedP2: 0,
        revealedTotal: 0,
      },
    };
    await setDoc(ref, data);
    return;
  }

  // ✅ migracja jeśli masz stary dokument (żeby nie było "0 i nie sumuje")
  const d = snap.data() as any;
  const hasRevealRow = typeof d?.revealRow === "number";
  const hasAssignedTotal = typeof d?.sums?.assignedTotal === "number";
  const hasRevealedTotal = typeof d?.sums?.revealedTotal === "number";

  if (!hasRevealRow || !hasAssignedTotal || !hasRevealedTotal) {
    await updateDoc(ref, {
      revealRow: hasRevealRow ? d.revealRow : 0,
      "sums.assignedP1": typeof d?.sums?.assignedP1 === "number" ? d.sums.assignedP1 : 0,
      "sums.assignedP2": typeof d?.sums?.assignedP2 === "number" ? d.sums.assignedP2 : 0,
      "sums.assignedTotal": typeof d?.sums?.assignedTotal === "number" ? d.sums.assignedTotal : 0,
      "sums.revealedP1": typeof d?.sums?.revealedP1 === "number" ? d.sums.revealedP1 : 0,
      "sums.revealedP2": typeof d?.sums?.revealedP2 === "number" ? d.sums.revealedP2 : 0,
      "sums.revealedTotal": typeof d?.sums?.revealedTotal === "number" ? d.sums.revealedTotal : 0,
    });
  }
}

export async function startAnswering(gameId: string, player: "p1" | "p2") {
  const ref = finalFlowRef(gameId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("finalFlow missing");
    const d = snap.data() as FinalFlowDoc;

    const qn = d.questionCount;
    const phase: FinalPhase = player === "p1" ? "p1_answer" : "p2_answer";

    tx.update(ref, {
      phase,
      currentQuestionIndex: 0,
      "timer.running": true,
      "timer.startedAt": serverTimestamp(),
      "timer.durationSec": 20,

      [`inputs.${player}`]: emptyArray(qn, ""),
      [`mapIndex.${player}`]: emptyArray(qn, -1),
      [`mapPoints.${player}`]: emptyArray(qn, 0),

      ...(player === "p2" ? { "repeat.p2": emptyArray(qn, false) } : {}),
    });
  });
}

export async function stopTimer(gameId: string) {
  await updateDoc(finalFlowRef(gameId), { "timer.running": false, "timer.startedAt": null });
}

export async function setPhase(gameId: string, phase: FinalPhase) {
  await updateDoc(finalFlowRef(gameId), { phase });
}

export async function setCurrentQuestionIndex(gameId: string, idx: number) {
  await updateDoc(finalFlowRef(gameId), { currentQuestionIndex: idx });
}

export async function setInput(gameId: string, player: "p1" | "p2", qIndex: number, text: string) {
  await updateDoc(finalFlowRef(gameId), { [`inputs.${player}.${qIndex}`]: text });
}

export async function markRepeat(gameId: string, qIndex: number, value: boolean) {
  await updateDoc(finalFlowRef(gameId), { [`repeat.p2.${qIndex}`]: value });
}

export async function assignMapping(
  gameId: string,
  player: "p1" | "p2",
  qIndex: number,
  answerIndex: number,
  points: number
) {
  const ref = finalFlowRef(gameId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("finalFlow missing");
    const d = snap.data() as FinalFlowDoc;

    if (player === "p2") {
      const p1Idx = d.mapIndex.p1[qIndex];
      if (p1Idx === answerIndex && p1Idx !== -1) {
        throw new Error("Powtórka: gracz 2 nie może mieć tej samej odpowiedzi co gracz 1 w tym pytaniu.");
      }
    }

    const oldPts = Number(d.mapPoints[player][qIndex] ?? 0);
    const nextPts = Number(points ?? 0);
    const delta = nextPts - oldPts;

    const rowAlreadyRevealed = qIndex < (d.revealRow ?? 0);

    tx.update(ref, {
      [`mapIndex.${player}.${qIndex}`]: answerIndex,
      [`mapPoints.${player}.${qIndex}`]: nextPts,
      ...(player === "p2" ? { [`repeat.p2.${qIndex}`]: false } : {}),
    });

    // assigned sums
    if (player === "p1") {
      tx.update(ref, { "sums.assignedP1": increment(delta), "sums.assignedTotal": increment(delta) });
    } else {
      tx.update(ref, { "sums.assignedP2": increment(delta), "sums.assignedTotal": increment(delta) });
    }

    // revealed sums only if that row already revealed
    if (rowAlreadyRevealed && delta !== 0) {
      if (player === "p1") {
        tx.update(ref, { "sums.revealedP1": increment(delta), "sums.revealedTotal": increment(delta) });
      } else {
        tx.update(ref, { "sums.revealedP2": increment(delta), "sums.revealedTotal": increment(delta) });
      }
    }
  });
}

export async function startReveal(gameId: string) {
  await updateDoc(finalFlowRef(gameId), {
    phase: "reveal",
    revealRow: 0,
    "sums.revealedP1": 0,
    "sums.revealedP2": 0,
    "sums.revealedTotal": 0,
  });
}

export async function revealNextRow(gameId: string) {
  const ref = finalFlowRef(gameId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("finalFlow missing");
    const d = snap.data() as FinalFlowDoc;

    const current = d.revealRow ?? 0;
    if (current >= d.questionCount) return;

    const p1Add = Number(d.mapPoints.p1[current] ?? 0);
    const p2Add = Number(d.mapPoints.p2[current] ?? 0);

    tx.update(ref, { revealRow: current + 1 });
    tx.update(ref, {
      "sums.revealedP1": increment(p1Add),
      "sums.revealedP2": increment(p2Add),
      "sums.revealedTotal": increment(p1Add + p2Add),
    });
  });
}

export async function resetFinalFlow(gameId: string) {
  const ref = finalFlowRef(gameId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const d = snap.data() as FinalFlowDoc;
  const qn = d.questionCount;

  await updateDoc(ref, {
    phase: "idle",
    currentQuestionIndex: 0,
    "timer.running": false,
    "timer.startedAt": null,
    "timer.durationSec": 20,

    inputs: { p1: emptyArray(qn, ""), p2: emptyArray(qn, "") },
    mapIndex: { p1: emptyArray(qn, -1), p2: emptyArray(qn, -1) },
    mapPoints: { p1: emptyArray(qn, 0), p2: emptyArray(qn, 0) },

    revealRow: 0,
    repeat: { p2: emptyArray(qn, false) },

    sums: {
      assignedP1: 0,
      assignedP2: 0,
      assignedTotal: 0,
      revealedP1: 0,
      revealedP2: 0,
      revealedTotal: 0,
    },
  });
}