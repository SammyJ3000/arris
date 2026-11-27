import type { Live, Unsubscribe } from "./source";

/** A small observable value. Sources use it for every live read. The methods
 * are arrow properties so they can be handed straight to useSyncExternalStore
 * without losing `this`. */
export class LiveValue<T> implements Live<T> {
  private listeners = new Set<() => void>();
  private value: T;

  constructor(initial: T) {
    this.value = initial;
  }

  get = (): T => this.value;

  set = (next: T): void => {
    if (Object.is(next, this.value)) return;
    this.value = next;
    for (const l of Array.from(this.listeners)) l();
  };

  update = (fn: (current: T) => T): void => {
    this.set(fn(this.value));
  };

  subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
