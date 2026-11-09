import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useUiStore } from '@/state/useUiStore';

const ITEM =
  'flex w-full items-center justify-between gap-6 rounded-s px-3 py-2 text-left text-sm text-fg-1 outline-none hover:bg-bg-3 hover:text-fg-0 focus-visible:bg-bg-3 focus-visible:text-fg-0';

/**
 * Header overflow menu (docs/03-DESIGN.md §4.2): About & licences. Arrow keys
 * move between items, Escape or a click outside closes and returns focus to the button.
 */
export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const setAboutOpen = useUiStore((s) => s.setAboutOpen);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex size-[30px] items-center justify-center rounded-full border border-line text-fg-1 hover:bg-bg-3 hover:text-fg-0 aria-expanded:bg-bg-3 aria-expanded:text-fg-0"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label="More"
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-30 mt-2 w-60 rounded-m border border-line bg-bg-2 p-1 shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => choose(() => setAboutOpen(true))}
          >
            About &amp; licences
          </button>
          <p className="border-t border-line px-3 pt-2 pb-1.5 text-xs text-fg-2">
            Web MIDI · Web Audio · open-licence drum samples
          </p>
        </div>
      )}
    </div>
  );
}
