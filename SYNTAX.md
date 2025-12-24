# MiniJS Syntax Specification

MiniJS is a JavaScript-like DSL that compiles to S-expressions. It's designed to be embedded in JSON configurations and evaluated using the seval runtime.

## Literals

### Numbers

```javascript
42; // Integer
3.14 - // Floating point
  5; // Negative numbers
```

### Strings

```javascript
"hello"; // Double-quoted strings
"world"; // Single-quoted strings
```

**Escape sequences:**

- `\n` - newline
- `\t` - tab
- `\\` - backslash
- `\"` - double quote
- `\'` - single quote

### Booleans

```javascript
true;
false;
```

### Null

```javascript
null;
```

### Arrays

```javascript
[][(1, 2, 3)][("a", "b")][(1, "two", 3)]; // Empty array // Array with elements // String array // Mixed types
```

## Operators

### Arithmetic

| Operator | Description    | S-expr    |
| -------- | -------------- | --------- |
| `a + b`  | Addition       | `(+ a b)` |
| `a - b`  | Subtraction    | `(- a b)` |
| `a * b`  | Multiplication | `(* a b)` |
| `a / b`  | Division       | `(/ a b)` |
| `a % b`  | Modulo         | `(% a b)` |
| `-a`     | Unary minus    | `(- 0 a)` |

### Comparison

| Operator | Description      | S-expr     |
| -------- | ---------------- | ---------- |
| `a == b` | Equality         | `(= a b)`  |
| `a != b` | Inequality       | `(!= a b)` |
| `a < b`  | Less than        | `(< a b)`  |
| `a > b`  | Greater than     | `(> a b)`  |
| `a <= b` | Less or equal    | `(<= a b)` |
| `a >= b` | Greater or equal | `(>= a b)` |

### Logical

| Operator   | Description | S-expr      |
| ---------- | ----------- | ----------- |
| `a && b`   | Logical AND | `(and a b)` |
| `a \|\| b` | Logical OR  | `(or a b)`  |
| `!a`       | Logical NOT | `(not a)`   |

### Ternary Conditional

```javascript
condition ? valueIfTrue : valueIfFalse;
```

Compiles to: `(if condition valueIfTrue valueIfFalse)`

## Operator Precedence (highest to lowest)

1. Unary operators: `!`, `-` (prefix)
2. Multiplicative: `*`, `/`, `%`
3. Additive: `+`, `-`
4. Comparison: `<`, `>`, `<=`, `>=`
5. Equality: `==`, `!=`
6. Logical AND: `&&`
7. Logical OR: `||`
8. Ternary: `?:`

Parentheses can be used to override precedence: `(1 + 2) * 3`

## Functions

### Arrow Functions

```javascript
// Single parameter (no parentheses needed)
x => x * 2

// Multiple parameters
(a, b) => a + b

// No parameters
() => 42

// With expression body
(x, y) => x > y ? x : y
```

Arrow functions compile to `(lambda (params...) body)`.

### Function Calls

```javascript
// Simple call
add(1, 2);

// Nested calls
max(abs(x), abs(y));

// Chained calls
map(filter(list, predicate), transform);
```

## Object Literals with Method Definitions

Object literals are used to define multiple functions at once:

```javascript
{
  // Method definition (short syntax)
  add(a, b) { a + b },

  // Method with multi-line body
  calculate(op, a, b) {
    result = op == "+" ? a + b : a - b
    result * 2
  },

  // Method with no parameters
  greeting() { "Hello, World!" },

  // Property definition (value)
  version: 1
}
```

### Multi-line Function Bodies

Function bodies support multiple statements, one per line:

```javascript
{
  processData(input) {
    // First statement: assignment
    cleaned = trim(input)
    // Second statement: another assignment
    upper = toUpperCase(cleaned)
    // Last line: return value (no explicit return needed)
    length(upper)
  }
}
```

**Rules for multi-line bodies:**

- Each line is a separate statement/expression
- Statements are separated by newlines
- A line continues if it ends with a binary operator (`+`, `-`, `*`, `/`, `?`, `:`, `&&`, `||`, etc.)
- The last expression is the implicit return value
- Multiple statements compile to `(progn stmt1 stmt2 ... lastExpr)`

**Assignment expressions:**

```javascript
x = value; // Compiles to: (define x value) if x is new
a = b + c; // Compiles to: (define a (+ b c))
display = "42"; // Rebinds the existing symbol `display`
```

Assignments either create a new binding (if the identifier has never been defined) or
mutate an existing binding within the current environment. This is how component
state is updated inside method bodies.

### Important Notes

- Method body uses `{ }` braces, not `=> ` arrow
- No explicit `return` keyword - last expression is returned
- Use `=` for assignment (creates local binding via `define`)
- Object compiles to: `(progn (define (method1 params) body1) (define (method2 params) body2) ...)`

