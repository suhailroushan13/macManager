"use client";

import { useEffect, useRef, useState } from "react";

/** Returns true for `durationMs` right after `value` changes — used to flash a card when a whole number rolls over. */
export function useFlashOnChange(value: number, durationMs = 600): boolean {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    prevRef.current = value;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), durationMs);
    return () => clearTimeout(id);
  }, [value, durationMs]);

  return flash;
}
