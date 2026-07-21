"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SECONDS_PER_PERCENT } from "@/lib/battery-timing";

const TICK_MS = 400;
const STEPS_PER_PERCENT = (SECONDS_PER_PERCENT * 1000) / TICK_MS;
const STEP_SIZE = 0.99 / STEPS_PER_PERCENT;

interface TickerState {
  tick: number;
  baseActual: number;
}

let tickerState: TickerState = { tick: 0, baseActual: 0 };
const listeners = new Set<() => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function ensureTicker() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    tickerState = { ...tickerState, tick: tickerState.tick + 1 };
    emit();
  }, TICK_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureTicker();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return tickerState;
}

function resetTickerFor(actual: number) {
  if (tickerState.baseActual !== actual) {
    tickerState = { tick: 0, baseActual: actual };
    emit();
  }
}

/**
 * Shows the real percentage instantly whenever it changes, then cosmetically creeps the
 * decimal part .00 -> .99 over SECONDS_PER_PERCENT (the measured time it takes this Mac to
 * gain 1%), never backward. Driven by one shared global ticker so every instance (widget,
 * donut, battery page) ticks the same number in lockstep.
 */
export function useAnimatedPercentage(actual: number, active: boolean): string {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => ({ tick: 0, baseActual: actual }));

  useEffect(() => {
    resetTickerFor(actual);
  }, [actual]);

  if (!active) return String(Math.round(actual));

  const synced = snapshot.baseActual === actual ? snapshot.tick : 0;
  const creep = Math.min(0.99, synced * STEP_SIZE);
  return (actual + creep).toFixed(2);
}
