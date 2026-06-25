# @seekstar/level-runtime

Chunked Level Runtime turns AI Cartographer output into renderer-subservable terrain drafts.

P6.1 keeps this package CLI-testable and independent of Electron, React, Pixi, Playwright, and Storage. It accepts one unified input shape for `supra_macro`, `L0`, `L1`, `L2`, `L3`, `deep_lens`, and `recursive_seed`, then returns nodes, relations, source candidates, chunk hints, and diagnostics.

```bash
npm --workspace @seekstar/level-runtime run build
node packages/level-runtime/dist/cli.js run --input input.json
```

Source candidates emitted by this package are `cartographer_unverified_source`; DataService must validate them before any L3 tile becomes `source_backed`.
