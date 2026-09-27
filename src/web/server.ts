import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';
import { AGENTS, detectAgents, unknownAgents } from '../agents.js';
import { INSTALLED_THEME, mergeInstalled, type InstalledEntry } from '../catalog/installed.js';
import { haystack, SORT_ORDERS, sortSkills } from '../catalog/query.js';
import { readConfig, writeConfig } from '../config.js';
import { getLang, t, themeLabel } from '../i18n/index.js';
import { formatCommand, planInstall, planRemovals, type InstallCommand } from '../install/plan.js';
import { isSuccess, listInstalled, phaseOf, runAll, type CommandOutcome, type InstalledSkill, type Phase } from '../install/run.js';
import { SCOPES, type InstallOptions, type Removal, type Skill } from '../types.js';
import { PAGE_HTML } from './page.js';

export interface ServerOptions {
  /** Skills to browse (already filtered like the tree: `querySkills`). */
  skills: Skill[];
  /** Every catalog skill, to recognise installed ones hidden by the filters. */
  catalogSkills: Skill[];
  themes: { id: string; label: string }[];
  skillsVersion: string;
  /** 0 picks a free port. */
  port?: number;
  /** Project directory for the project scope. */
  cwd?: string;
  /** Injected in tests, so that nothing is installed for real. */
  listInstalled?: (scope: 'project' | 'global', cwd?: string) => Promise<InstalledSkill[]>;
  runAll?: typeof runAll;
}

export interface AtlasServer {
  /** Address to open, token included. */
  url: string;
  port: number;
  token: string;
  close: () => Promise<void>;
}

/** Largest page of skills a request may ask for. */
const MAX_LIMIT = 500;
/** Largest JSON body accepted. */
const MAX_BODY = 1_000_000;

const Body = z.object({
  install: z.array(z.string()).max(2000),
  remove: z.array(z.string()).max(2000),
  options: z.object({
    agents: z.array(z.string()).max(100),
    scope: z.enum(['project', 'global']),
    method: z.enum(['symlink', 'copy']),
  }),
});

/** Fields of a skill the page needs. */
const slim = (s: Skill) => ({
  id: s.id,
  name: s.name,
  source: s.source,
  description: s.description,
  installs: s.installs,
  stars: s.stars,
  rank: s.rank,
  official: s.official,
  themes: s.themes,
});

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Local web interface: the same catalog, detection and install commands as the terminal tree,
 * served on 127.0.0.1 only. Every API call must carry the random token of the URL (header
 * `x-atlas-token`) and a local Host, so that no other web page can drive installs.
 */
