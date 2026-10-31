import { useKitStore } from '@/state/useKitStore';

export function LoadingBar() {
  const status = useKitStore((s) => s.status);
  const { loaded, total } = useKitStore((s) => s.progress);
  if (status !== 'loading') return null;
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label="Loading kit"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-0.5 w-full bg-bg-2"
    >
      <div className="h-full bg-warn transition-[width] duration-150" style={{ width: `${pct}%` }} />
    </div>
  );
}
