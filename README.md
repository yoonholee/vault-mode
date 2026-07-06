# Vault Mode

A vibecoded IDE extension I built for personal use, for densely linked collections of Markdown notes.
Wikilinks behave like code references: preview rendering, jump-to-definition, backlinks, completion.
Semantic search is optional, aimed at LLM-agent workflows: point your agent at the vault root and ask questions over your notes.
Works in VS Code and Cursor.
In my experience, a vault like this built up over months of personal writing, when given to an LLM agent as context, yields much deeper and personalized answers than the default one.

![styled preview](styles/preview.png)

## Features

- **Wikilink preview rendering.** `[[Note]]`, `[[Note|alias]]`, `[[Note#heading]]`, `![[Note]]` become clickable links in the Markdown preview. Code fences and inline code spans are respected.
- **Wikilink intelligence.** Ctrl/Cmd-click a `[[Wikilink]]` to jump. Hover for a content preview. Type `[[` for completion. "Find all references" lists backlinks.
- **Syntax highlighting** for wikilinks in the editor (distinct token scope; styled by your color theme).
- **Callouts in the preview.** `> [!note] Title` renders as a bold-titled blockquote instead of literal `[!note]` text (same treatment `md-print` applies in PDFs).
- **Styled preview.** The built-in Markdown preview gets an opinionated light style: serif headings, restrained palette, tight vertical rhythm, hidden YAML-frontmatter table. Ships as `markdown.previewStyles`, so it works in any folder with zero settings.
- **Preview-to-side button** in the editor title bar for markdown and markdown-adjacent files (`prompt`, `instructions`, `chatagent`, `skill`).
- **Rename propagation.** Rename a note file and every `[[wikilink]]` pointing at it is rewritten (alias/anchor/embed preserved), as one undoable edit.
- **Daily notes.** `Vault: Open Today's Daily Note` creates `Daily/YYYY-MM-DD.md` from a configurable template.
- **Semantic search (optional).** If you have a compatible search CLI (see below), you get `Vault: Semantic Search`, `Vault: Insert Wikilink`, `Vault: Show Related Notes`, and hover popups augmented with the top-3 semantic neighbors. Without one, these features quietly disable; everything else is unaffected.

## Install

VS Code: search **Vault Mode** in the Marketplace, or `code --install-extension yoonholee.vault-mode`.

Cursor / VSCodium / other forks: grab the `.vsix` from [Releases](https://github.com/yoonholee/vault-mode/releases), then `cursor --install-extension vault-mode-*.vsix`.

From source:

```sh
git clone https://github.com/yoonholee/vault-mode && cd vault-mode
npm install && npm run build
npx vsce package
code --install-extension vault-mode-*.vsix
```

Recommended sidecar extensions: `yzhang.markdown-all-in-one`, `esbenp.prettier-vscode`, `davidanson.vscode-markdownlint`.

## Feedback and bug reports

Bug reports and small feature requests are welcome in [GitHub Issues](https://github.com/yoonholee/vault-mode/issues).
For bugs, include version, editor, OS, a minimal markdown/vault snippet, and relevant lines from the "Vault Mode" output channel.
Large features should start as an issue before a PR.

## The `vs` semantic-search bridge

The search features shell out to an external CLI (`vaultMode.vsPath`, default `vs`).
Any executable with this contract works:

```
vs --paths-only [--no-update] [--limit N] [--weight W] [--lexical-only] <query>
```

It must print newline-separated absolute paths of matching notes to stdout and exit 0.
My implementation is a private embeddings search script.
The contract is intentionally small, so replacements are easy:

- lexical: `rg -l --glob '*.md' -- "$query" "$VAULT_ROOT"`
- embeddings: query a local sqlite/LanceDB/Chroma index, return matching note paths
- agent bridge: wrap your retrieval command, return the notes the agent should inspect first

If the binary is not on PATH at activation, the vs-dependent features disable with a note in the "Vault Mode" output channel.

## Configuration

| Setting                         | Default        | What                                                    |
| ------------------------------- | -------------- | ------------------------------------------------------- |
| `vaultMode.vsPath`              | `vs`           | Path to the search CLI                                  |
| `vaultMode.vsTimeoutMs`         | `5000`         | Hard timeout for any search invocation                  |
| `vaultMode.dailyNotesFolder`    | `Daily`        | Folder under vault root for daily notes                 |
| `vaultMode.dailyNoteTemplate`   | `# {date}\n\n` | Template (placeholders: `{date}`, `{iso}`, `{weekday}`) |
| `vaultMode.updateLinksOnRename` | `true`         | Rewrite wikilinks when a note is renamed                |
| `vaultMode.hover.augmentWithVs` | `true`         | Append semantic neighbors to wikilink hover             |
| `vaultMode.ignorePatterns`      | (see settings) | Globs excluded from the workspace index                 |
| `vaultMode.perfLog`             | `true`         | Log detailed timings and counters to the output channel |

## Commands

| Command                    | What                                    |
| -------------------------- | --------------------------------------- |
| `vaultMode.semanticSearch` | QuickPick over search results           |
| `vaultMode.insertWikilink` | Search + insert `[[Stem]]` at cursor    |
| `vaultMode.relatedNotes`   | Semantic neighbors of the current file  |
| `vaultMode.openDailyNote`  | Open / create today's daily note        |
| `vaultMode.openRandomNote` | Open a random vault note                |
| `vaultMode.previewToSide`  | Open Markdown preview to the side       |
| `vaultMode.rebuildIndex`   | Rebuild the wikilink index from scratch |

No default keybindings; bind in `keybindings.json` if you want hotkeys.

## Performance

Benched on my 2718-file / 18MB vault (`npm run bench`, mean ± σ over 5 runs).

| Operation                                          | Measured     |
| -------------------------------------------------- | ------------ |
| Full index build (read + parse, 32-way concurrent) | 525 ± 66 ms  |
| Parse all files, CPU only                          | 67 ± 5 ms    |
| Resolve 2000 wikilink targets                      | 3.4 ± 1.2 ms |
| Backlinks for 2000 targets                         | 1.6 ± 0.4 ms |
| Bundle size                                        | ~38KB        |

Activation, indexing, watcher updates, commands, providers, and `vs` calls log timings to the "Vault Mode" output channel when `perfLog` is on.
Index logs include file count, bytes, wikilink count, read errors, list time, parse/read time, and total time.

## Development

```sh
npm install
npm run test:unit         # vitest
npm run typecheck         # tsc --noEmit
npm run lint              # eslint + prettier check
npm run build             # esbuild bundle to dist/extension.js
code --extensionDevelopmentPath="$PWD" /path/to/your/vault   # Extension Development Host
```

## License

MIT.
