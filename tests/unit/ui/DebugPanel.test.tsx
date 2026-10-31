import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DebugPanel } from '@/ui/DebugPanel/DebugPanel';
import { MobilePanels } from '@/ui/MobilePanels/MobilePanels';
import { setRuntime } from '@/app/runtime';
import { installFakeRuntime } from '../fakes/runtime';

afterEach(() => {
  vi.useRealTimers();
  setRuntime(null);
});

describe('DebugPanel', () => {
  test('shows audio, latency, voices, limiter and buffers, refreshing while open', () => {
    vi.useFakeTimers();
    const rt = installFakeRuntime();
    const onClose = vi.fn();
    render(<DebugPanel onClose={onClose} />);
    expect(screen.getByText('base latency').nextSibling).toHaveTextContent('5.0 ms');
    expect(screen.getByText('event→schedule').nextSibling).toHaveTextContent(
      /median 0\.00 ms · p95 0\.00 ms \(0\)/,
    );
    rt.ctx.state = 'suspended';
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByText('audio').nextSibling).toHaveTextContent('suspended · 44100 Hz');
    expect(screen.getByText('limiter').nextSibling).toHaveTextContent('0.0 dB reduction');
    fireEvent.click(screen.getByRole('button', { name: 'Close debug panel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('MobilePanels', () => {
  test('switches tabs', () => {
    render(
      <MobilePanels
        tabs={[
          { id: 'a', label: 'First', content: <p>one</p> },
          { id: 'b', label: 'Second', content: <p>two</p> },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('two').closest('[role="tabpanel"]')).not.toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Second' }));
    expect(screen.getByText('two')).toBeVisible();
  });
});
