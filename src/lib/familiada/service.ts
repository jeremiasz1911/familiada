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
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { Answer } from "./types";

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
  });

  await setDoc(liveStateRef(ref.id), {
    currentRoundId: null,
    currentQuestionId: null,
    revealedIdx: [],
    strikesByTeam: {},
    timer: { running: false, startedAt: null, durationSec: 20 },
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

  const next = revealed.includes(idx)
    ? revealed.filter((x) => x !== idx)
    : Array.from(new Set([...revealed, idx]));

  await updateDoc(ref, { revealedIdx: next });
}

export async function clearReveals(gameId: string) {
  await updateDoc(liveStateRef(gameId), { revealedIdx: [] });
}

export async function awardPoints(gameId: string, teamId: string, points: number) {
  await updateDoc(doc(db, "familiadaGames", gameId, "teams", teamId), {
    score: increment(points),
  });
}

export async function addStrike(gameId: string, teamId: string) {
  const ref = liveStateRef(gameId);
  const snap = await getDoc(ref);
  const strikes = (snap.data()?.strikesByTeam ?? {}) as Record<string, number>;
  await updateDoc(ref, {
    strikesByTeam: { ...strikes, [teamId]: (strikes[teamId] ?? 0) + 1 },
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