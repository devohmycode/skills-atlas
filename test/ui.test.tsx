import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';
import { mergeInstalled } from '../src/catalog/installed.js';
import { setLang } from '../src/i18n/index.js';
import type { Skill, Theme } from '../src/types.js';
import { App, type WizardResult } from '../src/ui/App.js';
import { TreeSelect } from '../src/ui/TreeSelect.js';

const themes: Theme[] = [
  { id: 'frontend', label: 'Frontend & web' },
  { id: 'security', label: 'Sécurité' },
  { id: 'other', label: 'Autres' },
];
const skill = (id: string, themeIds: string[], description?: string): Skill => {
  const [source, name] = id.split('@') as [string, string];
  return { id, name, source, description, installs: 10, labels: [], origins: ['skills.sh'], themes: themeIds };
};
const skills = [
  skill('a/b@react-hooks', ['frontend'], 'React hooks'),
  skill('a/b@tailwind', ['frontend'], 'Tailwind CSS'),
  skill('c/d@pentest', ['security'], 'Penetration testing'),
];

const KEY = { up: '\u001B[A', down: '\u001B[B', right: '\u001B[C', left: '\u001B[D', enter: '\r', escape: '\u001B' };
const tick = () => new Promise((r) => setTimeout(r, 20));
async function press(stdin: { write: (s: string) => void }, ...keys: string[]) {
  for (const k of keys) {
    stdin.write(k);
    await tick();
  }
}

describe('TreeSelect', () => {
  it('shows collapsed themes with counts, expands and selects', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(<TreeSelect themes={themes} skills={skills} onSubmit={onSubmit} onCancel={() => {}} />);
    await tick();
    expect(lastFrame()).toMatch(/▸ ○ Frontend & web\s+2/);
    expect(lastFrame()).not.toContain('Other');
    await press(stdin, KEY.right, KEY.down, ' ');
    expect(lastFrame()).toContain('◉ react-hooks');
    expect(lastFrame()).toContain('1 selected');
    expect(lastFrame()).toContain('React hooks');
    await press(stdin, KEY.enter);
    expect(onSubmit).toHaveBeenCalledWith(['a/b@react-hooks']);
  });

  it('selects a whole theme with space on its header', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(<TreeSelect themes={themes} skills={skills} onSubmit={onSubmit} onCancel={() => {}} />);
    await press(stdin, ' ');
    expect(lastFrame()).toContain('◉ Frontend & web');
    await press(stdin, KEY.enter);
    expect(onSubmit).toHaveBeenCalledWith(['a/b@react-hooks', 'a/b@tailwind']);
  });

  it('filters with / and expands matching groups', async () => {
    const { lastFrame, stdin } = render(<TreeSelect themes={themes} skills={skills} onSubmit={() => {}} onCancel={() => {}} />);
    await press(stdin, '/', 'p', 'e', 'n', KEY.enter);
    const frame = lastFrame()!;
    expect(frame).toContain('search: pen');
    expect(frame).toContain('pentest');
    expect(frame).not.toContain('Frontend');
  });

  it('collapses back to the theme with the left arrow', async () => {
    const { lastFrame, stdin } = render(<TreeSelect themes={themes} skills={skills} onSubmit={() => {}} onCancel={() => {}} />);
    await press(stdin, KEY.right, KEY.down, KEY.down, KEY.left);
    expect(lastFrame()).toContain('▸ ○ Frontend & web');
    expect(lastFrame()).not.toContain('tailwind');
  });
});

describe('TreeSelect sort and official filter', () => {
  const ranked = [
    { ...skill('x/y@less-installed', ['frontend']), installs: 5 },
    { ...skill('anthropics/skills@most-installed', ['frontend']), installs: 500, official: true },
  ];

  it('sorts by installs by default and cycles the order with s', async () => {
    const { lastFrame, stdin } = render(<TreeSelect themes={themes} skills={ranked} onSubmit={() => {}} onCancel={() => {}} />);
    await press(stdin, KEY.right);
    expect(lastFrame()).toContain('sorted by installs');
    expect(lastFrame()!.indexOf('most-installed')).toBeLessThan(lastFrame()!.indexOf('less-installed'));
    await press(stdin, 's');
    expect(lastFrame()).toContain('sorted by skills.sh rank');
    expect(lastFrame()!.indexOf('less-installed')).toBeLessThan(lastFrame()!.indexOf('most-installed'));
  });

  it('marks official skills and shows only them with o', async () => {
    const { lastFrame, stdin } = render(<TreeSelect themes={themes} skills={ranked} onSubmit={() => {}} onCancel={() => {}} />);
    await press(stdin, KEY.right);
    expect(lastFrame()).toMatch(/◆ ○ most-installed/);
    await press(stdin, 'o');
    expect(lastFrame()).toContain('◆ official only');
    expect(lastFrame()).toMatch(/Frontend & web\s+1/);
    expect(lastFrame()).not.toContain('less-installed');
  });
});

