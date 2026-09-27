# skills-atlas

Browse **every public Agent Skill** (`SKILL.md` format) grouped by theme in a collapsible tree, tick several and install them in one go through [`npx skills add`](https://github.com/vercel-labs/skills), without its interactive prompts. Skills already installed come pre-ticked: untick one to uninstall it.

```
 SKILLS ATLAS  ·  ✓ Scope  ›  ● Select  ›  ○ Agents  ›  ○ Method  ›  ○ Confirm

 71,571 skills   ◉ 3 selected   +2 −0   scope: Project                          4 / 3,691
 / search:

   ▸ ◉ Already installed                                              1 ✓         1
   ▾ ◐ Frontend & web                                                 2 ✓     3,672
       ◉ frontend-design              anthropics/skills                     ↓924.2k
 ❯     ○ agent-browser                vercel-labs/agent-browser             ↓870.8k
       ◉ vercel-react-best-practices  vercel-labs/agent-skills              ↓744.3k
   ▸ ○ Backend & APIs                                                         3,859
```

## Installation

```bash
npx skills-atlas            # or: npm i -g skills-atlas
```

Node ≥ 20. The catalog ships inside the package: startup is instant and works offline.

## Usage

```bash
skills-atlas                                  # interactive: scope → tree → options → confirm
skills-atlas browse -t security -q audit      # tree pre-filtered by theme and text
skills-atlas browse -a claude-code cursor -g  # options given as flags are not asked
skills-atlas themes                           # themes and their skill counts
skills-atlas list -t databases -n 10          # non-interactive listing (--json available)
skills-atlas agents                           # ids accepted by --agent (★ = detected here)
skills-atlas install anthropics/skills@pdf supabase/agent-skills@supabase -a claude-code -p -y
```

### Interface language

The interface is in **English by default**. French is available, and more languages can be added:

```bash
skills-atlas -l fr                  # switch to French (or --lang fr): the choice is remembered
skills-atlas -l en                  # back to English
skills-atlas lang                   # current language
SKILLS_ATLAS_LANG=fr skills-atlas   # force a language from the environment, without saving it
```

The choice made with `-l` is saved in `~/.config/skills-atlas/config.json`, so later runs keep it without the flag. Precedence: `-l`/`--lang`, then `SKILLS_ATLAS_LANG`, then the saved choice, then English. `--theme` accepts a theme id or its label in any language (`security`, `Sécurité`…).

Translations live in `src/i18n/`. Adding a language takes one file implementing the `Messages` type (TypeScript reports any missing key) and one entry in `LANGUAGES`.

### Installed skills

`skills-atlas` first asks for the scope (`-g`/`-p` to set it), then reads what is installed there:

- **Detection** reads what the skills CLI writes on disk: the canonical `.agents/skills` directory, every agent's skills directory, and the lock file for sources. It gives the same result as `npx skills list --json` in under a second instead of ~30 s.
- **Pre-ticked**: installed skills are ticked and marked `● installed`, under their theme and in an **Already installed** group at the top. That group also holds skills the catalog does not know, such as home-made ones.
- **Uninstall**: unticking an installed skill marks it `✗ will be uninstalled`. On confirmation it is removed from every agent of that scope with `npx skills remove -s … -y [-g]`, then checked on disk.
- **Install**: ticking a skill that is not installed installs it.
- **Questions**: the status line shows the balance `+N −M`. Agents and method are only asked when there is something to install.

### Keys (tree)

| Key | Action |
|---|---|
| ↑ ↓ / PgUp PgDn | move |
| → / ← | expand / collapse a theme |
| space | tick a skill, or a whole theme (unticking an installed skill uninstalls it) |
| `/` | search (enter to keep, esc to clear) |
| `a` | expand / collapse all |
| `s` | sort: installs (default) → skills.sh rank → name |
| `o` | only official skills (marked ◆) |
| enter | continue |
| `q` | quit |

### Install options

| Option | Effect |
|---|---|
| `-a, --agent <ids...>` | target agents (`claude-code`, `cursor`, `codex`, `github-copilot`…; `'*'` = all) |
| `-g, --global` / `-p, --project` | scope: your user profile or the current project |
| `--copy` / `--symlink` | one copy per agent, or a symlink to `.agents/skills` |
| `-y, --yes` | no questions; `--agent` becomes required |
| `--dry-run` | print the `npx skills` commands without running them |
| `--skills-version <v>` | skills CLI version (default: 1.7.0, pinned) |
| `--catalog <path\|url>` | alternative catalog |
| `--all`, `--min-installs <n>` | include skills with no installs or stars / minimum installs |
| `-s, --sort <order>` | `installs` (default), `rank` (skills.sh leaderboard) or `name`; also for `list` |
| `--official` | only official skills; also for `list` and `themes` |
| `-l, --lang <code>` | interface language, remembered |

Any option left out is asked after the selection, pre-filled with your last choices (`~/.config/skills-atlas/config.json`) and the agents detected on the machine.

### What runs

Selected skills are grouped per repository, and each repository gets one call:

```
npx -y skills@1.7.0 add <owner/repo> -s <skill…> -a <agent…> [-g] [--copy] -y --json
```

- **The source comes first**, because `-s` and `-a` take every argument that follows them.
- **`-a` is always passed.** With `-y` alone, the skills CLI would install to every detected agent.
- **Results are read from `--json`.** Outside that mode, the skills CLI exits 0 even when an install fails.
- **Calls run one after the other**, because they share the same lock file.
- **Uninstalls run first**, as a single `npx skills remove -s … -y [-g]` call.

In a terminal, progress is shown uv-style: one line per task (uninstall, then one per repository) with a spinner, a bar that follows the steps `skills add` reports (fetching the repository, installing, security audit) and the elapsed time, an overall bar, then a `+ installed` / `- uninstalled` / `× failed` summary. When the output is piped, or with `--verbose`, plain lines are printed instead.

## The catalog

`data/catalog.json.gz` is rebuilt every day by GitHub Actions (`npm run crawl`) from:

| Source | Access | Provides |
|---|---|---|
| [claude-plugins.dev](https://claude-plugins.dev) | `GET /api/skills?limit=100&offset=N`, full listing | ~47,000 skills, descriptions, stars, installs |
| [skills.sh](https://skills.sh) | sitemaps (the 20,000 most installed skills, in order); optionally `GET /api/search?owner=` | popularity rank; install counts for the top N owners (`--max-owners N`) |
| [Smithery](https://smithery.ai/skills) | `registry.smithery.ai/skills`, at most 500 results per query | categories (Coding, Design, Security…) |
| GitHub | Trees API + `raw.githubusercontent.com` | missing descriptions, read from `SKILL.md` |
| [officialskills.sh](https://officialskills.sh) | sitemap | official publishers: every skill whose GitHub owner is listed there is flagged `official` |

**Rate limits.** The skills.sh search API allows 30 requests per minute. The crawl queries it at that pace, about 2 s per owner. The daily workflow covers the top 600 owners; a local crawl covers none by default. With `VERCEL_OIDC_TOKEN`, the crawl uses the [official API](https://skills.sh/docs/api) instead, which returns the full leaderboard.

**Processing:**

1. **Deduplication** on `owner/repo@name`, case-insensitive.
2. **Encoding repair**: claude-plugins.dev serves Chinese and Japanese text double-encoded in UTF-8.
3. **Missing descriptions** (the 5,000 most popular skills):
   - with `GITHUB_TOKEN` or a `gh` session, one Trees call per repository locates each `SKILL.md`;
   - otherwise the crawl tries the usual locations.
4. **Ordering**: skills ranked by skills.sh first, in rank order; then the others by installs and stars.

**Themes**: each skill gets 1 or 2 of 17 themes (see `src/catalog/taxonomy.ts`), from:

- keywords found in its name (weight 3) and description (weight 1), including Chinese and Japanese ones;
- the Smithery or SkillsMP categories it carries, mapped to these themes.

```bash
npm run crawl                         # full crawl, about 5 min
npm run crawl -- --max-owners 300     # + skills.sh installs of the top 300 owners (about 11 min more)
npm run reclassify -- --sample other  # re-apply the taxonomy without crawling
npm run sync-agents -- --ref v1.7.0   # regenerate the agent list from vercel-labs/skills
```

## Development

```bash
npm install
npm test           # vitest
npm run typecheck
npm run dev        # run the CLI from sources
npm run build      # dist/cli.js
```
