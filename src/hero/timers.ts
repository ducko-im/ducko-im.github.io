export interface Timers {
  schedule(owner: string, delayMs: number, fn: () => void): void;
  cancelOwner(owner: string): void;
}

export function createTimers(): Timers {
  const byOwner = new Map<string, Set<ReturnType<typeof setTimeout>>>();
  return {
    schedule(owner, delayMs, fn) {
      const handles = byOwner.get(owner) ?? new Set();
      byOwner.set(owner, handles);
      const handle = setTimeout(() => {
        handles.delete(handle);
        fn();
      }, delayMs);
      handles.add(handle);
    },
    cancelOwner(owner) {
      byOwner.get(owner)?.forEach(clearTimeout);
      byOwner.delete(owner);
    },
  };
}
