import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/client";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const gameSnap = await getDoc(doc(db, "familiadaGames", gameId));
  if (!gameSnap.exists()) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const teamsSnap = await getDocs(collection(db, "familiadaGames", gameId, "teams"));
  const roundsSnap = await getDocs(collection(db, "familiadaGames", gameId, "rounds"));
  const liveSnap = await getDoc(doc(db, "familiadaGames", gameId, "state", "live"));

  const rounds = roundsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const questionsByRound: Record<string, any[]> = {};

  for (const r of rounds) {
    const qs = await getDocs(collection(db, "familiadaGames", gameId, "rounds", r.id, "questions"));
    questionsByRound[r.id] = qs.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  const payload = {
    game: { id: gameId, ...(gameSnap.data() as any) },
    teams: teamsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
    rounds,
    questionsByRound,
    live: liveSnap.exists() ? (liveSnap.data() as any) : null,
  };

  return NextResponse.json(payload);
}