## Member Access

### Dot Notation

```javascript
obj.property;
obj.nested.deep.value;
context.op;
```

### Bracket Notation

```javascript
arr[0];
arr[index];
obj["key"];
obj[computedKey];
```

Both compile to `(get object property)`.

## Comments

```javascript
// Single line comment
1 + 2; // End of line comment
```

Multi-line comments are not supported.

## Component Objects and State

MiniJS programs are usually written as a single object literal. Properties declared with
`name: value` become top-level bindings, perfect for storing UI state:

```javascript
{
  display: "0",
  waitingForOperand: true,
  history: "",

  action_digit(digit) {
    if waitingForOperand {
      display = str(digit)
      waitingForOperand = false
    } else {
      display = display + str(digit)
    }
  }
}
```

Because the evaluator preserves the environment between calls, successive invocations of
`action_digit` mutate the same `display`/`waitingForOperand` variables.

## Structured Control Flow

### If / Elif / Else Blocks

```javascript
if condition {
  // statements
} elif otherCondition {
  // statements
} else {
  // fallback
}
```

Each branch is compiled to nested `(if ...)` forms. The `elif` section can appear zero or
many times, and `else` is optional.

### For Loops

MiniJS supports a compact `for init; test; update { ... }` syntax:

```javascript
sum = 0
for i = 0; i < 5; i = i + 1 {
  sum = sum + i
}
```

This expands to a recursive loop in S-expressions. All three clauses are optional:
omit `init` or `update` by leaving the slot empty (`for (; condition; ) { ... }`), and the
test defaults to `true` when omitted.

## Complete Example

```javascript
{
  display: "0",
  memory: "0",
  operator: "",
  waitingForOperand: true,
  history: "",

  hasDecimal(s) { strContains(str(s), ".") },
  formatNum(n) { str(round(n * 1000000000) / 1000000000) },

  action_operator(op) {
    if operator == "" {
      memory = display
      operator = op
      waitingForOperand = true
      history = display + " " + op
    } else {
      result = calcOp(operator, memory, display)
      display = result
      memory = result
      operator = op
      waitingForOperand = true
      history = result + " " + op
    }
  }
}
```

## S-Expression Mapping

| MiniJS           | S-Expression           |
| ---------------- | ---------------------- |
| `42`             | `42`                   |
| `"hello"`        | `"\u0000STR:hello"`    |
| `true` / `false` | `true` / `false`       |
| `null`           | `null`                 |
| `[1, 2, 3]`      | `(list 1 2 3)`         |
| `a + b`          | `(+ a b)`              |
| `a == b`         | `(= a b)`              |
| `a && b`         | `(and a b)`            |
| `!a`             | `(not a)`              |
| `a ? b : c`      | `(if a b c)`           |
| `x => x * 2`     | `(lambda (x) (* x 2))` |
| `f(a, b)`        | `(f a b)`              |
| `obj.prop`       | `(get obj "prop")`     |
| `arr[i]`         | `(get arr i)`          |
| `{ f(x) { x } }` | `(define (f x) x)`     |

## Differences from JavaScript

| Feature     | MiniJS                          | JavaScript                 |
| ----------- | ------------------------------- | -------------------------- |
| Equality    | `==` is strict (like `===`)     | `==` is loose              |
| Logical ops | Return boolean                  | Return operand             |
| Statements  | Expression-only                 | Has statements             |
| Variables   | No `const`/`let`/`var`          | Has declarations           |
| Objects     | Method shorthand only           | Full object literals       |
| Classes     | Not supported                   | Supported                  |
| Loops       | `for (init; test; update)` only | `for`, `while`, `do`, etc. |

## Built-in Functions (from seval)

MiniJS code has access to all seval primitives:

### Type Functions

- `type(value)` - Get type name
- `str(value)` - Convert to string
- `parse-num(str)` / `parseNum(str)` - Parse string to number

### Arithmetic

- `round(n)`, `floor(n)`, `ceil(n)`
- `abs(n)`, `min(a, b)`, `max(a, b)`

### String

- `strlen(s)`, `substr(s, start, end)`
- `strContains(s, substr)`, `strStartsWith(s, prefix)`
- `concat(a, b)`

### List/Array

- `list(...)` - Create list
- `length(list)` - Get length
- `nth(list, index)` - Get element at index
- `first(list)`, `rest(list)`
- `append(list, item)` - Append item
- `prepend(list, item)` - Prepend item
- `map(fn, list)`, `filter(fn, list)`, `reduce(fn, init, list)`

### Object

- `obj(key1, val1, key2, val2, ...)` - Create object
- `get(obj, key)` - Get property
- `set(obj, key, value)` - Set property (returns new object)
- `keys(obj)` - Get all keys
- `merge(obj1, obj2)` - Merge objects

### Utility

- `now()` - Current timestamp in milliseconds
