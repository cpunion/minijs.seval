# minijs.seval

[![CI](https://github.com/cpunion/minijs.seval/actions/workflows/ci.yml/badge.svg)](https://github.com/cpunion/minijs.seval/actions/workflows/ci.yml)
[![Coverage Status](https://codecov.io/gh/cpunion/minijs.seval/branch/main/graph/badge.svg)](https://codecov.io/gh/cpunion/minijs.seval)
[![npm version](https://img.shields.io/npm/v/minijs-seval.svg)](https://www.npmjs.com/package/minijs-seval)

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

### Example: compiling the bundled calculator

```ts
import { createEvaluator, deserializeSExpr } from 'seval.js'
import compiler from 'minijs-seval'
import calculatorSource from './fixtures/calculator.minijs'

const { evalString, evaluate } = createEvaluator({
  maxDepth: 10_000,
  primitives: {
    parseNum: ([v]) => Number.parseFloat(String(v)) || 0,
    str: ([v]) => String(v),
    // ...register the other calculator primitives
  },
})

const env = {}
evalString(`(progn ${compiler})`, env)

const sexpr = deserializeSExpr(
  evalString(
    `(compile-to-sexpr "${calculatorSource.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`,
    env,
  ),
)

evaluate(sexpr, env)
const uiEnv = { ...env, display: '5', waitingForOperand: false, context: { digit: 9 } }
const updates = evalString('(action_digit)', uiEnv)
// => [['display', '59']]
```

## Scripts

| Script            | Description                                   |
| ----------------- | --------------------------------------------- |
| `bun run lint`    | Biome linting (recommended rules)             |
| `bun run format`  | Biome formatter (writes in-place)             |
| `bun run test`    | Bun test runner (unit + calculator fixtures)  |
| `bun run coverage`| Bun tests with text + lcov coverage reports   |
| `bun run format:check` | Formatter plus `git diff --exit-code` guard |

## MiniJS Syntax Overview

MiniJS mirrors a subset of modern JavaScript tailored for UI-dsl style programs:

- **Literals**: numbers, strings (single/double quotes), booleans, `null`.
- **Expressions**: binary arithmetic (`+ - * / %`), comparisons, logical ops, ternaries, unary negation.
- **Functions**: arrow expressions `x => x + 1` or multiline blocks `(a, b) => { ... }`.
- **Arrays / Objects**: `[1, 2]`, nested arrays, objects with properties or method definitions `{ calc(x) { x + 1 } }`.
- **Control**: ternaries, implicit returns from block bodies, method bodies composed of sequential statements.
- **Member access**: dot access, bracket access, method calls, nested property lookups.

Everything is lowered into S-expressions such as `(lambda (x) (+ x 1))`, making it easy to interpret inside seval.js or any Scheme/Lisp-like host.

### Built-in Helpers

When compiling MiniJS you typically expose these primitives to the runtime:

- **String/number helpers**: `parseNum`, `str`, `strContains`, `strStartsWith`, `substr`, `round`.
- **Collection helpers**: seval's `list`, `append`, `obj`, `get`, `set`, etc.
- **Control constructs**: `if`, `cond`, `progn`, `define`, `lambda`, `let`, already provided by seval.js.
- **Domain-specific primitives**: e.g. calculator operations bundled via `calculatorPrimitives` inside the tests.

Register additional primitives via `createEvaluator({ primitives: { ... } })` to match the APIs your MiniJS program expects.

## Continuous Integration

`.github/workflows/ci.yml` mirrors the local scripts: install dependencies, run format check, lint, tests with coverage,
and upload to Codecov (token provided via `CODECOV_TOKEN` secret).

## Fixtures

`fixtures/calculator.minijs` is a copy of the calculator MiniJS example from `a2ui-demo`. It allows the calculator integration
tests to run in isolation on CI without cloning the demo repository. If you change the calculator example upstream, update this
fixture to keep tests in sync.

## License

MIT © cpunion
