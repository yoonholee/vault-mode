import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
import { wikilinkPlugin } from "../../src/markdownItPlugin";

function makeMd(resolve: (target: string) => string | undefined) {
  const md = new MarkdownIt({ html: false, linkify: false });
  md.use(wikilinkPlugin, { resolve });
  return md;
}

describe("wikilinkPlugin", () => {
  it("renders [[Note]] as an anchor", () => {
    const md = makeMd(() => "vscode-resource:/vault/Note.md");
    const html = md.render("see [[Note]]");
    expect(html).toMatch(/<a [^>]*href="vscode-resource:\/vault\/Note\.md"[^>]*>Note<\/a>/);
  });

  it("renders [[Note|alias]] with the alias as the link text", () => {
    const md = makeMd(() => "vscode-resource:/vault/Note.md");
    const html = md.render("[[Note|displayed]]");
    expect(html).toContain(">displayed</a>");
  });

  it("renders [[Note#header]] with #anchor on the URL", () => {
    const md = makeMd(() => "vscode-resource:/vault/Note.md");
    const html = md.render("[[Note#Section]]");
    expect(html).toContain("#Section");
  });

  it("renders unresolved links as a missing-link span (with class)", () => {
    const md = makeMd(() => undefined);
    const html = md.render("[[Ghost]]");
    expect(html).toMatch(/class="[^"]*wikilink-missing[^"]*"/);
    expect(html).toContain("Ghost");
  });

  it("does not render wikilinks inside fenced code blocks", () => {
    const md = makeMd(() => "vscode-resource:/vault/Note.md");
    const html = md.render("```\n[[NotALink]]\n```");
    expect(html).not.toMatch(/<a [^>]*href/);
    expect(html).toContain("[[NotALink]]");
  });

  it("does not render wikilinks inside inline code", () => {
    const md = makeMd(() => "vscode-resource:/vault/Note.md");
    const html = md.render("`[[NotALink]]` and [[Real]]");
    // The literal inside backticks is preserved
    expect(html).toContain("[[NotALink]]");
    // The one outside backticks becomes an anchor
    expect(html).toMatch(/<a [^>]*>Real<\/a>/);
  });

  it("renders multiple wikilinks in a paragraph", () => {
    const md = makeMd(() => "vscode-resource:/vault/x");
    const html = md.render("[[A]] then [[B]] then [[C]]");
    const matches = html.match(/<a /g) ?? [];
    expect(matches.length).toBe(3);
  });

  it("escapes HTML in unresolved link text", () => {
    const md = makeMd(() => undefined);
    const html = md.render("[[<script>alert(1)</script>]]");
    expect(html).not.toContain("<script>");
  });

  it("renders embeds (![[X]]) as an embed-style span", () => {
    const md = makeMd(() => "vscode-resource:/vault/Note.md");
    const html = md.render("![[Note]]");
    expect(html).toMatch(/wikilink-embed/);
  });
});
