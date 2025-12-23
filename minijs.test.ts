/**
 * Test for minijs.seval - the self-hosted MiniJS compiler
 */

import { describe, expect, it, beforeAll } from 'bun:test'
import { createEvaluator, type Environment } from '../seval.js/src'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load and evaluate minijs.seval to get the compiler functions
const minijsSeval = readFileSync(join(__dirname, './minijs.seval'), 'utf-8')

// Create evaluator with higher depth limit for complex code
const { evalString } = createEvaluator({ maxDepth: 10000 })

function loadMinijsCompiler(): Environment {
    const env: Environment = {}
    // Parse and evaluate the minijs.seval compiler
    evalString(`(progn ${minijsSeval})`, env)
    return env
}

describe('minijs.seval - Self-hosted MiniJS Compiler', () => {
    let env: Environment

    beforeAll(() => {
        env = loadMinijsCompiler()
    })

    describe('Tokenizer', () => {
        it('tokenizes numbers', () => {
            const result = evalString('(tokenize "42")', env) as any[]
            expect(result[0]).toMatchObject({ type: 'Number', value: 42 })
        })

        it('tokenizes strings', () => {
            const result = evalString('(tokenize "\\"hello\\"")', env) as any[]
            expect(result[0]).toMatchObject({ type: 'String', value: 'hello' })
        })

        it('tokenizes operators', () => {
            const result = evalString('(tokenize "+ - * ==")', env) as any[]
            expect(result[0]).toMatchObject({ type: 'Plus' })
            expect(result[1]).toMatchObject({ type: 'Minus' })
            expect(result[2]).toMatchObject({ type: 'Star' })
            expect(result[3]).toMatchObject({ type: 'Equal' })
        })
    })

    describe('Parser', () => {
        it('parses numbers', () => {
            const result = evalString('(parse "42")', env) as any
            expect(result).toMatchObject({ type: 'Literal', value: 42 })
        })

        it('parses binary expressions', () => {
            const result = evalString('(parse "1 + 2")', env) as any
            expect(result).toMatchObject({
                type: 'Binary',
                operator: '+',
                left: { type: 'Literal', value: 1 },
                right: { type: 'Literal', value: 2 },
            })
        })

        it('parses identifiers', () => {
            const result = evalString('(parse "foo")', env) as any
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
            const result = evalString('(compile-to-sexpr "[\\\"display\\\", \\\"test\\\"]")', env)
            // Strings should be wrapped with quote to preserve as values
            expect(result).toEqual(['list', ['quote', 'display'], ['quote', 'test']])
        })

        it('transforms nested arrays', () => {
            const result = evalString('(compile-to-sexpr "[[\\\"display\\\", \\\"9\\\"]]")', env)
            expect(result).toEqual(['list', ['list', ['quote', 'display'], ['quote', '9']]])
        })

        it('transforms action return format', () => {
            const result = evalString('(compile-to-sexpr "[[\\\"display\\\", \\\"9\\\"], [\\\"waitingForOperand\\\", false]]")', env)
            expect(result).toEqual(['list', ['list', ['quote', 'display'], ['quote', '9']], ['list', ['quote', 'waitingForOperand'], false]])
        })
    })

    describe('End-to-End', () => {
        it('compiles and evaluates arithmetic', () => {
            // Compile MiniJS to S-expr, then evaluate
            const sexpr = evalString('(compile-to-sexpr "1 + 2 * 3")', env) as any[]
            // Now eval the S-expr directly
            const result = evalString(`(${sexpr[0]} ${sexpr[1]} (${sexpr[2][0]} ${sexpr[2][1]} ${sexpr[2][2]}))`, {})
            expect(result).toBe(7)
        })
    })

    describe('Object Literals', () => {
        it('parses empty object', () => {
            const result = evalString('(parse "{}")', env) as any
            expect(result).toMatchObject({ type: 'Object', properties: [] })
        })

        it('parses object with method', () => {
            const result = evalString('(parse "{ add(a, b) { a + b } }")', env) as any
            expect(result.type).toBe('Object')
            expect(result.properties.length).toBe(1)
            expect(result.properties[0].key).toBe('add')
            expect(result.properties[0].method).toBe(true)
            expect(result.properties[0].params).toEqual(['a', 'b'])
        })

        it('parses object with property', () => {
            const result = evalString('(parse "{ version: 1 }")', env) as any
            expect(result.type).toBe('Object')
            expect(result.properties.length).toBe(1)
            expect(result.properties[0].key).toBe('version')
            expect(result.properties[0].method).toBe(false)
        })

        it('parses object with multiple methods', () => {
            const result = evalString('(parse "{ add(a, b) { a + b }, sub(a, b) { a - b } }")', env) as any
            expect(result.type).toBe('Object')
            expect(result.properties.length).toBe(2)
            expect(result.properties[0].key).toBe('add')
            expect(result.properties[1].key).toBe('sub')
        })

        it('transforms single method to define', () => {
            const result = evalString('(compile-to-sexpr "{ add(a, b) { a + b } }")', env) as any[]
            expect(result[0]).toBe('define')
            expect(result[1]).toEqual(['add', 'a', 'b'])
            expect(result[2]).toEqual(['+', 'a', 'b'])
        })

        it('transforms multiple methods to progn', () => {
            const result = evalString('(compile-to-sexpr "{ add(a, b) { a + b }, sub(a, b) { a - b } }")', env) as any[]
            expect(result[0]).toBe('progn')
            expect(result[1][0]).toBe('define')
            expect(result[1][1]).toEqual(['add', 'a', 'b'])
            expect(result[2][0]).toBe('define')
            expect(result[2][1]).toEqual(['sub', 'a', 'b'])
        })

        it('transforms method with no parameters', () => {
            const result = evalString('(compile-to-sexpr "{ getValue() { 42 } }")', env) as any[]
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
            const result = evalString(`(parse "${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`, env) as any
            expect(result.type).toBe('Object')
            expect(result.properties[0].value.type).toBe('Block')
        })

        it('transforms assignment to define', () => {
            const code = `{ test() { x = 1 } }`
            const result = evalString(`(compile-to-sexpr "${code}")`, env) as any
            // Body should be assignment which compiles to define
            expect(result[0]).toBe('define')
            expect(result[1]).toEqual(['test'])
            expect(result[2]).toEqual(['define', 'x', 1])
        })

        it('transforms multi-line body to progn', () => {
            const code = `{ calc(x) { a = x + 1 \\n a * 2 } }`
            const result = evalString(`(compile-to-sexpr "${code}")`, env) as any
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
            const result = evalString(`(parse "${code.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`, env) as any
            expect(result.type).toBe('Object')
            expect(result.properties.length).toBe(2)
            expect(result.properties[0].key).toBe('hasDecimal')
            expect(result.properties[1].key).toBe('action_digit')
        })

        it('transforms calculator method', () => {
            const code = `{ add(a, b) { a + b } }`
            const result = evalString(`(compile-to-sexpr "${code}")`, env) as any
            expect(result).toEqual(['define', ['add', 'a', 'b'], ['+', 'a', 'b']])
        })
    })
})
