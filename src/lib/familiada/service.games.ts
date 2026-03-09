import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function listGames() {
  const q = query(collection(db, "familiadaGames"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function renameGame(gameId: string, title: string) {
  await updateDoc(doc(db, "familiadaGames", gameId), {
    title,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteGame(gameId: string) {
  // Uwaga: to usuwa tylko dokument gry. Subkolekcje wymagają Cloud Function
  // (albo ręcznego kasowania). Na MVP — zostawmy bez delete.
  await deleteDoc(doc(db, "familiadaGames", gameId));
}