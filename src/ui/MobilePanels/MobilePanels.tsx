import { useId, useState, type ReactNode } from 'react';

/** Below the desktop breakpoint the side columns become two tabs under the grid (docs/03-DESIGN.md §3). */
export function MobilePanels({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const base = useId();
  return (
    <div className="w-full max-w-xl rounded-l border border-line bg-bg-1">
      <div role="tablist" aria-label="Controls" className="flex border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${base}-${t.id}-tab`}
            role="tab"
            type="button"
            aria-selected={t.id === active}
            aria-controls={`${base}-${t.id}`}
            onClick={() => setActive(t.id)}
            className="flex-1 border-b-2 border-transparent px-4 py-2.5 text-sm text-fg-1 aria-selected:border-accent aria-selected:text-fg-0"
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${base}-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-${t.id}-tab`}
          hidden={t.id !== active}
          className="flex flex-col gap-6 p-5"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
