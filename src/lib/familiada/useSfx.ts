"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type SfxName = "reveal" | "wrong" | "intro" | "win";

const FILES: Record<SfxName, string> = {
  reveal: "/sfx/reveal.mp3",
  wrong: "/sfx/wrong.mp3",
  intro: "/sfx/intro.mp3",
  win: "/sfx/win.mp3",
};

export function useSfx(defaultEnabled = false) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const audioRef = useRef<Partial<Record<SfxName, HTMLAudioElement>>>({});

  const preload = useCallback(() => {
    (Object.keys(FILES) as SfxName[]).forEach((k) => {
      if (!audioRef.current[k]) {
        const a = new Audio(FILES[k]);
        a.preload = "auto";
        audioRef.current[k] = a;
      }
    });
  }, []);

  const play = useCallback(
    (name: SfxName) => {
      if (!enabled) return;
      const a = audioRef.current[name];
      if (!a) return;
      try {
        a.currentTime = 0;
        void a.play();
      } catch {}
    },
    [enabled]
  );

  const enableWithUserGesture = useCallback(() => {
    // iOS/Safari wymaga “user gesture” – to jest ten moment.
    preload();
    setEnabled(true);
    // możesz odpalić intro od razu:
    setTimeout(() => play("intro"), 50);
  }, [play, preload]);

  return useMemo(
    () => ({ enabled, setEnabled, play, preload, enableWithUserGesture }),
    [enabled, play, preload, enableWithUserGesture]
  );
}