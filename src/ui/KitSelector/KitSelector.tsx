import { useEffect, useId, useRef, useState } from 'react';
import { useKitStore } from '@/state/useKitStore';
import { formatBytes } from '@/ui/KitPanel/KitPanel';

/** Kit dropdown in the status bar (docs/03-DESIGN.md §4.3). Listbox with arrow-key navigation. */
export function KitSelector() {
  const index = useKitStore((s) => s.index);
  const currentKitId = useKitStore((s) => s.currentKitId);
  const manifests = useKitStore((s) => s.manifests);
  const status = useKitStore((s) => s.status);
  const { loaded, total } = useKitStore((s) => s.progress);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const current = index.find((k) => k.id === currentKitId);
  const label =
    status === 'loading'
      ? `Loading… ${total ? Math.round((loaded / total) * 100) : 0}%`
      : (current?.name ?? (status === 'error' ? 'No kit' : '—'));

  const openList = () => {
    setActive(
      Math.max(
        0,
        index.findIndex((k) => k.id === currentKitId),
      ),
    );
    setOpen(true);
    void useKitStore.getState().loadAllManifests();
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const choose = (i: number) => {
    const kit = index[i];
    close();
    if (kit && kit.id !== currentKitId) void useKitStore.getState().switchKit(kit.id);
  };

  // Keep the highlighted kit visible while arrowing through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, listId]);

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    // Keep pad keys (q, w, …) from playing while the list is open.
    e.stopPropagation();
    if (e.key === 'ArrowDown') setActive((a) => Math.min(index.length - 1, a + 1));
    else if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(index.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') choose(active);
    else if (e.key === 'Escape' || e.key === 'Tab') close(e.key === 'Escape');
    else return;
    e.preventDefault();
  };

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            openList();
          }
        }}
        className="flex items-center gap-2 rounded-m border border-transparent px-3 py-1.5 text-sm hover:border-line hover:bg-bg-2"
      >
        <span className="text-fg-2">Kit</span>
        <span className="text-fg-0" data-testid="kit-name">
          {label}
        </span>
        <span aria-hidden="true" className="text-fg-2">
          ▾
        </span>
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label="Drum kits"
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className="absolute top-full left-1/2 z-30 mt-2 max-h-[min(70vh,36rem)] w-[40rem] max-w-[calc(100vw-1rem)] -translate-x-1/2 overflow-y-auto rounded-l border border-line bg-bg-1 p-1 shadow-2xl outline-none"
        >
          {index.map((kit, i) => {
            const m = manifests[kit.id];
            const selected = kit.id === currentKitId;
            return (
              // Keyboard selection is handled by the listbox via aria-activedescendant (onListKey).
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={kit.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                title={kit.description}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-m px-2.5 py-1.5 text-sm ${i === active ? 'bg-bg-3' : ''}`}
              >
                <span aria-hidden="true" className="w-2 shrink-0 text-[10px] text-accent">
                  {selected ? '●' : ''}
                </span>
                <span className="w-52 shrink-0 truncate font-medium text-fg-0">{kit.name}</span>
                <span className="hidden min-w-0 flex-1 truncate text-xs text-fg-2 sm:block">
                  {kit.description}
                </span>
                <span className="ml-auto flex shrink-0 gap-1 font-mono text-[10px] text-fg-1">
                  {kit.baseUrl && (
                    <span
                      className="rounded-s border border-warn/50 px-1 text-warn"
                      title="Built on this computer, not deployed"
                    >
                      local
                    </span>
                  )}
                  {m && (
                    <span
                      className="max-w-24 truncate rounded-s border border-line px-1"
                      title={m.license.name}
                    >
                      {m.license.name}
                    </span>
                  )}
                  <span className="w-14 rounded-s border border-line px-1 text-right">
                    {formatBytes(kit.totalBytes)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
