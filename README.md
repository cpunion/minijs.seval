# minijs.seval

MiniJS compiler implemented entirely in S-expressions and self-hosted on top of [seval.js](https://github.com/cpunion/seval.js).  
It exposes the compiler source as a string so you can embed the MiniJS → S-expression pipeline in your own runtimes, and it ships
with integration tests that exercise the calculator example used in the A2UI demos.

## Features

- **Self-hosted compiler** – tokeniser, parser and transformer are written in MiniJS then evaluated via seval.js.
- **Embeddable artifact** – importing `minijs-seval` returns the raw `.seval` program for use in custom toolchains.
- **Example fixtures** – bundles the calculator MiniJS program used by A2UI for smoke/e2e testing.
- **Bun/BIOME toolchain** – consistent formatting, linting and testing via Bun scripts and GitHub Actions.

## Getting Started

```bash
bun add minijs-seval
```

Each export returns the compiler source as a string:

```ts
import compilerSource from 'minijs-seval'
// or
import source from 'minijs-seval/source'
import raw from 'minijs-seval/minijs.seval'
```

Load it into seval.js to compile MiniJS programs:

```ts
import { createEvaluator, deserializeSExpr } from 'seval.js'
import compiler from 'minijs-seval'

const { evalString, evaluate } = createEvaluator({ maxDepth: 10_000 })
const env = {}

evalString(`(progn ${compiler})`, env)

const miniProgram = 'x => x + 1'
const sexprRaw = evalString(
  `(compile-to-sexpr "${miniProgram.replace(/"/g, '\\"')}")`,
  env,
)
const sexpr = deserializeSExpr(sexprRaw)
evaluate(sexpr, env)
```

## Scripts

| Script            | Description                                   |
| ----------------- | --------------------------------------------- |
| `bun run lint`    | Biome linting (recommended rules)             |
| `bun run format`  | Biome formatter (writes in-place)             |
| `bun run test`    | Bun test runner (unit + calculator fixtures)  |
| `bun run coverage`| Bun tests with text + lcov coverage reports   |
| `bun run format:check` | Formatter plus `git diff --exit-code` guard |

## Continuous Integration

`.github/workflows/ci.yml` mirrors the local scripts: install dependencies, run format check, lint, tests with coverage,
and upload to Codecov (token provided via `CODECOV_TOKEN` secret).

## Fixtures

`fixtures/calculator.minijs` is a copy of the calculator MiniJS example from `a2ui-demo`. It allows the calculator integration
tests to run in isolation on CI without cloning the demo repository. If you change the calculator example upstream, update this
fixture to keep tests in sync.

## License

MIT © cpunion
