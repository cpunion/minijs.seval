/**
 * Calculator MiniJS Unit Tests
 * Tests the calculator logic by compiling and evaluating the MiniJS code
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import {
	type Environment,
	type PrimitiveFunction,
	type SExpr,
	type Value,
	type ValueObject,
	createEvaluator,
	deserializeSExpr,
	serializeSExpr,
} from 'seval.js'

const minijsSeval = fs.readFileSync(path.join(__dirname, 'minijs.seval'), 'utf-8')
const calculatorCode = fs.readFileSync(
	path.join(__dirname, 'fixtures/calculator.minijs'),
	'utf-8',
)

// Custom primitives that calculator.minijs depends on

type UpdateEntry = [string, Value]
type UpdateList = UpdateEntry[]

const createTestEnv = (overrides: ValueObject = {}): Environment => ({
	...env,
	...overrides,
})

const calculatorPrimitives: Record<string, PrimitiveFunction> = {
	parseNum: (args: Value[]) => Number.parseFloat(String(args[0])) || 0,
	round: (args: Value[]) => Math.round(args[0] as number),
	str: (args: Value[]) => String(args[0]),
	strContains: (args: Value[]) => String(args[0]).includes(String(args[1])),
	strStartsWith: (args: Value[]) => String(args[0]).startsWith(String(args[1])),
	substr: (args: Value[]) =>
		String(args[0]).substring(args[1] as number, args[2] as number | undefined),
}

const { evalString, evaluate } = createEvaluator({
	maxDepth: 10000,
	primitives: calculatorPrimitives,
})

const env: Environment = {}

beforeAll(() => {
	// Load the minijs.seval compiler
	evalString(`(progn ${minijsSeval})`, env)

	// Compile the calculator code to S-expr
	const sexprRaw = evalString(
		`(compile-to-sexpr "${calculatorCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}")`,
		env,
	)
	const sexpr = deserializeSExpr(sexprRaw as Value)
	console.log('Compiled S-expr:', JSON.stringify(serializeSExpr(sexpr), null, 2))

	// Evaluate the S-expr to define all functions
	evaluate(sexpr as SExpr, env)
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
			const testEnv = createTestEnv({
				display: '5',
				waitingForOperand: false,
				context: { digit: 9 } as Value,
			})
			const result = evalString('(action_digit)', testEnv) as UpdateList
			// Should append "9" to display
			expect(result).toContainEqual(['display', '59'])
		})

		it('action_digit starts fresh when waiting', () => {
			// Setup: waitingForOperand=true
			const testEnv = createTestEnv({
				display: '0',
				waitingForOperand: true,
				context: { digit: 9 } as Value,
			})
			const result = evalString('(action_digit)', testEnv) as UpdateList
			// Should set display to "9" and stop waiting
			expect(result).toContainEqual(['display', '9'])
			expect(result).toContainEqual(['waitingForOperand', false])
		})

		it('action_clear resets calculator', () => {
			const testEnv = createTestEnv()
			const result = evalString('(action_clear)', testEnv) as UpdateList
			expect(result).toContainEqual(['display', '0'])
			expect(result).toContainEqual(['operator', ''])
		})

		it('action_operator stores first operand', () => {
			const testEnv = createTestEnv({
				display: '5',
				memory: '0',
				operator: '',
				waitingForOperand: false,
				context: { op: '+' } as Value,
			})
			const result = evalString('(action_operator)', testEnv) as UpdateList
			expect(result).toContainEqual(['memory', '5'])
			expect(result).toContainEqual(['operator', '+'])
			expect(result).toContainEqual(['waitingForOperand', true])
		})

		it('action_equals calculates result', () => {
			// Setup: 5 + 3 =
			const testEnv = createTestEnv({
				display: '3',
				memory: '5',
				operator: '+',
				waitingForOperand: false,
				history: '5 +',
			})
			const result = evalString('(action_equals)', testEnv) as UpdateList
			// Should calculate 5 + 3 = 8
			expect(result).toContainEqual(['display', '8'])
		})

		it('action_equals with multiplication', () => {
			// Setup: 6 * 7 =
			const testEnv = createTestEnv({
				display: '7',
				memory: '6',
				operator: '*',
				waitingForOperand: false,
				history: '6 *',
			})
			const result = evalString('(action_equals)', testEnv) as UpdateList
			// Should calculate 6 * 7 = 42
			expect(result).toContainEqual(['display', '42'])
		})
	})

	describe('Full Calculation Flow', () => {
		it('calculates 5 + 3 = 8', () => {
			// Simulate: 5 + 3 =
			const state: Record<string, Value> = {
				display: '0',
				memory: '0',
				operator: '',
				waitingForOperand: true,
				history: '',
			}

			// Press 5
			let testEnv = createTestEnv({ ...state, context: { digit: 5 } })
			let result = evalString('(action_digit)', testEnv) as UpdateList
			for (const [key, value] of result) {
				state[key] = value
			}

			// Press +
			testEnv = createTestEnv({ ...state, context: { op: '+' } })
			result = evalString('(action_operator)', testEnv) as UpdateList
			for (const [key, value] of result) {
				state[key] = value
			}

			// Press 3
			testEnv = createTestEnv({ ...state, context: { digit: 3 } })
			result = evalString('(action_digit)', testEnv) as UpdateList
			for (const [key, value] of result) {
				state[key] = value
			}

			// Press =
			testEnv = createTestEnv({ ...state, context: {} })
			result = evalString('(action_equals)', testEnv) as UpdateList

			// Find display in result
			const displayUpdate = result.find(([k]: UpdateEntry) => k === 'display')
			expect(displayUpdate).toBeDefined()
			expect(displayUpdate[1]).toBe('8')
		})
	})
})
