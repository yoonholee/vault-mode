# Contributing

Bug reports and small feature requests welcome.

## Good issue reports

- Include Vault Mode version, editor, OS.
- Include the smallest markdown/vault snippet that reproduces it.
- Include relevant lines from the "Vault Mode" output channel.
- Say what you expected and what happened.

## Pull requests

Keep PRs small.
Before opening:

```sh
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

For preview/style changes, also run:

```sh
cd styles
./render.py --check
```

Large features should start as an issue first.
