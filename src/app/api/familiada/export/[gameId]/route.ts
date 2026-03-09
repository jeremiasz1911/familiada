import { NextResponse } from "next/server";
import { db } from "@/lib/firebase/client";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

export async function GET(_: Request, { params }: { params: { gameId: string } }) {
  const gameId = params.gameId;

  const gameSnap = await getDoc(doc(db, "familiadaGames", gameId));
  if (!gameSnap.exists()) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const teamsSnap = await getDocs(collection(db, "familiadaGames", gameId, "teams"));
  const roundsSnap = await getDocs(collection(db, "familiadaGames", gameId, "rounds"));
  const liveSnap = await getDoc(doc(db, "familiadaGames", gameId, "state", "live"));

  // pytania per runda
  const rounds = roundsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const questionsByRound: Record<string, any[]> = {};

  for (const r of rounds) {
    const qs = await getDocs(collection(db, "familiadaGames", gameId, "rounds", r.id, "questions"));
    questionsByRound[r.id] = qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  const payload = {
    game: { id: gameId, ...gameSnap.data() },
    teams: teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
    rounds,
    questionsByRound,
    live: liveSnap.exists() ? liveSnap.data() : null,
  };

  return NextResponse.json(payload);
}