describe('App wizard', () => {
  const defaults = { agents: ['claude-code'], scope: 'project' as const, method: 'symlink' as const };

  it('asks only for options not given as flags, then confirms', async () => {
    let result: WizardResult | null = null;
    const { lastFrame, stdin } = render(
      <App themes={themes} skills={skills} preset={{ agents: ['claude-code'] }} defaults={defaults} skillsVersion="1.7.0" onDone={(r) => (result = r)} />,
    );
    // The tree comes first; the scope is asked only because there is something to install.
    await tick();
    await press(stdin, ' ', KEY.enter);
    expect(lastFrame()).toContain('Where should the new skills be installed?');
    await press(stdin, KEY.down, KEY.enter);
    // A single agent means a single directory: no method question.
    expect(lastFrame()).toContain('npx -y skills@1.7.0 add a/b -s react-hooks tailwind -a claude-code -g -y --json');
    await press(stdin, KEY.enter);
    expect(result).toEqual({
      ids: ['a/b@react-hooks', 'a/b@tailwind'],
      remove: [],
      options: { agents: ['claude-code'], scope: 'global', method: 'symlink', skillsVersion: '1.7.0' },
    });
  });

  it('asks for agents and method when several directories are involved', async () => {
    let result: WizardResult | null = null;
    const { lastFrame, stdin } = render(
      <App
        themes={themes}
        skills={skills}
        preset={{ scope: 'project' }}
        defaults={{ ...defaults, agents: [] }}
        skillsVersion="1.7.0"
        initialIds={['c/d@pentest']}
        onDone={(r) => (result = r)}
      />,
    );
    expect(lastFrame()).toContain('Which agents');
    // Type to filter the agent list, then tick Claude Code and Windsurf.
    await press(stdin, 'c', 'l', 'a', 'u', 'd', 'e', ' ');
    for (let i = 0; i < 6; i++) await press(stdin, '\u007F');
    await press(stdin, 'w', 'i', 'n', 'd', 's', 'u', 'r', 'f', ' ', KEY.enter);
    expect(lastFrame()).toContain('How should skills be installed');
    // Each step starts fresh: the agent filter must not leak into this list.
    expect(lastFrame()).toContain('Symlink');
    await press(stdin, KEY.down, KEY.enter, KEY.enter);
    expect(result).toMatchObject({ ids: ['c/d@pentest'], options: { agents: ['claude-code', 'windsurf'], method: 'copy' } });
  });

  it('returns null when leaving the tree', async () => {
    const onDone = vi.fn();
    const { stdin } = render(
      <App themes={themes} skills={skills} preset={{ scope: 'project' }} defaults={defaults} skillsVersion="1.7.0" onDone={onDone} />,
    );
    await tick();
    await press(stdin, 'q');
    expect(onDone).toHaveBeenCalledWith(null);
  });
});

describe('installed skills in the wizard', () => {
  const defaults = { agents: ['claude-code'], scope: 'project' as const, method: 'symlink' as const };
  const loadInstalled = vi.fn(async (scopes: ('project' | 'global')[]) =>
    mergeInstalled(
      skills,
      skills,
      scopes.map((scope) => ({ name: 'pentest', source: 'c/d', scope, agents: ['Claude Code'] })),
    ),
  );
  const app = (onDone: (r: WizardResult | null) => void, preset: { scope?: 'project' | 'global' } = {}) => (
    <App themes={themes} skills={skills} preset={preset} defaults={defaults} skillsVersion="1.7.0" loadInstalled={loadInstalled} onDone={onDone} />
  );

  it('pre-ticks installed skills and turns unticking into a removal', async () => {
    let result: WizardResult | null = null;
    const { lastFrame, stdin } = render(app((r) => (result = r)));
    await tick();
    await tick();
    // Both scopes are read when no scope is given.
    expect(loadInstalled).toHaveBeenLastCalledWith(['project', 'global']);
    expect(lastFrame()).toMatch(/◉ Already installed\s+1 ✓\s+1/);
    expect(lastFrame()).toContain('scope: project + global');
    await press(stdin, KEY.right, KEY.down);
    expect(lastFrame()).toContain('● project + global');
    // Untick pentest: it goes from both scopes.
    await press(stdin, ' ');
    expect(lastFrame()).toContain('will be uninstalled');
    expect(lastFrame()).toContain('−1');
    await press(stdin, KEY.enter);
    // Only a removal: no scope, agent or method question.
    expect(lastFrame()).toContain('Uninstall 1 skill (from every agent)');
    expect(lastFrame()).toContain('pentest (project + global)');
    expect(lastFrame()).toContain('npx -y skills@1.7.0 remove -s pentest -y');
    expect(lastFrame()).toContain('npx -y skills@1.7.0 remove -s pentest -y -g');
    await press(stdin, KEY.enter);
    expect(result).toMatchObject({ ids: [], remove: [{ name: 'pentest', scopes: ['project', 'global'] }] });
  });

  it('reads only the scope given as a flag', async () => {
    const { lastFrame } = render(app(() => {}, { scope: 'global' }));
    await tick();
    await tick();
    expect(loadInstalled).toHaveBeenLastCalledWith(['global']);
    expect(lastFrame()).toContain('scope: global');
  });

  it('does not validate when nothing differs', async () => {
    const onDone = vi.fn();
    const { stdin } = render(app(onDone));
    await tick();
    await tick();
    await press(stdin, KEY.enter);
    expect(onDone).not.toHaveBeenCalled();
    await press(stdin, 'q');
    expect(onDone).toHaveBeenCalledWith(null);
  });
});

describe('French interface', () => {
  it('renders the wizard in French when asked', async () => {
    setLang('fr');
    try {
      const { lastFrame, stdin } = render(
        <App themes={themes} skills={skills} preset={{}} defaults={{ agents: ['claude-code'], scope: 'project', method: 'symlink' }} skillsVersion="1.7.0" onDone={() => {}} />,
      );
      await tick();
      expect(lastFrame()).toContain('Sélection');
      expect(lastFrame()).toContain('Sécurité');
      expect(lastFrame()).toContain('0 coché');
      await press(stdin, ' ', KEY.enter);
      expect(lastFrame()).toContain('Où installer les nouveaux skills ?');
      expect(lastFrame()).toContain('Portée');
    } finally {
      setLang('en');
    }
  });
});
