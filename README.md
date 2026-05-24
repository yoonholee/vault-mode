# Obsidian Light

A small VSCode extension that gives Obsidian-style vaults clickable wikilinks, backlinks, semantic search via `vs`, and a Copilot context booster — without depending on an external LSP.

Originally meant to be a thin wrapper over the marksman LSP. Marksman crashes (SIGSEGV) on the target vault, so the wikilink intelligence is implemented in-extension instead. See `agent_notes/friction.md` for the full story.

## Features

- **Wikilink preview rendering.** `[[Note]]`, `[[Note|alias]]`, `[[Note#heading]]`, `![[Note]]` become clickable links in the VSCode markdown preview. Code fences and inline code spans are respected.
- **Syntax highlighting** for wikilinks in the editor (distinct token scope; styled by your color theme).
- **Definition / hover / completion / references.** Ctrl-click a `[[Wikilink]]` to jump. Hover for a preview. Type `[[` for completion. "Find all references" shows backlinks.
- **`vs` bridge.** `Vault: Semantic Search`, `Vault: Insert Wikilink`, `Vault: Show Related Notes`. Hover popups also augment with the top-3 `vs` neighbors of the target.
- **Daily notes.** `Vault: Open Today's Daily Note` creates `Daily/YYYY-MM-DD.md` from a configurable template.
- **Copilot context booster.** On opening a markdown file, opens its wikilink neighbors as preview tabs so Copilot reads them. Toggle in settings.
- **Copilot instructions generator.** `Vault: Regenerate Copilot Instructions` writes `.github/copilot-instructions.md` from your vault structure + `CLAUDE.md`.

## Install

From source:

```sh
cd ~/repos/vscode-extensions/obsidian-light
npm install
npm run build
npx vsce package
code --install-extension obsidian-light-0.1.0.vsix
```

Recommended sidecar extensions (not bundled):

- `yzhang.markdown-all-in-one` — keyboard shortcuts, TOC, list editing
- `esbenp.prettier-vscode` — formatting
- `davidanson.vscode-markdownlint` — linting

## Configuration

| Setting | Default | What |
|---|---|---|
| `obsidianLight.vsPath` | `vs` | Path to the `vs` CLI |
| `obsidianLight.vsTimeoutMs` | `5000` | Hard timeout for any `vs` invocation |
| `obsidianLight.dailyNotesFolder` | `Daily` | Folder under vault root for daily notes |
| `obsidianLight.dailyNoteTemplate` | `# {date}\n\n` | Template (placeholders: `{date}`, `{iso}`, `{weekday}`) |
| `obsidianLight.copilotBooster.enabled` | `true` | Preload wikilink neighbors as preview tabs |
| `obsidianLight.copilotBooster.maxNeighbors` | `5` | Max neighbors per active file |
| `obsidianLight.copilotBooster.depth` | `1` | Traversal depth (reserved; only depth=1 implemented in v0) |
| `obsidianLight.hover.augmentWithVs` | `true` | Append vs neighbors to wikilink hover |
| `obsidianLight.ignorePatterns` | (see settings) | Globs excluded from the workspace index |
| `obsidianLight.perfLog` | `true` | Log per-operation timings to the output channel |

## Performance (benched on a 2165-file vault)

| Operation | Measured | Target |
|---|---|---|
| Parser, full vault | 524ms total / 0.24ms mean per file | n/a |
| Parser, single 100-link doc | 0.6ms (235 links in 0.6ms) | <50ms |
| Build extension bundle | 7ms | n/a |
| Bundle size | 35.4KB | <500KB |

Extension activation, index build, and hover-provider latencies are logged to the "Obsidian Light" output channel when `perfLog` is on.

## Commands

| Command | Default keybinding | What |
|---|---|---|
| `obsidianLight.semanticSearch` | (none) | Open QuickPick over `vs` results |
| `obsidianLight.insertWikilink` | (none) | Search + insert `[[Stem]]` at cursor |
| `obsidianLight.relatedNotes` | (none) | Show vs-neighbors of the current file |
| `obsidianLight.openDailyNote` | (none) | Open / create today's daily note |
| `obsidianLight.openRandomNote` | (none) | Open a random vault note |
| `obsidianLight.regenerateCopilotInstructions` | (none) | Write `.github/copilot-instructions.md` |
| `obsidianLight.preloadNeighbors` | (none) | Manually trigger neighbor preload |
| `obsidianLight.rebuildIndex` | (none) | Rebuild the wikilink index from scratch |

Bind any of these in `keybindings.json` if you want hotkeys.

## Architecture (one-paragraph version)

Activation builds an in-memory `WorkspaceIndex` (file walker + parser + resolver + backlinks index) over the markdown files in the first workspace folder. Four providers (definition, hover, completion, references) plus a markdown-it plugin for preview rendering all read from the index. A `vs` CLI client wraps the user's semantic-search tool with timeouts. A neighbor-preloader listens for active-editor changes and opens wikilinked targets as preview tabs to feed Copilot's context window. A `FileSystemWatcher` keeps the index in sync. Everything is unit-tested (90 tests, all green at v0.1.0).

## Development

```sh
npm install
npm run test:unit         # run unit tests
npm run test:unit:watch   # watch mode
npm run typecheck         # tsc --noEmit
npm run lint              # eslint + prettier check
npm run build             # esbuild bundle to dist/extension.js
npm run build:watch       # watch bundle
```

To launch the Extension Development Host:

```sh
code --extensionDevelopmentPath="$PWD" "$HOME/repos/vault"
```

## License

MIT.
