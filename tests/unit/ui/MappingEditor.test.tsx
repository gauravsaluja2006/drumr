import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MappingEditor, LEARN_TIMEOUT_MS } from '@/ui/MappingEditor/MappingEditor';
import { handleMidi } from '@/app/controller';
import { setRuntime } from '@/app/runtime';
import { useMappingStore } from '@/state/useMappingStore';
import { useUiStore } from '@/state/useUiStore';
import { useMidiStore } from '@/state/useMidiStore';
import { useKitStore } from '@/state/useKitStore';
import { padIndex } from '@/mapping/schema';
import { installFakeRuntime } from '../fakes/runtime';

const initialMapping = useMappingStore.getState();
const noteOn = (note: number) => handleMidi({ type: 'noteon', channel: 1, note, velocity: 100 }, 0);
const padAt = (i: number) => {
  const m = useMappingStore.getState().mapping;
  return m.pads.find((p) => padIndex(m, p) === i)!;
};

beforeEach(async () => {
  localStorage.clear();
  useMappingStore.setState({ ...initialMapping, customPresets: [] });
  useMappingStore.getState().setPreset('maschine-logic');
  useMidiStore.setState({
    status: 'connected',
    inputs: [{ id: 'm', name: 'Maschine' }],
    selectedId: 'm',
    error: null,
  });
  useUiStore.getState().setEditing(true);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  installFakeRuntime();
  await useKitStore.getState().init();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useUiStore.getState().setEditing(false);
  setRuntime(null);
});

describe('MappingEditor', () => {
  test('P5: MappingEditor learn assigns the next note-on and times out after 10 s', () => {
    vi.useFakeTimers();
    render(<MappingEditor />);
    expect(screen.getByText(/Select a pad/)).toBeInTheDocument();
    act(() => noteOn(24)); // hitting a controller pad in edit mode selects it
    expect(screen.getByRole('heading', { name: 'Pad 13' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Learn' }));
    expect(screen.getByRole('button', { name: 'Listening…' })).toHaveAttribute('aria-pressed', 'true');
    act(() => noteOn(60));
    expect(padAt(12).note).toBe(60);
    expect(screen.getByText('Learned note 60.')).toBeInTheDocument();
    expect(useUiStore.getState().learning).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Learn' }));
    act(() => vi.advanceTimersByTime(LEARN_TIMEOUT_MS - 1));
    expect(useUiStore.getState().learning).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(useUiStore.getState().learning).toBe(false);
    expect(screen.getByText('No pad was hit within 10 seconds.')).toBeInTheDocument();
    act(() => noteOn(25)); // after timeout notes play and select again, nothing is learned
    expect(padAt(12).note).toBe(60);
    expect(useUiStore.getState().selectedPad).toBe(13);
    expect(LEARN_TIMEOUT_MS).toBe(10_000);
  });

  test('edits note, sound and label; Learn is disabled without a device', () => {
    useUiStore.getState().selectPad(12);
    render(<MappingEditor />);
    fireEvent.change(screen.getByLabelText('MIDI note'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('MIDI note'), { target: { value: '400' } }); // ignored
    fireEvent.change(screen.getByLabelText('Sound'), { target: { value: 'cowbell' } });
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Bell' } });
    expect(padAt(12)).toMatchObject({ note: 40, voice: 'cowbell', label: 'Bell' });
    act(() => useMidiStore.setState({ status: 'no-device' }));
    expect(screen.getByRole('button', { name: 'Learn' })).toBeDisabled();
  });

  test('save as, rename, delete, reset, and Done', () => {
    render(<MappingEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Save as…' }));
    const name = screen.getByLabelText('Layout name');
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: 'Practice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useMappingStore.getState().mapping.name).toBe('Practice');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Layout name'), { target: { value: 'Practice 2' } });
    fireEvent.submit(screen.getByLabelText('Layout name').closest('form')!);
    expect(useMappingStore.getState().mapping.name).toBe('Practice 2');
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useMappingStore.getState().customPresets).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(useUiStore.getState().editing).toBe(false);
  });

  test('import shows readable issues in a dialog and export downloads a file', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: (u: string) => urls.push(u) }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<MappingEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    expect(click).toHaveBeenCalled();
    expect(urls).toEqual(['blob:x']);

    const input = screen.getByLabelText('Import mapping file') as HTMLInputElement;
    const file = new File(['{"schemaVersion": 2}'], 'bad.json', { type: 'application/json' });
    await act(async () => fireEvent.change(input, { target: { files: [file] } }));
    expect(screen.getByRole('dialog', { name: 'Couldn’t import that mapping' })).toBeInTheDocument();
    expect(screen.getByTestId('import-issues').textContent).toMatch(/schemaVersion/);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    click.mockRestore();
  });
});
