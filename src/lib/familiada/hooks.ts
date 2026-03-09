"use client";

import { useEffect, useState } from "react";
import type { DocumentReference, Query, Unsubscribe } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

type WithId<T> = T & { id: string };

type DocState<T> = {
  data: WithId<T> | null;
  loading: boolean;
  error: Error | null;
};

type ColState<T> = {
  data: Array<WithId<T>>;
  loading: boolean;
  error: Error | null;
};

export function useDoc<T>(ref: DocumentReference | null): DocState<T> {
  const key = ref ? `${ref.firestore.app.name}:${ref.path}` : "null";

  const [state, setState] = useState<DocState<T>>({
    data: null,
    loading: !!ref,
    error: null,
  });

  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let unsub: Unsubscribe | undefined;

    // ustaw loading tylko raz na zmianę key
    setState((s) => (s.loading ? s : { ...s, loading: true, error: null }));

    unsub = onSnapshot(
      ref,
      (snap) => {
        setState({
          data: snap.exists()
            ? ({ id: snap.id, ...(snap.data() as T) } as WithId<T>)
            : null,
          loading: false,
          error: null,
        });
      },
      (err) => setState({ data: null, loading: false, error: err })
    );

    return () => unsub?.();
  }, [key]); // <- UWAGA: zależność po "key", nie po "ref"

  return state;
}

export function useCollection<T>(q: Query | null): ColState<T> {
  const [state, setState] = useState<ColState<T>>({
    data: [],
    loading: !!q,
    error: null,
  });

  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }

    let unsub: Unsubscribe | undefined;
    setState((s) => (s.loading ? s : { ...s, loading: true, error: null }));

    unsub = onSnapshot(
      q,
      (snap) => {
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) } as WithId<T>)),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ data: [], loading: false, error: err })
    );

    return () => unsub?.();
  }, [q]);

  return state;
}