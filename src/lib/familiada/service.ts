import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Answer } from "./types";

// pomocnicze refy
const teamRef = (gameId: string, teamId: string) =>
  doc(db, "familiadaGames", gameId, "teams", teamId);

// 1) Ustaw wynik ręcznie
export async function setTeamScore(gameId: string, teamId: string, score: number) {
  await updateDoc(teamRef(gameId, teamId), { score: Math.max(0, Math.floor(score)) });
}

// 2) Zmień wynik o delta (np. -5, +10)
export async function adjustTeamScore(gameId: string, teamId: string, delta: number) {
  await runTransaction(db, async (tx) => {
    const ref = teamRef(gameId, teamId);
    const snap = await tx.get(ref);
    const prev = (snap.data()?.score ?? 0) as number;
    const next = Math.max(0, prev + delta);
    tx.update(ref, { score: next });
  });
}

// 3) Reset wyniku drużyny
export async function resetTeamScore(gameId: string, teamId: string) {
  await updateDoc(teamRef(gameId, teamId), { score: 0 });
}

// 4) Reset wszystkich wyników
export async function resetAllTeamScores(gameId: string, teamIds: string[]) {
  await runTransaction(db, async (tx) => {
    for (const id of teamIds) tx.update(teamRef(gameId, id), { score: 0 });
  });
}

// 7) UNDO ostatniego banku
export async function undoLastAward(gameId: string) {
  const liveRef = liveStateRef(gameId);

  await runTransaction(db, async (tx) => {
    const liveSnap = await tx.get(liveRef);
    const last = liveSnap.data()?.lastAward as
      | { teamId: string; points: number }
      | null
      | undefined;

    if (!last?.teamId || !last?.points) return;

    const tRef = teamRef(gameId, last.teamId);
    const tSnap = await tx.get(tRef);
    const prev = (tSnap.data()?.score ?? 0) as number;
    const next = Math.max(0, prev - last.points);

    tx.update(tRef, { score: next });
    tx.update(liveRef, { lastAward: null });
  });
}

// 8) UNDO ostatniego X
export async function undoLastStrike(gameId: string) {
  const liveRef = liveStateRef(gameId);

  await runTransaction(db, async (tx) => {
    const liveSnap = await tx.get(liveRef);
    const last = liveSnap.data()?.lastStrike as
      | { teamId: string; prev: number }
      | null
      | undefined;

    if (!last?.teamId) return;

    const strikes = (liveSnap.data()?.strikesByTeam ?? {}) as Record<string, number>;
    tx.update(liveRef, {
      strikesByTeam: { ...strikes, [last.teamId]: Math.max(0, Math.min(3, last.prev ?? 0)) },
      lastStrike: null,
    });
  });
}

export function gameRef(gameId: string) {
  return doc(db, "familiadaGames", gameId);
}
export function teamsCol(gameId: string) {
  return collection(db, "familiadaGames", gameId, "teams");
}
export function roundsCol(gameId: string) {
  return collection(db, "familiadaGames", gameId, "rounds");
}
export function questionsCol(gameId: string, roundId: string) {
  return collection(db, "familiadaGames", gameId, "rounds", roundId, "questions");
}
export function liveStateRef(gameId: string) {
  return doc(db, "familiadaGames", gameId, "state", "live");
}

export async function createGame(title: string, ownerUid = "local-dev") {
  const ref = await addDoc(collection(db, "familiadaGames"), {
    title,
    ownerUid,
    status: "setup",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    timerEnabled: false,
    activeTeamId: null,
    sfx: { name: null, at: null },
  });

  await setDoc(liveStateRef(ref.id), {
    currentRoundId: null,
    currentQuestionId: null,
    revealedIdx: [],
    strikesByTeam: {},
    timer: { running: false, startedAt: null, durationSec: 20 },
    steal: { enabled: false, teamId: null },
  });

  return ref.id;
}

export async function addTeam(gameId: string, name: string, members: string[]) {
  await addDoc(teamsCol(gameId), {
    name,
    members,
    score: 0,
    createdAt: serverTimestamp(),
  });
}

export async function addRound(gameId: string, data: { index: number; title: string; multiplier: number; type: "normal" | "final" }) {
  await addDoc(roundsCol(gameId), { ...data, createdAt: serverTimestamp() });
}

export async function addQuestion(
  gameId: string,
  roundId: string,
  data: { index: number; text: string; timeLimitSec: number; answers: Answer[] }
) {
  await addDoc(questionsCol(gameId, roundId), { ...data, createdAt: serverTimestamp() });
}

