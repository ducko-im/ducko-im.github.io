export type Listener<T> = (state: T, previous: T) => void;

export interface Store<T> {
  getState(): T;
  update(fn: (state: T) => T): void;
  subscribe(listener: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    getState: () => state,
    update(fn) {
      const previous = state;
      state = fn(state);
      if (state !== previous) listeners.forEach((listener) => listener(state, previous));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
