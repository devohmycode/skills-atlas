import { Box, Text, useApp, useInput } from 'ink';
import { useEffect, useState, type ReactNode } from 'react';
import { AGENTS, getAgent } from '../agents.js';
import { INSTALLED_THEME, type TreeData } from '../catalog/installed.js';
import { t } from '../i18n/index.js';
import { formatCommand, planInstall, planRemove } from '../install/plan.js';
import type { InstallMethod, InstallOptions, Scope, Skill, Theme } from '../types.js';
import { Banner, Header, Hints, Panel, useTerminalSize, type StepId } from './Layout.js';
import { ListSelect } from './ListSelect.js';
import { TreeSelect } from './TreeSelect.js';

export interface WizardResult {
  /** Skills to install (`owner/repo@name`). */
  ids: string[];
  /** Names of installed skills to uninstall. */
  remove: string[];
  options: InstallOptions;
}

export interface AppProps {
  themes: Theme[];
  skills: Skill[];
  /** Options given on the command line: their prompts are skipped. */
  preset: Partial<Pick<InstallOptions, 'agents' | 'scope' | 'method'>>;
  /** Pre-filled values for the prompts (remembered choices, detected agents). */
  defaults: { agents: string[]; scope: Scope; method: InstallMethod };
  /** Agents found on this machine, flagged in the agent list. */
  detectedAgents?: string[];
  skillsVersion: string;
  /** Skills already chosen (the `install` command): the tree is skipped. */
  initialIds?: string[];
  /** Detects what is installed in a scope, to pre-tick it in the tree. */
  loadInstalled?: (scope: Scope) => Promise<TreeData>;
  onDone: (result: WizardResult | null) => void;
}

type Step = 'scope' | 'loading' | 'tree' | 'agents' | 'method' | 'confirm';
const ORDER: Step[] = ['scope', 'loading', 'tree', 'agents', 'method', 'confirm'];
const STEP_OF: Record<Step, StepId> = {
  scope: 'scope',
  loading: 'scope',
  tree: 'select',
  agents: 'agents',
  method: 'method',
  confirm: 'confirm',
};
/** The big logo needs about this many rows on top of the step content. */
const BANNER_MIN_ROWS = 26;

/** The skills CLI only asks for a method when agents use distinct directories. */
function needsMethod(agents: string[]): boolean {
  if (agents.includes('*')) return true;
  return new Set(agents.map((a) => getAgent(a)?.projectDir)).size > 1;
}

interface Answers {
  hasTree: boolean;
  installs: number;
  agents?: string[];
}

/** First step after `from` that still needs an answer. */
function nextStep(from: Step, preset: AppProps['preset'], a: Answers): Step {
  for (const s of ORDER.slice(ORDER.indexOf(from) + 1)) {
    if (s === 'scope' && !preset.scope) return s;
    if ((s === 'loading' || s === 'tree') && a.hasTree) return s;
    // Agents and method only matter for skills to install, not for removals.
    if (s === 'agents' && !preset.agents && a.installs > 0) return s;
    if (s === 'method' && !preset.method && a.installs > 0 && a.agents && needsMethod(a.agents)) return s;
  }
  return 'confirm';
}

