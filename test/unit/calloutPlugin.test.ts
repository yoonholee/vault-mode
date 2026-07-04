import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
import { calloutPlugin } from "../../src/markdownItPlugin";

function makeMd() {
  const md = new MarkdownIt({ html: false, linkify: false });
  md.use(calloutPlugin);
  return md;
}

describe("calloutPlugin", () => {
  it("renders a callout header as a bold title, dropping the [!type] marker", () => {
    const html = makeMd().render("> [!note] Important thing\n> body text");
    expect(html).toContain("<strong>Important thing</strong>");
    expect(html).not.toContain("[!note]");
    expect(html).toContain("body text");
  });

  it("uses the capitalized type as the title when none is given", () => {
    const html = makeMd().render("> [!tip]\n> body");
    expect(html).toContain("<strong>Tip</strong>");
  });

  it("tags the blockquote with callout classes", () => {
    const html = makeMd().render("> [!warning] Careful");
    expect(html).toMatch(/<blockquote class="[^"]*callout callout-warning/);
  });

  it("handles fold markers [!note]- and [!note]+", () => {
    const html = makeMd().render("> [!note]- Folded\n> body");
    expect(html).toContain("<strong>Folded</strong>");
    expect(html).not.toContain("[!note]");
  });

  it("leaves ordinary blockquotes untouched", () => {
    const html = makeMd().render("> just a quote");
    expect(html).not.toContain("<strong>");
    expect(html).not.toContain("callout");
  });

  it("leaves callout syntax inside code fences untouched", () => {
    const html = makeMd().render("```\n> [!note] Not a callout\n```");
    expect(html).toContain("[!note] Not a callout");
    expect(html).not.toContain("<strong>");
  });

  it("only transforms the first paragraph line of the blockquote", () => {
    const html = makeMd().render("> [!note] Title\n> mentions [!tip] inline later");
    expect(html).toContain("<strong>Title</strong>");
    expect(html).toContain("[!tip] inline later");
  });
});
