# Lessons

Durable, non-obvious learnings only. Each entry: claim, evidence, when-it-applies.

## Smoke-test external dependencies against the real target before committing architecture

**Claim:** When choosing an architecture that hinges on an external dependency, run that dependency against the real production data, not just a fixture, before treating the architecture decision as locked.

**Evidence:** marksman LSP passed cleanly on a 3-file fixture and a 929-file subset. Crashed reproducibly on the real 4815-file vault. We would have built half the extension before discovering the crash if we had skipped the vault smoke test.

**When it applies:** Any "delegate the hard part to an external tool" architecture decision. The cost of one upfront smoke test is far less than the cost of designing around a tool that doesn't work.

