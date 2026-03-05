"use client";

import { useEffect, useMemo, useState } from "react";

export function Timer({
  running,
  startedAtMs,
  durationSec,
}: {
  running: boolean;
  startedAtMs: number | null;
  durationSec: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (!running || !startedAtMs) return durationSec;
    const elapsed = (now - startedAtMs) / 1000;
    return Math.max(0, Math.ceil(durationSec - elapsed));
  }, [running, startedAtMs, durationSec, now]);

  return <div className="text-5xl font-black tabular-nums">{remaining}s</div>;
}