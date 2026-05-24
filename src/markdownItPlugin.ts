// markdown-it plugin that turns [[wikilinks]] into anchors during preview render.
//
// Honors the same code-fence / inline-code skipping as the parser by relying
// on markdown-it's tokenization: we register an `inline` rule that only fires
// inside text tokens; fenced/inline-code tokens have a different type and are
// not transformed.

import type MarkdownIt from "markdown-it";

// markdown-it 14 doesn't expose StateInline from its main types entry in a
// portable way. Declare the minimal surface we use.
interface MdStateInline {
  src: string;
  pos: number;
  push(type: string, tag: string, nesting: number): { meta: unknown };
}

export interface WikilinkPluginOptions {
  /**
   * Given a wikilink target stem (or path/Note), return a URL string usable
   * as an href. Return undefined if the link cannot be resolved; the plugin
   * will then render a missing-link span.
   */
  resolve: (target: string) => string | undefined;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function wikilinkPlugin(md: MarkdownIt, options: WikilinkPluginOptions): void {
  md.inline.ruler.after("emphasis", "wikilink", wikilinkRule);

  md.renderer.rules.wikilink = (tokens, idx) => {
    const t = tokens[idx];
    const { target, alias, anchor, embed } = t.meta as {
      target: string;
      alias?: string;
      anchor?: string;
      embed: boolean;
    };
    const href = options.resolve(target);
    const displayText = alias ?? target;
    if (!href) {
      const cls = embed ? "wikilink-embed wikilink-missing" : "wikilink wikilink-missing";
      return `<span class="${cls}" data-target="${escapeHtml(target)}">${escapeHtml(displayText)}</span>`;
    }
    const url = anchor ? `${href}#${encodeURIComponent(anchor)}` : href;
    const cls = embed ? "wikilink wikilink-embed" : "wikilink";
    return `<a class="${cls}" href="${escapeHtml(url)}">${escapeHtml(displayText)}</a>`;
  };
}

function wikilinkRule(state: MdStateInline, silent: boolean): boolean {
  const start = state.pos;
  // Match optional ! then [[
  let embed = false;
  let p = start;
  if (state.src.charCodeAt(p) === 0x21 /* ! */) {
    embed = true;
    p++;
  }
  if (state.src.charCodeAt(p) !== 0x5b /* [ */ || state.src.charCodeAt(p + 1) !== 0x5b /* [ */) {
    return false;
  }
  // Guard against [[[X]] -> only valid if the char before the [[ is not also [
  if (start > 0 && state.src.charCodeAt(start - 1) === 0x5b) return false;

  const innerStart = p + 2;
  const closeIdx = state.src.indexOf("]]", innerStart);
  if (closeIdx === -1) return false;
  const inner = state.src.slice(innerStart, closeIdx);
  if (!inner || !inner.trim()) return false;
  // Disallow nested brackets inside the inner (would be a different construct)
  if (inner.includes("[") || inner.includes("]")) return false;

  // Parse inner: pipe for alias, hash for anchor
  let target = inner;
  let alias: string | undefined;
  let anchor: string | undefined;
  const pipeIdx = inner.indexOf("|");
  if (pipeIdx !== -1) {
    target = inner.slice(0, pipeIdx).trim();
    alias = inner.slice(pipeIdx + 1).trim();
  } else {
    target = inner.trim();
  }
  const hashIdx = target.indexOf("#");
  if (hashIdx !== -1) {
    anchor = target.slice(hashIdx + 1).trim();
    target = target.slice(0, hashIdx).trim();
  }
  if (!target) return false;

  if (!silent) {
    const token = state.push("wikilink", "", 0);
    token.meta = { target, alias, anchor, embed };
  }
  state.pos = closeIdx + 2;
  return true;
}
