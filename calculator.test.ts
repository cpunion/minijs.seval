/**
 * Calculator MiniJS Unit Tests
 * Tests the calculator logic by compiling and evaluating the MiniJS code
 */
import { describe, it, expect, beforeAll } from 'bun:test'
import fs from 'fs'
import path from 'path'
import { createEvaluator, type Value } from '../seval.js/src/index'

const minijsSeval = fs.readFileSync(path.join(__dirname, 'minijs.seval'), 'utf-8')
const calculatorCode = fs.readFileSync(path.join(__dirname, '../a2ui-demo/src/data/calculator.minijs'), 'utf-8')

// Custom primitives that calculator.minijs depends on
const calculatorPrimitives = {
    parseNum: (args: Value[]) => parseFloat(String(args[0])) || 0,
    round: (args: Value[]) => Math.round(args[0] as number),
    str: (args: Value[]) => String(args[0]),
    strContains: (args: Value[]) => String(args[0]).includes(String(args[1])),
    strStartsWith: (args: Value[]) => String(args[0]).startsWith(String(args[1])),
    substr: (args: Value[]) => String(args[0]).substring(args[1] as number, args[2] as number | undefined),
}

const { evalString, evaluate } = createEvaluator({
    maxDepth: 10000,
    primitives: calculatorPrimitives as any
})

let env: Record<string, unknown> = {}

beforeAll(() => {
    // Load the minijs.seval compiler
    evalString(`(progn ${minijsSeval})`, env)

    // Compile the calculator code to S-expr
    const sexpr = evalString(`(compile-to-sexpr "${calculatorCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`, env)
    console.log('Compiled S-expr:', JSON.stringify(sexpr, null, 2))

    // Evaluate the S-expr to define all functions
    evaluate(sexpr as any, env)
    console.log('Defined functions:', Object.keys(env).filter(k => k.startsWith('action') || k === 'hasDecimal' || k === 'negateStr' || k === 'formatNum' || k === 'calcOp'))
})

describe('Calculator Logic', () => {
    describe('Helper Functions', () => {
        it('hasDecimal detects decimal point', () => {
            const result = evalString('(hasDecimal "1.5")', env)
            expect(result).toBe(true)

            const result2 = evalString('(hasDecimal "42")', env)
            expect(result2).toBe(false)
        })

        it('negateStr negates a number string', () => {
            const result = evalString('(negateStr "5")', env)
            expect(result).toBe('-5')

            const result2 = evalString('(negateStr "-5")', env)
            expect(result2).toBe('5')

            const result3 = evalString('(negateStr "0")', env)
            expect(result3).toBe('0')
        })

        it('formatNum formats numbers', () => {
            const result = evalString('(formatNum 3.14159)', env)
            expect(result).toBe('3.14159')
        })

        it('calcOp performs calculations', () => {
            const add = evalString('(calcOp "+" "10" "5")', env)
            expect(add).toBe('15')

            const sub = evalString('(calcOp "-" "10" "5")', env)
            expect(sub).toBe('5')

            const mul = evalString('(calcOp "*" "10" "5")', env)
            expect(mul).toBe('50')

            const div = evalString('(calcOp "/" "10" "5")', env)
            expect(div).toBe('2')
        })
    })

    describe('Action Functions', () => {
        it('action_digit adds digit when not waiting', () => {
            // Setup: display="5", waitingForOperand=false
            const testEnv = {
                ...env,
                display: '5',
                waitingForOperand: false,
                context: { digit: 9 }
            }
            const result = evalString('(action_digit)', testEnv) as any[]
            console.log('action_digit result:', JSON.stringify(result))
            // Should append "9" to display
            expect(result).toContainEqual(['display', '59'])
        })

        it('action_digit starts fresh when waiting', () => {
            // Setup: waitingForOperand=true
            const testEnv = {
                ...env,
                display: '0',
                waitingForOperand: true,
                context: { digit: 9 }
            }
            const result = evalString('(action_digit)', testEnv) as any[]
            console.log('action_digit (waiting) result:', JSON.stringify(result))
            // Should set display to "9" and stop waiting
            expect(result).toContainEqual(['display', '9'])
            expect(result).toContainEqual(['waitingForOperand', false])
        })

        it('action_clear resets calculator', () => {
            const testEnv = { ...env }
            const result = evalString('(action_clear)', testEnv) as any[]
            console.log('action_clear result:', JSON.stringify(result))
            expect(result).toContainEqual(['display', '0'])
            expect(result).toContainEqual(['operator', ''])
        })

        it('action_operator stores first operand', () => {
            const testEnv = {
                ...env,
                display: '5',
                memory: '0',
                operator: '',
                waitingForOperand: false,
                context: { op: '+' }
            }
            const result = evalString('(action_operator)', testEnv) as any[]
            console.log('action_operator result:', JSON.stringify(result))
            expect(result).toContainEqual(['memory', '5'])
            expect(result).toContainEqual(['operator', '+'])
            expect(result).toContainEqual(['waitingForOperand', true])
        })

        it('action_equals calculates result', () => {
            // Setup: 5 + 3 =
            const testEnv = {
                ...env,
                display: '3',
                memory: '5',
                operator: '+',
                waitingForOperand: false,
                history: '5 +'
            }
            const result = evalString('(action_equals)', testEnv) as any[]
            console.log('action_equals result:', JSON.stringify(result))
            // Should calculate 5 + 3 = 8
            expect(result).toContainEqual(['display', '8'])
        })

        it('action_equals with multiplication', () => {
            // Setup: 6 * 7 =
            const testEnv = {
                ...env,
                display: '7',
                memory: '6',
                operator: '*',
                waitingForOperand: false,
                history: '6 *'
            }
            const result = evalString('(action_equals)', testEnv) as any[]
            console.log('action_equals (*) result:', JSON.stringify(result))
            // Should calculate 6 * 7 = 42
            expect(result).toContainEqual(['display', '42'])
        })
    })

    describe('Full Calculation Flow', () => {
        it('calculates 5 + 3 = 8', () => {
            // Simulate: 5 + 3 =
            let state = {
                display: '0',
                memory: '0',
                operator: '',
                waitingForOperand: true,
                history: ''
            }

            // Press 5
            let testEnv = { ...env, ...state, context: { digit: 5 } }
            let result = evalString('(action_digit)', testEnv) as any[]
            console.log('After 5:', JSON.stringify(result))
            for (const [key, value] of result) {
                (state as any)[key] = value
            }

            // Press +
            testEnv = { ...env, ...state, context: { op: '+' } }
            result = evalString('(action_operator)', testEnv) as any[]
            console.log('After +:', JSON.stringify(result))
            for (const [key, value] of result) {
                (state as any)[key] = value
            }

            // Press 3
            testEnv = { ...env, ...state, context: { digit: 3 } }
            result = evalString('(action_digit)', testEnv) as any[]
            console.log('After 3:', JSON.stringify(result))
            for (const [key, value] of result) {
                (state as any)[key] = value
            }

            // Press =
            testEnv = { ...env, ...state, context: {} }
            result = evalString('(action_equals)', testEnv) as any[]
            console.log('After =:', JSON.stringify(result))

            // Find display in result
            const displayUpdate = result.find(([k]: [string, unknown]) => k === 'display')
            expect(displayUpdate).toBeDefined()
            expect(displayUpdate[1]).toBe('8')
        })
    })
})
