# Changelog

## Unreleased

- `.vscodeignore`: exclude `SPEC.md` and `*.vsix` -- SPEC.md (with dev-planning notes)
  was shipping inside the packaged VSIX.
- Fix `copilotBooster.enabled` runtime default: was falling back to `?? true` in
  `extension.ts`, contradicting the documented (and package.json-declared) default
  of `false`.
- `package.json`: add `keywords`, fix `repository.url` to include `.git` suffix.

## 0.1.1

## 0.1.0

- Initial release.
