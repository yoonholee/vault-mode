// Decides which neighbor files to preload as preview tabs to feed Copilot context.
//
// Pure function: given the outgoing wikilinks from the active file and a
// resolver, return the deduped, capped list of neighbor absolute paths.

import type { OutgoingLink } from "./backlinksIndex";

export interface NeighborSelectionInput {
  activeFile: string;
  outgoing: OutgoingLink[];
  resolve: (target: string) => string | undefined;
  maxNeighbors: number;
  activeFileExclusionEnabled: boolean;
}

export function selectNeighborsToPreload(input: NeighborSelectionInput): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const link of input.outgoing) {
    if (out.length >= input.maxNeighbors) break;
    const resolved = input.resolve(link.target);
    if (!resolved) continue;
    if (input.activeFileExclusionEnabled && resolved === input.activeFile) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }
  return out;
}
