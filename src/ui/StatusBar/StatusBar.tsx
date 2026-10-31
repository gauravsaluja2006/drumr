export function StatusBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-bg-1 px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
        />
        <h1 className="text-base font-semibold">Drumr</h1>
      </div>
      <div className="hidden text-sm text-fg-1 sm:block">
        <span className="text-fg-2">Kit</span> <span className="ml-1">No kit loaded</span>
      </div>
      <div
        className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-fg-1"
        aria-live="polite"
      >
        <span aria-hidden="true" className="size-2 rounded-full border border-fg-2" />
        <span>MIDI: no device</span>
      </div>
    </header>
  );
}
