import {
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { liveStateRef } from "@/lib/familiada/service";

// =========================
// Collections
// =========================
export const finalPlayersCol = (gameId: string) =>
  collection(db, "familiadaGames", gameId, "finalPlayers");

export const finalQuestionsCol = (gameId: string) =>
  collection(db, "familiadaGames", gameId, "finalQuestions");

// ✅ one collection for all final cells
export const finalResponsesCol = (gameId: string) =>
  collection(db, "familiadaGames", gameId, "finalResponses");

// =========================
// Queries
// =========================
export const finalPlayersQuery = (gameId: string) =>
  query(finalPlayersCol(gameId), orderBy("index", "asc"));

export const finalQuestionsQuery = (gameId: string) =>
  query(finalQuestionsCol(gameId), orderBy("index", "asc"));

export const finalResponsesQueryAll = (gameId: string) =>
  query(
    finalResponsesCol(gameId),
    orderBy("questionIndex", "asc"),
    orderBy("playerIndex", "asc")
  );

// =========================
// Live final state helpers
// =========================
export async function ensureFinalState(gameId: string) {
  const ref = liveStateRef(gameId);
  const snap = await getDoc(ref);
  const data = snap.data() as any;

  if (!data?.final) {
    await updateDoc(ref, {
      final: {
        enabled: false,
        questionId: null,
        activePlayerId: null,
        usedByQuestion: {},
      },
    });
  }
}

export async function setFinalEnabled(gameId: string, enabled: boolean) {
  await updateDoc(liveStateRef(gameId), { "final.enabled": enabled });
}

export async function setFinalQuestion(gameId: string, questionId: string | null) {
  await updateDoc(liveStateRef(gameId), { "final.questionId": questionId });
}

export async function setFinalActivePlayer(gameId: string, playerId: string | null) {
  await updateDoc(liveStateRef(gameId), { "final.activePlayerId": playerId });
}

export async function startFinal(gameId: string, firstQuestionId: string, firstPlayerId: string) {
  await updateDoc(liveStateRef(gameId), {
    "final.enabled": false,
    "final.questionId": firstQuestionId,
    "final.activePlayerId": firstPlayerId,
    "final.usedByQuestion": {},
  });
}

export async function resetFinalQuestion(gameId: string, questionId: string) {
  const ref = liveStateRef(gameId);
  const snap = await getDoc(ref);
  const used = (snap.data()?.final?.usedByQuestion ?? {}) as Record<string, number[]>;

  const next = { ...used };
  delete next[questionId];

  await updateDoc(ref, { "final.usedByQuestion": next });
}

// =========================
// Core: Award cell (questionId + playerId)
// Doc id = `${questionId}_${playerId}`
// - supports editing (overwrites previous for this cell)
// - blocks duplicate answerIndex per question
// - sets revealed=false on change
// =========================
export async function finalAward(
  gameId: string,
  opts: {
    questionId: string;
    playerId: string;
    inputText?: string;
    answerIndex: number;
    points: number;
    playerName: string;
  }
) {
  const { questionId, playerId, inputText, answerIndex, points, playerName } = opts;

  await runTransaction(db, async (tx) => {
    const liveRef = liveStateRef(gameId);

    const qRef = doc(finalQuestionsCol(gameId), questionId);
    const pRef = doc(finalPlayersCol(gameId), playerId);

    const respId = `${questionId}_${playerId}`;
    const respRef = doc(finalResponsesCol(gameId), respId);

    // ✅ READS FIRST
    const [liveSnap, qSnap, pSnap, respSnap] = await Promise.all([
      tx.get(liveRef),
      tx.get(qRef),
      tx.get(pRef),
      tx.get(respRef),
    ]);

    if (!liveSnap.exists()) throw new Error("Brak liveState.");
    if (!qSnap.exists()) throw new Error("Brak pytania finałowego.");
    if (!pSnap.exists()) throw new Error("Brak zawodnika finału.");

    const live = liveSnap.data() as any;
    const qData = qSnap.data() as any;
    const pData = pSnap.data() as any;

    const questionIndex = Number(qData.index ?? 0);
    const playerIndex = Number(pData.index ?? 0);

    const usedByQ = (live?.final?.usedByQuestion ?? {}) as Record<string, number[]>;
    const usedRaw = usedByQ[questionId] ?? [];

    const prevResp = respSnap.exists() ? (respSnap.data() as any) : null;
    const oldAnswerIndex = prevResp?.answerIndex ?? null;
    const oldPoints = Number(prevResp?.points ?? 0);

    // If editing previous cell, free previous answerIndex
    const used = oldAnswerIndex === null ? usedRaw : usedRaw.filter((x: number) => x !== oldAnswerIndex);

    if (used.includes(answerIndex)) {
      throw new Error("Ta odpowiedź z tablicy jest już wykorzystana w tym pytaniu.");
    }

    const nextUsedByQ = { ...usedByQ, [questionId]: [...used, answerIndex] };

    const prevScore = Number(pData.score ?? 0);
    const nextScore = Math.max(0, prevScore - oldPoints + Number(points ?? 0));

    // ✅ WRITES AFTER
    tx.update(liveRef, { "final.usedByQuestion": nextUsedByQ });

    tx.update(pRef, { score: nextScore, updatedAt: serverTimestamp() });

    tx.set(
      respRef,
      {
        questionId,
        questionIndex,
        playerId,
        playerName,
        playerIndex,

        inputText: (inputText ?? "").trim(),
        answerIndex,
        points: Number(points ?? 0),

        revealed: false,

        createdAt: prevResp?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

// Reveal / hide points for a cell
export async function setFinalReveal(
  gameId: string,
  questionId: string,
  playerId: string,
  revealed: boolean
) {
  const respId = `${questionId}_${playerId}`;
  await updateDoc(doc(finalResponsesCol(gameId), respId), {
    revealed,
    updatedAt: serverTimestamp(),
  });
}