export async function startServer(opts: ServerOptions): Promise<AtlasServer> {
  const cwd = opts.cwd ?? process.cwd();
  const list = opts.listInstalled ?? listInstalled;
  const run = opts.runAll ?? runAll;
  const token = randomBytes(24).toString('hex');
  const texts = new Map(opts.skills.map((s) => [s.id, haystack(s)]));
  const sorted = { installs: sortSkills(opts.skills, 'installs'), name: sortSkills(opts.skills, 'name') };
  let running = false;

  /** What is installed now, in both scopes, merged into the catalog like the tree does. */
  async function installed() {
    const found = (await Promise.all(SCOPES.map((sc) => list(sc, cwd)))).flat();
    return mergeInstalled(opts.catalogSkills, opts.skills, found);
  }

  async function state() {
    const inst = await installed();
    const config = readConfig();
    const detected = new Set(detectAgents().map((a) => a.id));
    const detectedList = AGENTS.filter((a) => detected.has(a.id)).map((a) => a.id);
    const byId = new Map(inst.skills.map((s) => [s.id, s]));
    return {
      lang: getLang(),
      messages: t().web,
      cwd,
      skillsVersion: opts.skillsVersion,
      themes: [INSTALLED_THEME, ...opts.themes].map((th) => ({ id: th.id, label: themeLabel(th) })),
      agents: AGENTS.map((a) => ({ id: a.id, name: a.displayName, detected: detected.has(a.id) })),
      defaults: {
        agents: config.agents?.length ? config.agents : detectedList,
        scope: config.scope ?? 'project',
        method: config.method ?? 'symlink',
      },
      installed: [...inst.installed].map(([id, e]) => ({ ...slim(byId.get(id)!), installedName: e.name, scopes: e.scopes })),
    };
  }

  function skillsPage(params: URLSearchParams) {
    const sort = SORT_ORDERS.find((o) => o === params.get('sort')) ?? 'installs';
    const terms = (params.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    const official = params.get('official') === '1';
    const theme = params.get('theme') || undefined;
    const offset = Math.max(0, Number(params.get('offset')) || 0);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get('limit')) || 100));
    const matching = sorted[sort].filter(
      (s) => (!official || s.official) && terms.every((term) => texts.get(s.id)!.includes(term)),
    );
    const counts: Record<string, number> = {};
    for (const s of matching) for (const th of s.themes) counts[th] = (counts[th] ?? 0) + 1;
    const inTheme = theme ? matching.filter((s) => s.themes.includes(theme)) : matching;
    return { total: inTheme.length, all: matching.length, counts, items: inTheme.slice(offset, offset + limit).map(slim) };
  }

  /** Checks a request body against the catalog and what is installed, then plans the commands. */
  async function plan(raw: unknown): Promise<{ commands: InstallCommand[]; options: InstallOptions; installs: number }> {
    const parsed = Body.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, 'invalid request');
    const { install, remove, options } = parsed.data;
    const inst = await installed();
    const known = new Set(opts.catalogSkills.map((s) => s.id));
    const unknown = install.filter((id) => !known.has(id));
    if (unknown.length) throw new HttpError(400, `unknown skills: ${unknown.join(', ')}`);
    const notInstalled = remove.filter((id) => !inst.installed.has(id));
    if (notInstalled.length) throw new HttpError(400, `not installed: ${notInstalled.join(', ')}`);
    if (install.length && !options.agents.length) throw new HttpError(400, t().web.needAgent);
    const badAgents = unknownAgents(options.agents);
    if (badAgents.length) throw new HttpError(400, `unknown agents: ${badAgents.join(', ')}`);
    const full: InstallOptions = { ...options, skillsVersion: opts.skillsVersion };
    const removals: Removal[] = remove.map((id) => {
      const e = inst.installed.get(id) as InstalledEntry;
      return { name: e.name, scopes: [...e.scopes] };
    });
    const commands = [
      ...planRemovals(removals, opts.skillsVersion),
      ...(install.length ? planInstall([...new Set(install)], full) : []),
    ];
    return { commands, options: full, installs: install.length };
  }

  /** Runs the plan, streaming one JSON line per event: start, phase, done, then end. */
  async function apply(raw: unknown, res: ServerResponse) {
    const { commands, options, installs } = await plan(raw);
    if (!commands.length) throw new HttpError(400, 'nothing to do');
    if (running) throw new HttpError(409, t().web.busy);
    running = true;
    // Same memory as the terminal: the next run starts from these choices.
    if (installs) writeConfig({ ...readConfig(), agents: options.agents, scope: options.scope, method: options.method });
    res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
    const send = (event: object) => res.write(`${JSON.stringify(event)}\n`);
    const phases = commands.map((): Phase => 'queued');
    const stderr = commands.map(() => '');
    try {
      const outcomes: CommandOutcome[] = await run(commands, {
        cwd,
        onStart: (c, i) => send({ type: 'start', i, kind: c.kind, source: c.source, skills: c.skills, command: formatCommand(c) }),
        onOutput: (text, i) => {
          stderr[i] = (stderr[i]! + text).slice(-4000);
          const next = phaseOf(stderr[i]!, phases[i]!);
          if (next !== phases[i]) send({ type: 'phase', i, phase: (phases[i] = next) });
        },
        onDone: (o, i) =>
          send({ type: 'done', i, ok: isSuccess(o), results: o.results, error: isSuccess(o) ? undefined : o.stderr.slice(-800) }),
      });
      send({ type: 'end', ok: outcomes.every(isSuccess) });
    } catch (err) {
      send({ type: 'end', ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      running = false;
      res.end();
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      const status = err instanceof HttpError ? err.status : 500;
      if (res.headersSent) return res.end();
      json(req, res, { error: err instanceof Error ? err.message : String(err) }, status);
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse) {
    const port = (server.address() as AddressInfo).port;
    // DNS rebinding: a page on another host name resolving to 127.0.0.1 is refused.
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) {
      throw new HttpError(403, 'forbidden host');
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:",
        'x-frame-options': 'DENY',
      });
      return res.end(PAGE_HTML);
    }
    if (!url.pathname.startsWith('/api/')) throw new HttpError(404, 'not found');
    if (!validToken(req.headers['x-atlas-token'])) throw new HttpError(401, 'bad token');
    if (req.method === 'GET' && url.pathname === '/api/state') return json(req, res, await state());
    if (req.method === 'GET' && url.pathname === '/api/skills') return json(req, res, skillsPage(url.searchParams));
    if (req.method === 'POST' && url.pathname === '/api/plan') {
      const { commands } = await plan(await readJson(req));
      return json(req, res, { commands: commands.map(formatCommand) });
    }
    if (req.method === 'POST' && url.pathname === '/api/apply') return apply(await readJson(req), res);
    throw new HttpError(404, 'not found');
  }

  function validToken(value: string | string[] | undefined): boolean {
    if (typeof value !== 'string' || value.length !== token.length) return false;
    return timingSafeEqual(Buffer.from(value), Buffer.from(token));
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/#${token}`,
    port,
    token,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function json(req: IncomingMessage, res: ServerResponse, body: unknown, status = 200) {
  let data: Buffer = Buffer.from(JSON.stringify(body));
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (data.length > 2048 && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
    data = gzipSync(data);
    headers['content-encoding'] = 'gzip';
  }
  res.writeHead(status, headers);
  res.end(data);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new HttpError(415, 'expected JSON');
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'body too large');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
}

/** Opens `url` in the default browser; failures are silent (the URL is printed anyway). */
export function openBrowser(url: string): void {
  const [file, args] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(file, args as string[], { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // No browser: the address is printed.
  }
}
