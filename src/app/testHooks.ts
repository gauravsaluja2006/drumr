import type { Runtime } from './runtime';
import { useKitStore } from '@/state/useKitStore';

declare global {
  interface Window {
    __drumr?: { engine: Runtime['engine']; kitStore: typeof useKitStore; runtime: Runtime };
  }
}

/** Exposes internals to Playwright. Only in `--mode test` builds (docs/05-TESTING.md §3.4). */
export function installTestHooks(runtime: Runtime): void {
  if (import.meta.env.MODE !== 'test' || typeof window === 'undefined') return;
  window.__drumr = { engine: runtime.engine, kitStore: useKitStore, runtime };
}
