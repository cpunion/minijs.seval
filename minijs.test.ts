/**
 * Test for minijs.seval - the self-hosted MiniJS compiler
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	type Environment,
	type SExpr,
	type Value,
	type ValueObject,
	createEvaluator,
	deserializeSExpr,
} from 'seval.js'

// Load and evaluate minijs.seval to get the compiler functions
const minijsSeval = readFileSync(join(__dirname, './minijs.seval'), 'utf-8')

// Create evaluator with higher depth limit for complex code
const { evalString, evaluate } = createEvaluator({ maxDepth: 10000 })

function loadMinijsCompiler(): Environment {
	const env: Environment = {}
	// Parse and evaluate the minijs.seval compiler
	evalString(`(progn ${minijsSeval})`, env)
	return env
}

type Token = ValueObject
type AstNode = ValueObject

describe('minijs.seval - Self-hosted MiniJS Compiler', () => {
	let env: Environment

	const evalTokens = (source: string): Token[] => evalString(source, env) as Token[]
	const evalAst = (source: string): AstNode => evalString(source, env) as AstNode
	const evalSExpr = (source: string): SExpr => evalString(source, env) as SExpr
	const evalValue = <T extends Value>(source: string): T => evalString(source, env) as T

	beforeAll(() => {
		env = loadMinijsCompiler()
	})

	describe('Tokenizer', () => {
		it('tokenizes numbers', () => {
			const result = evalTokens('(tokenize "42")')
			expect(result[0]).toMatchObject({ type: 'Number', value: 42 })
		})

		it('tokenizes strings', () => {
			const result = evalTokens('(tokenize "\\"hello\\"")')
			expect(result[0]).toMatchObject({ type: 'String', value: 'hello' })
		})

		it('tokenizes operators', () => {
			const result = evalTokens('(tokenize "+ - * ==")')
			expect(result[0]).toMatchObject({ type: 'Plus' })
			expect(result[1]).toMatchObject({ type: 'Minus' })
			expect(result[2]).toMatchObject({ type: 'Star' })
			expect(result[3]).toMatchObject({ type: 'Equal' })
		})
	})

	describe('Parser', () => {
		it('parses numbers', () => {
			const result = evalAst('(parse "42")')
			expect(result).toMatchObject({ type: 'Literal', value: 42 })
		})

		it('parses binary expressions', () => {
			const result = evalAst('(parse "1 + 2")')
			expect(result).toMatchObject({
				type: 'Binary',
				operator: '+',
				left: { type: 'Literal', value: 1 },
				right: { type: 'Literal', value: 2 },
			})
		})

		it('parses identifiers', () => {
			const result = evalAst('(parse "foo")')
			expect(result).toMatchObject({ type: 'Identifier', name: 'foo' })
		})
	})

	describe('Transformer', () => {
		it('transforms literals', () => {
			const result = evalString('(compile-to-sexpr "42")', env)
			expect(result).toBe(42)
		})

		it('transforms binary expressions', () => {
			const result = evalString('(compile-to-sexpr "1 + 2")', env)
			expect(result).toEqual(['+', 1, 2])
		})

		it('transforms comparisons', () => {
			const result = evalString('(compile-to-sexpr "a > b")', env)
			expect(result).toEqual(['>', 'a', 'b'])
		})

		it('transforms ternary', () => {
			const result = evalString('(compile-to-sexpr "a ? b : c")', env)
			expect(result).toEqual(['if', 'a', 'b', 'c'])
		})

		it('transforms arrow functions', () => {
			const result = evalString('(compile-to-sexpr "x => x + 1")', env)
			expect(result).toEqual(['lambda', ['x'], ['+', 'x', 1]])
		})

		it('transforms arrays', () => {
			const result = evalString('(compile-to-sexpr "[1, 2, 3]")', env)
			expect(result).toEqual(['list', 1, 2, 3])
		})

		it('transforms arrays with strings', () => {
			const result = evalString('(compile-to-sexpr "[\\"display\\", \\"test\\"]")', env)
			// Strings should be wrapped with quote to preserve as values
			expect(result).toEqual(['list', ['quote', 'display'], ['quote', 'test']])
		})

		it('transforms nested arrays', () => {
			const result = evalString('(compile-to-sexpr "[[\\"display\\", \\"9\\"]]")', env)
			expect(result).toEqual(['list', ['list', ['quote', 'display'], ['quote', '9']]])
		})

		it('transforms if/elif/else statements', () => {
			const code = `{
        action() {
          if waitingForOperand {
            display = "0"
            waitingForOperand = false
          } elif operator == "" {
            operator = "+"
          } else {
            history = ""
          }
        }
      }`
			const expr = `(compile-to-sexpr "${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`
			const result = evalSExpr(expr) as Value[]
			expect(result[0]).toBe('define')
			const body = result[2] as Value[]
			expect(body[0]).toBe('if')
			expect(body[1]).toBe('waitingForOperand')
			const firstBranch = body[2] as Value[]
			expect(firstBranch[0]).toBe('progn')
			const elifBranch = body[3] as Value[]
			expect(elifBranch[0]).toBe('if')
		})
	})

	describe('End-to-End', () => {
		it('compiles and evaluates arithmetic', () => {
			// Compile MiniJS to S-expr, then evaluate
			const sexpr = evalSExpr('(compile-to-sexpr "1 + 2 * 3")') as Value[]
			// Now eval the S-expr directly
			const result = evalString(
				`(${sexpr[0]} ${sexpr[1]} (${sexpr[2][0]} ${sexpr[2][1]} ${sexpr[2][2]}))`,
				{},
			)
			expect(result).toBe(7)
		})
	})

	describe('Object Literals', () => {
		it('parses empty object', () => {
			const result = evalAst('(parse "{}")')
			expect(result).toMatchObject({ type: 'Object', properties: [] })
		})

		it('parses object with method', () => {
			const result = evalAst('(parse "{ add(a, b) { a + b } }")')
			expect(result.type).toBe('Object')
			expect(result.properties.length).toBe(1)
			expect(result.properties[0].key).toBe('add')
			expect(result.properties[0].method).toBe(true)
			expect(result.properties[0].params).toEqual(['a', 'b'])
		})

		it('parses object with property', () => {
			const result = evalAst('(parse "{ version: 1 }")')
			expect(result.type).toBe('Object')
			expect(result.properties.length).toBe(1)
			expect(result.properties[0].key).toBe('version')
			expect(result.properties[0].method).toBe(false)
		})

		it('parses object with multiple methods', () => {
			const result = evalAst('(parse "{ add(a, b) { a + b }, sub(a, b) { a - b } }")')
			expect(result.type).toBe('Object')
			expect(result.properties.length).toBe(2)
			expect(result.properties[0].key).toBe('add')
			expect(result.properties[1].key).toBe('sub')
		})

		it('transforms single method to define', () => {
			const result = evalSExpr('(compile-to-sexpr "{ add(a, b) { a + b } }")') as Value[]
			expect(result[0]).toBe('define')
			expect(result[1]).toEqual(['add', 'a', 'b'])
			expect(result[2]).toEqual(['+', 'a', 'b'])
		})

		it('transforms multiple methods to progn', () => {
			const result = evalSExpr(
				'(compile-to-sexpr "{ add(a, b) { a + b }, sub(a, b) { a - b } }")',
			) as Value[]
			expect(result[0]).toBe('progn')
			expect(result[1][0]).toBe('define')
			expect(result[1][1]).toEqual(['add', 'a', 'b'])
			expect(result[2][0]).toBe('define')
			expect(result[2][1]).toEqual(['sub', 'a', 'b'])
		})

		it('transforms method with no parameters', () => {
			const result = evalSExpr('(compile-to-sexpr "{ getValue() { 42 } }")') as Value[]
			expect(result[0]).toBe('define')
			expect(result[1]).toEqual(['getValue'])
			expect(result[2]).toBe(42)
		})
	})

	describe('Multi-line Function Bodies', () => {
		it('parses method with multi-line body', () => {
			const code = `{
                process(x) {
                    a = x + 1
                    a * 2
                }
            }`
			const expr = `(parse "${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`
			const result = evalAst(expr)
			expect(result.type).toBe('Object')
			expect(result.properties[0].value.type).toBe('Block')
		})

		it('transforms assignment to define', () => {
			const code = '{ test() { x = 1 } }'
			const expr = `(compile-to-sexpr "${code}")`
			const result = evalSExpr(expr) as Value[]
			// Body should be assignment which compiles to define
			expect(result[0]).toBe('define')
			expect(result[1]).toEqual(['test'])
			expect(result[2]).toEqual(['define', 'x', 1])
		})

		it('transforms multi-line body to progn', () => {
			const code = '{ calc(x) { a = x + 1 \\n a * 2 } }'
			const expr = `(compile-to-sexpr "${code}")`
			const result = evalSExpr(expr) as Value[]
			expect(result[0]).toBe('define')
			expect(result[1]).toEqual(['calc', 'x'])
			// Body should be (progn (define a ...) (* a 2))
			expect(result[2][0]).toBe('progn')
		})
	})

	describe('Calculator Example', () => {
		it('parses calculator-style code', () => {
			const code = `{
                hasDecimal(s) { strContains(str(s), ".") },
                action_digit() {
                    display + str(get(context, "digit"))
                }
            }`
			const expr = `(parse "${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`
			const result = evalAst(expr)
			expect(result.type).toBe('Object')
			expect(result.properties.length).toBe(2)
			expect(result.properties[0].key).toBe('hasDecimal')
			expect(result.properties[1].key).toBe('action_digit')
		})

		it('transforms calculator method', () => {
			const code = '{ add(a, b) { a + b } }'
			const expr = `(compile-to-sexpr "${code}")`
			const result = evalSExpr(expr) as Value[]
			expect(result).toEqual(['define', ['add', 'a', 'b'], ['+', 'a', 'b']])
		})
	})

	describe('Control Flow Enhancements', () => {
		it('executes for loops and updates state', () => {
			const loopEnv = loadMinijsCompiler()
			const code = `{
        total: 0,
        sum() {
          total = 0
          for (i = 0; i < 3; i = i + 1) {
            total = total + i
          }
        }
      }`
			const expr = `(compile-to-sexpr "${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`
			const programRaw = evalString(expr, loopEnv) as Value
			const program = deserializeSExpr(programRaw)
			evaluate(program as SExpr, loopEnv)
			evalString('(sum)', loopEnv)
			expect(loopEnv.total).toBe(3)
		})
	})
})