export function App(props: AppProps) {
  const { themes, skills, preset, defaults, detectedAgents = [], skillsVersion, initialIds, loadInstalled, onDone } = props;
  const m = t();
  const { exit } = useApp();
  const { rows } = useTerminalSize();
  const hasTree = !initialIds;
  const [ids, setIds] = useState<string[]>(initialIds ?? []);
  const [removals, setRemovals] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[] | undefined>(preset.agents);
  const [scope, setScope] = useState<Scope | undefined>(preset.scope);
  const [method, setMethod] = useState<InstallMethod | undefined>(preset.method);
  const [tree, setTree] = useState<TreeData>({ skills, installed: new Map() });
  const [error, setError] = useState<string>();
  const answers = (over: Partial<Answers> = {}): Answers => ({ hasTree, installs: ids.length, agents, ...over });
  const [step, setStep] = useState<Step>(() => (preset.scope ? nextStep('scope', preset, answers()) : 'scope'));

  const finish = (result: WizardResult | null) => {
    onDone(result);
    exit();
  };
  const next = (from: Step, over?: Partial<Answers>) => setStep(nextStep(from, preset, answers(over)));
  /** Going back to a step that was skipped (preset, no tree) leaves the wizard. */
  const back = (to: 'scope' | 'tree' | 'agents') => {
    if ((to === 'tree' && !hasTree) || (to === 'scope' && preset.scope)) finish(null);
    else setStep(to);
  };
  const backFromOptions = () => back(hasTree ? 'tree' : 'scope');

  // Detects installed skills once the scope is known, then opens the tree.
  useEffect(() => {
    if (step !== 'loading') return;
    if (!loadInstalled) {
      setStep('tree');
      return;
    }
    let live = true;
    loadInstalled(scope ?? defaults.scope)
      .then((data) => {
        if (!live) return;
        setTree(data);
        setStep('tree');
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(m.detectFailed(err instanceof Error ? err.message : String(err)));
        setStep('tree');
      });
    return () => {
      live = false;
    };
  }, [step]);

  /** Every screen: header with the steps, the logo on the first ones, then the content. */
  const screen = (content: ReactNode) => (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      {(step === 'scope' || step === 'loading') && rows >= BANNER_MIN_ROWS && <Banner />}
      <Header step={STEP_OF[step]} />
      {content}
    </Box>
  );

  if (step === 'scope') {
    return screen(
      <ListSelect<Scope>
        key="scope"
        title={m.scope.title}
        initial={[scope ?? defaults.scope]}
        items={[
          { value: 'project', label: m.scope.project, hint: m.scope.projectHint(process.cwd()) },
          { value: 'global', label: m.scope.global, hint: m.scope.globalHint },
        ]}
        onSubmit={([value]) => {
          setScope(value);
          next('scope');
        }}
        onCancel={() => finish(null)}
      />,
    );
  }

  if (step === 'loading') {
    return screen(<Text color="yellow">{m.loading(scope ?? defaults.scope)}</Text>);
  }

  if (step === 'tree') {
    const installedIds = [...tree.installed.keys()];
    const removedIds = new Set(installedIds.filter((id) => removals.includes(tree.installed.get(id)!)));
    return screen(
      <Box flexDirection="column">
        {error && <Text color="red">{error}</Text>}
        <TreeSelect
          themes={tree.installed.size ? [INSTALLED_THEME, ...themes] : themes}
          skills={tree.skills}
          installed={tree.installed}
          scope={loadInstalled ? scope ?? defaults.scope : undefined}
          initialSelected={[...ids, ...installedIds.filter((id) => !removedIds.has(id))]}
          onSubmit={(sel) => {
            const chosen = new Set(sel);
            const toInstall = sel.filter((id) => !tree.installed.has(id));
            const toRemove = installedIds.filter((id) => !chosen.has(id)).map((id) => tree.installed.get(id)!);
            if (!toInstall.length && !toRemove.length) return finish(null);
            setIds(toInstall);
            setRemovals(toRemove);
            next('tree', { installs: toInstall.length });
          }}
          onCancel={() => finish(null)}
        />
      </Box>,
    );
  }

  if (step === 'agents') {
    const detected = new Set(detectedAgents);
    return screen(
      <ListSelect
        key="agents"
        title={m.agents.title}
        multiple
        initial={agents ?? defaults.agents}
        items={[
          { value: '*', label: m.agents.all, hint: `${AGENTS.length}` },
          ...AGENTS.map((a) => ({
            value: a.id,
            label: a.displayName,
            badge: detected.has(a.id) ? m.agents.detected : undefined,
            hint: `${a.id} · ${a.projectDir}`,
          })),
        ]}
        onSubmit={(values) => {
          const chosen = values.includes('*') ? ['*'] : values;
          setAgents(chosen);
          next('agents', { agents: chosen });
        }}
        onCancel={backFromOptions}
      />,
    );
  }

  if (step === 'method') {
    return screen(
      <ListSelect<InstallMethod>
        key="method"
        title={m.method.title}
        initial={[method ?? defaults.method]}
        items={[
          { value: 'symlink', label: m.method.symlink, hint: m.method.symlinkHint },
          { value: 'copy', label: m.method.copy, hint: m.method.copyHint },
        ]}
        onSubmit={([value]) => {
          setMethod(value);
          next('method');
        }}
        onCancel={() => (preset.agents ? backFromOptions() : back('agents'))}
      />,
    );
  }

  const options: InstallOptions = {
    agents: agents ?? defaults.agents,
    scope: scope ?? defaults.scope,
    method: method ?? defaults.method,
    skillsVersion,
  };
  return screen(
    <Confirm
      ids={ids}
      remove={removals}
      options={options}
      onConfirm={() => finish({ ids, remove: removals, options })}
      onBack={backFromOptions}
    />,
  );
}

interface ConfirmProps {
  ids: string[];
  remove: string[];
  options: InstallOptions;
  onConfirm: () => void;
  onBack: () => void;
}

function Confirm({ ids, remove, options, onConfirm, onBack }: ConfirmProps) {
  const m = t();
  useInput((input, key) => {
    if (key.return || input === 'y') onConfirm();
    else if (key.escape || input === 'n') onBack();
  });
  const removeCommands = planRemove(remove, options);
  const addCommands = ids.length ? planInstall(ids, options) : [];
  const row = (label: string, value: string) => (
    <Text>
      <Text dimColor>{label.padEnd(10)}</Text>
      {value}
    </Text>
  );
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>{m.confirm.title}</Text>
      {remove.length > 0 && (
        <Panel color="red" title={`− ${m.confirm.remove(remove.length)}`}>
          <Text wrap="wrap">{remove.join('  ·  ')}</Text>
        </Panel>
      )}
      {ids.length > 0 && (
        <Panel color="green" title={`+ ${m.confirm.install(ids.length, addCommands.length)}`}>
          {addCommands.map((c) => (
            <Text key={c.source} wrap="truncate-end">
              <Text dimColor>{c.source}</Text>
              {`  ${c.skills.join(', ')}`}
            </Text>
          ))}
        </Panel>
      )}
      <Box flexDirection="column">
        {row(m.confirm.scope, options.scope === 'global' ? m.scope.global : m.scope.project)}
        {ids.length > 0 && row(m.confirm.agents, options.agents.join(', '))}
        {ids.length > 0 && row(m.confirm.method, options.method === 'copy' ? m.method.copy : m.method.symlink)}
      </Box>
      <Box flexDirection="column">
        <Text dimColor>{m.confirm.commands}</Text>
        {[...removeCommands, ...addCommands].map((c, i) => (
          <Text key={i} color="gray" wrap="truncate-end">
            {`  $ ${formatCommand(c)}`}
          </Text>
        ))}
      </Box>
      <Hints
        items={[
          [m.keyNames.enter, m.keys.apply],
          [m.keyNames.esc, m.keys.back],
        ]}
      />
    </Box>
  );
}