export async function setCurrentQuestion(gameId: string, roundId: string, questionId: string) {
  await updateDoc(liveStateRef(gameId), {
    currentRoundId: roundId,
    currentQuestionId: questionId,
    revealedIdx: [],
    "timer.running": false,
    "timer.startedAt": null,
  });
}

export async function toggleReveal(gameId: string, idx: number) {
  const ref = liveStateRef(gameId);
  const snap = await getDoc(ref);
  const revealed: number[] = (snap.data()?.revealedIdx ?? []) as number[];

  if(!revealed.includes(idx)) await triggerSfx(gameId, "reveal");
    

  const next = revealed.includes(idx)
    ? revealed.filter((x) => x !== idx)
    : Array.from(new Set([...revealed, idx]));

  await updateDoc(ref, { revealedIdx: next });
}

export async function clearReveals(gameId: string) {
  await updateDoc(liveStateRef(gameId), { revealedIdx: [] });
}

// 5) Podmień awardPoints tak, żeby zapisywało lastAward (UNDO)
export async function awardPoints(gameId: string, teamId: string, points: number) {
  const liveRef = liveStateRef(gameId);

  await runTransaction(db, async (tx) => {
    const tRef = teamRef(gameId, teamId);
    const tSnap = await tx.get(tRef);
    const prev = (tSnap.data()?.score ?? 0) as number;

    tx.update(tRef, { score: prev + points });
    tx.update(liveRef, {
      lastAward: { teamId, points, at: serverTimestamp() },
    });
  });
}

// Zmień addStrike tak, żeby robił cap do 3
// 6) Podmień addStrike tak, żeby zapisywało lastStrike (UNDO)
export async function addStrike(gameId: string, teamId: string) {
  const ref = liveStateRef(gameId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const strikes = (snap.data()?.strikesByTeam ?? {}) as Record<string, number>;
    const prev = strikes[teamId] ?? 0;
    const next = Math.min(3, prev + 1);

    tx.update(ref, {
      strikesByTeam: { ...strikes, [teamId]: next },
      lastStrike: { teamId, prev, next, at: serverTimestamp() },
    });
  });
}

export async function startTimer(gameId: string, durationSec: number) {
  await updateDoc(liveStateRef(gameId), {
    timer: { running: true, startedAt: serverTimestamp(), durationSec },
  });
}

export async function stopTimer(gameId: string) {
  await updateDoc(liveStateRef(gameId), { "timer.running": false });
}

export const roundsQuery = (gameId: string) => query(roundsCol(gameId), orderBy("index", "asc"));
export const teamsQuery = (gameId: string) => query(teamsCol(gameId), orderBy("createdAt", "asc"));
export const questionsQuery = (gameId: string, roundId: string) =>
  query(questionsCol(gameId, roundId), orderBy("index", "asc"));


export async function setActiveTeam(gameId: string, teamId: string | null) {
  await updateDoc(liveStateRef(gameId), {
    activeTeamId: teamId,
  });
}

export async function setTimerEnabled(gameId: string, enabled: boolean) {
  await updateDoc(liveStateRef(gameId), {
    timerEnabled: enabled,
  });
}

export async function resetStrikes(gameId: string, teamId: string) {
  const ref = liveStateRef(gameId);
  const snap = await getDoc(ref);
  const strikes = (snap.data()?.strikesByTeam ?? {}) as Record<string, number>;
  await updateDoc(ref, {
    strikesByTeam: { ...strikes, [teamId]: 0 },
  });
}
export async function setSteal(gameId: string, enabled: boolean, teamId: string | null) {
  await updateDoc(liveStateRef(gameId), {
    steal: { enabled, teamId },
  });
}

export async function triggerSfx(gameId: string, name: "reveal" | "wrong" | "intro" | "win" | "won") {
  await updateDoc(liveStateRef(gameId), {
    sfx: { name, at: serverTimestamp() },
  });
}

export async function resetForNewRound(gameId: string) {
  await updateDoc(liveStateRef(gameId), {
    revealedIdx: [],
    strikesByTeam: {},                 // reset X dla wszystkich
    steal: { enabled: false, teamId: null }, // reset przejęcia
    "timer.running": false,
    "timer.startedAt": null,
  });
}

export async function showRoundOverlay(gameId: string, text: string, durationMs = 2500) {
  await updateDoc(liveStateRef(gameId), {
    overlay: {
      type: "round",
      text,
      at: serverTimestamp(),
      durationMs,
    },
  });
}