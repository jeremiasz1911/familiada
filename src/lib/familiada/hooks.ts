"use client";

import { useEffect, useState } from "react";
import type { DocumentReference, Query } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

export function useDoc<T>(ref: DocumentReference) {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(ref, (snap) => {
      setData(snap.exists() ? ({ id: snap.id, ...(snap.data() as T) } as any) : null);
      setLoading(false);
    });
  }, [ref]);

  return { data, loading };
}

export function useCollection<T>(q: Query) {
  const [data, setData] = useState<Array<T & { id: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(q, (snap) => {
      setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) } as any)));
      setLoading(false);
    });
  }, [q]);

  return { data, loading };
}