// markdown-it plugin that turns [[wikilinks]] into anchors during preview render.
//
// Honors the same code-fence / inline-code skipping as the parser by relying
// on markdown-it's tokenization: we register an `inline` rule that only fires
// inside text tokens; fenced/inline-code tokens have a different type and are
// not transformed.

import type MarkdownIt from "markdown-it";
import { parseWikilinkInner } from "./wikilinkParser";

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

// Callout headers `> [!type] Title` (optional +/- fold marker) render as a bold
// title inside the blockquote, mirroring md-print's preprocess. The blockquote
// gets `callout callout-<type>` classes so CSS can style per-type later.
const CALLOUT_RE = /^\[!(\w+)\][+-]?[ \t]*(.*)$/;

interface MdToken {
  type: string;
  content: string;
  attrJoin(name: string, value: string): void;
}

export function calloutPlugin(md: MarkdownIt): void {
  md.core.ruler.after("block", "vault-callout", (state) => {
    const tokens = state.tokens as unknown as MdToken[];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== "blockquote_open") continue;
      // First inline token inside this blockquote holds the callout header.
      let j = i + 1;
      while (
        j < tokens.length &&
        tokens[j].type !== "inline" &&
        tokens[j].type !== "blockquote_close"
      )
        j++;
      if (j >= tokens.length || tokens[j].type !== "inline") continue;
      const lines = tokens[j].content.split("\n");
      const m = CALLOUT_RE.exec(lines[0]);
      if (!m) continue;
      const type = m[1].toLowerCase();
      const title = m[2].trim() || m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
      lines[0] = `**${title}**`;
      tokens[j].content = lines.join("\n");
      tokens[i].attrJoin("class", `callout callout-${type}`);
    }
  });
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

  const parts = parseWikilinkInner(inner);
  if (!parts) return false;

  if (!silent) {
    const token = state.push("wikilink", "", 0);
    token.meta = { ...parts, embed };
  }
  state.pos = closeIdx + 2;
  return true;
}
