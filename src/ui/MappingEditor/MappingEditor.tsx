import { useEffect, useId, useRef, useState } from 'react';
import { useMappingStore } from '@/state/useMappingStore';
import { useUiStore } from '@/state/useUiStore';
import { useMidiStore } from '@/state/useMidiStore';
import { captureNextNote } from '@/app/controller';
import { padIndex } from '@/mapping/schema';
import { VOICE_FAMILIES, voiceLabel, type Voice } from '@/mapping/voices';
import { Dialog } from '@/ui/primitives/Dialog';

export const LEARN_TIMEOUT_MS = 10_000;

const btn =
  'rounded-m border border-line px-2.5 py-1.5 text-xs text-fg-1 hover:bg-bg-3 hover:text-fg-0 disabled:opacity-60 disabled:hover:bg-transparent';
const field = 'rounded-s border border-line bg-bg-2 px-2 py-1.5 text-sm text-fg-0';

function slug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'mapping'
  );
}

/** Pad mapping editor (docs/03-DESIGN.md §4.7). Replaces the right column while editing. */
export function MappingEditor() {
  const mapping = useMappingStore((s) => s.mapping);
  const presetId = useMappingStore((s) => s.presetId);
  const customPresets = useMappingStore((s) => s.customPresets);
  const store = useMappingStore.getState;
  const { selectedPad, learning, setLearning, setEditing } = useUiStore();
  const midiStatus = useMidiStore((s) => s.status);
  const [naming, setNaming] = useState<null | 'save' | 'rename'>(null);
  const [name, setName] = useState('');
  const [learnMessage, setLearnMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[] | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (naming) nameInput.current?.focus();
  }, [naming]);
  const ids = { note: useId(), voice: useId(), label: useId(), name: useId() };

  const pad =
    selectedPad === null ? undefined : mapping.pads.find((p) => padIndex(mapping, p) === selectedPad);
  const isCustom = customPresets.some((p) => p.id === presetId);

  // MIDI learn: next note-on from the controller becomes this pad's note, or give up after 10 s.
  useEffect(() => {
    if (!learning || selectedPad === null) return;
    const cancel = captureNextNote((note) => {
      store().updatePad(selectedPad, { note });
      setLearnMessage(`Learned note ${note}.`);
      setLearning(false);
    });
    const timer = setTimeout(() => {
      cancel();
      setLearnMessage('No pad was hit within 10 seconds.');
      setLearning(false);
    }, LEARN_TIMEOUT_MS);
    return () => {
      cancel();
      clearTimeout(timer);
    };
  }, [learning, selectedPad, setLearning, store]);

  const exportJson = () => {
    const blob = new Blob([store().exportMapping()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `drumr-mapping-${slug(mapping.name)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    const result = store().importMapping(await file.text());
    if (!result.ok) setIssues(result.issues);
    if (fileInput.current) fileInput.current.value = '';
  };

  const commitName = () => {
    if (naming === 'save') store().saveAsPreset(name);
    else if (naming === 'rename') store().renamePreset(presetId, name);
    setNaming(null);
  };

  return (
    <div className="flex flex-col gap-6" data-testid="mapping-editor">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Edit layout</h2>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-m bg-accent px-3 py-1.5 text-xs font-semibold text-bg-0 hover:bg-accent-2"
        >
          Done
        </button>
      </div>

      <section aria-label="Layout presets" className="flex flex-col gap-2">
        <p className="truncate text-sm text-fg-0">{mapping.name}</p>
        {naming ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              commitName();
            }}
          >
            <label htmlFor={ids.name} className="sr-only">
              Layout name
            </label>
            <input
              id={ids.name}
              ref={nameInput}
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              className={`${field} min-w-0 flex-1`}
            />
            <button type="submit" className={btn}>
              {naming === 'save' ? 'Save' : 'Rename'}
            </button>
            <button type="button" className={btn} onClick={() => setNaming(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={btn}
              onClick={() => {
                setName(isCustom ? `${mapping.name} copy` : 'My layout');
                setNaming('save');
              }}
            >
              Save as…
            </button>
            {isCustom && (
              <>
                <button
                  type="button"
                  className={btn}
                  onClick={() => {
                    setName(mapping.name);
                    setNaming('rename');
                  }}
                >
                  Rename
                </button>
                <button type="button" className={btn} onClick={() => store().deletePreset(presetId)}>
                  Delete
                </button>
              </>
            )}
            <button type="button" className={btn} onClick={() => store().resetToPreset()}>
              Reset
            </button>
          </div>
        )}
      </section>

      <section
        aria-label="Selected pad"
        className="flex flex-col gap-3 rounded-l border border-line bg-bg-2/50 p-4"
      >
        {pad && selectedPad !== null ? (
          <>
            <h3 className="text-xs font-semibold tracking-wider text-fg-2 uppercase">
              Pad {selectedPad + 1}
            </h3>
            <div className="flex items-end gap-2">
              <label htmlFor={ids.note} className="flex flex-1 flex-col gap-1 text-xs text-fg-1">
                MIDI note
                <input
                  id={ids.note}
                  type="number"
                  min={0}
                  max={127}
                  value={pad.note}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 0 && n <= 127)
                      store().updatePad(selectedPad, { note: n });
                  }}
                  className={`${field} font-mono`}
                />
              </label>
              <button
                type="button"
                aria-pressed={learning}
                disabled={midiStatus !== 'connected' && !learning}
                title={midiStatus !== 'connected' ? 'Connect a MIDI controller to learn notes' : undefined}
                onClick={() => {
                  setLearnMessage(null);
                  setLearning(!learning);
                }}
                className={`${btn} ${learning ? 'border-accent text-accent' : ''}`}
              >
                {learning ? 'Listening…' : 'Learn'}
              </button>
            </div>
            <p aria-live="polite" className="min-h-4 text-xs text-fg-1">
              {learning ? 'Hit a pad on your controller.' : learnMessage}
            </p>
            <label htmlFor={ids.voice} className="flex flex-col gap-1 text-xs text-fg-1">
              Sound
              <select
                id={ids.voice}
                value={pad.voice}
                onChange={(e) => store().updatePad(selectedPad, { voice: e.target.value as Voice })}
                className={field}
              >
                {Object.entries(VOICE_FAMILIES).map(([family, voices]) => (
                  <optgroup key={family} label={family}>
                    {voices.map((v) => (
                      <option key={v} value={v}>
                        {voiceLabel(v)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label htmlFor={ids.label} className="flex flex-col gap-1 text-xs text-fg-1">
              Label
              <input
                id={ids.label}
                value={pad.label ?? ''}
                maxLength={24}
                placeholder={voiceLabel(pad.voice)}
                onChange={(e) => store().updatePad(selectedPad, { label: e.target.value })}
                className={field}
              />
            </label>
          </>
        ) : (
          <p className="text-sm text-fg-1">Select a pad on screen or hit one on your controller.</p>
        )}
      </section>

      <section aria-label="Import and export" className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={exportJson}>
          Export JSON
        </button>
        <button type="button" className={btn} onClick={() => fileInput.current?.click()}>
          Import JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Import mapping file"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void importJson(e.target.files?.[0])}
        />
      </section>

      <Dialog open={issues !== null} title="Couldn’t import that mapping" onClose={() => setIssues(null)}>
        <p className="text-fg-1">Nothing was changed. Fix these problems and try again:</p>
        <ul
          className="flex list-disc flex-col gap-1 pl-5 font-mono text-xs text-fg-0"
          data-testid="import-issues"
        >
          {issues?.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
