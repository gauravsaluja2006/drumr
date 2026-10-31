import { useEffect } from 'react';
import { Dialog } from '@/ui/primitives/Dialog';
import { useKitStore } from '@/state/useKitStore';

const STACK = [
  'TypeScript',
  'React',
  'Web MIDI',
  'Web Audio',
  'Zustand',
  'Zod',
  'Tailwind',
  'Vite',
  'Vitest',
  'Playwright',
];
const FLOW = ['Pad controller', 'Web MIDI', 'Pad mapping', 'Web Audio sampler', 'Speakers'];

export function About({ open, onClose }: { open: boolean; onClose: () => void }) {
  const index = useKitStore((s) => s.index);
  const manifests = useKitStore((s) => s.manifests);

  useEffect(() => {
    if (open) void useKitStore.getState().loadAllManifests();
  }, [open]);

  return (
    <Dialog open={open} title="About Drumr" onClose={onClose}>
      <p className="text-fg-1">
        Drumr turns a USB MIDI pad controller into an acoustic drum kit in the browser. It loads
        multi-velocity, round-robin sampled kits released under open licences and models real hi-hat
        behaviour. No plugins, no DAW, no account.
      </p>

      <section aria-labelledby="how" className="flex flex-col gap-3">
        <h3 id="how" className="text-xs font-semibold tracking-wider text-fg-2 uppercase">
          How it works
        </h3>
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {FLOW.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-m border border-line bg-bg-2 px-3 py-1.5">{step}</span>
              {i < FLOW.length - 1 && (
                <span aria-hidden="true" className="text-accent">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="stack" className="flex flex-col gap-3">
        <h3 id="stack" className="text-xs font-semibold tracking-wider text-fg-2 uppercase">
          Built with
        </h3>
        <ul className="flex flex-wrap gap-1.5">
          {STACK.map((t) => (
            <li key={t} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-1">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sources" className="flex flex-col gap-3">
        <h3 id="sources" className="text-xs font-semibold tracking-wider text-fg-2 uppercase">
          Sources and licences
        </h3>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-fg-2">
            <tr>
              <th className="py-1.5 font-medium">Kit</th>
              <th className="py-1.5 font-medium">Samples by</th>
              <th className="py-1.5 font-medium">Licence</th>
            </tr>
          </thead>
          <tbody>
            {index.map((kit) => {
              const m = manifests[kit.id];
              return (
                <tr key={kit.id} data-kit={kit.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3 text-fg-0">{kit.name}</td>
                  <td className="py-2 pr-3">
                    {m ? (
                      <a
                        href={m.attribution.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-fg-1 underline underline-offset-2 hover:text-fg-0"
                      >
                        {m.attribution.author}
                      </a>
                    ) : (
                      <span className="text-fg-2">…</span>
                    )}
                  </td>
                  <td className="py-2">
                    {m ? (
                      <a
                        href={m.license.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-fg-1 underline underline-offset-2 hover:text-fg-0"
                      >
                        {m.license.name}
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-fg-2">
          App code is MIT licensed. Each kit keeps its own licence; CC-BY-SA kits ship a LICENSE.txt alongside
          the samples.
        </p>
      </section>

      <a
        href="https://github.com/gauravsaluja2006/drumr"
        target="_blank"
        rel="noreferrer"
        className="self-start rounded-m border border-line px-3 py-1.5 text-sm text-fg-1 hover:bg-bg-3 hover:text-fg-0"
      >
        Source on GitHub
      </a>
    </Dialog>
  );
}
