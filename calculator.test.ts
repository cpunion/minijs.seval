/**
 * Calculator MiniJS Unit Tests
 * Tests the calculator logic by compiling and evaluating the MiniJS code
 */
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import {
	type Environment,
	type PrimitiveFunction,
	type SExpr,
	type Value,
	createEvaluator,
	deserializeSExpr,
	serializeSExpr,
} from 'seval.js'

const minijsSeval = fs.readFileSync(path.join(__dirname, 'minijs.seval'), 'utf-8')
const calculatorCode = fs.readFileSync(path.join(__dirname, 'fixtures/calculator.minijs'), 'utf-8')

// Custom primitives that calculator.minijs depends on

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

const assignState = (state: Partial<Record<string, Value>>) => {
	Object.assign(env, state)
}

const resetState = () => {
	assignState({
		display: '0',
		memory: '0',
		operator: '',
		waitingForOperand: true,
		history: '',
	})
}

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

	resetState()
})

beforeEach(() => {
	resetState()
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

		it('calcOp handles division by zero', () => {
			const divZero = evalString('(calcOp "/" "10" "0")', env)
			expect(divZero).toBe('0')
		})

		it('calcOp handles unknown operator', () => {
			const unknown = evalString('(calcOp "^" "10" "5")', env)
			expect(unknown).toBe('5')
		})
	})

	describe('Action Functions', () => {
		it('action_digit adds digit when not waiting', () => {
			assignState({
				display: '5',
				waitingForOperand: false,
			})
			evalString('(action_digit 9)', env)
			expect(env.display).toBe('59')
			expect(env.waitingForOperand).toBe(false)
		})

		it('action_digit starts fresh when waiting', () => {
			assignState({
				display: '0',
				waitingForOperand: true,
			})
			evalString('(action_digit 9)', env)
			expect(env.display).toBe('9')
			expect(env.waitingForOperand).toBe(false)
		})

		it('action_decimal adds decimal when waiting', () => {
			assignState({
				display: '0',
				waitingForOperand: true,
			})
			evalString('(action_decimal)', env)
			expect(env.display).toBe('0.')
			expect(env.waitingForOperand).toBe(false)
		})

		it('action_decimal adds decimal to existing number', () => {
			assignState({
				display: '42',
				waitingForOperand: false,
			})
			evalString('(action_decimal)', env)
			expect(env.display).toBe('42.')
		})

		it('action_decimal does not add second decimal', () => {
			assignState({
				display: '3.14',
				waitingForOperand: false,
			})
			evalString('(action_decimal)', env)
			expect(env.display).toBe('3.14')
		})

		it('action_clear resets calculator', () => {
			assignState({
				display: '10',
				memory: '5',
				operator: '*',
				waitingForOperand: false,
				history: '10 *',
			})
			evalString('(action_clear)', env)
			expect(env.display).toBe('0')
			expect(env.operator).toBe('')
			expect(env.memory).toBe('0')
			expect(env.waitingForOperand).toBe(true)
			expect(env.history).toBe('')
		})

		it('action_negate negates positive number', () => {
			assignState({
				display: '5',
			})
			evalString('(action_negate)', env)
			expect(env.display).toBe('-5')
		})

		it('action_negate negates negative number', () => {
			assignState({
				display: '-5',
			})
			evalString('(action_negate)', env)
			expect(env.display).toBe('5')
		})

		it('action_negate does not negate zero', () => {
			assignState({
				display: '0',
			})
			evalString('(action_negate)', env)
			expect(env.display).toBe('0')
		})

		it('action_percent converts to percentage', () => {
			assignState({
				display: '50',
			})
			evalString('(action_percent)', env)
			expect(env.display).toBe('0.5')
		})

		it('action_operator stores first operand', () => {
			assignState({
				display: '5',
				memory: '0',
				operator: '',
				waitingForOperand: false,
			})
			evalString('(action_operator "+")', env)
			expect(env.memory).toBe('5')
			expect(env.operator).toBe('+')
			expect(env.waitingForOperand).toBe(true)
			expect(env.history).toBe('5 +')
		})

		it('action_operator performs chained calculation', () => {
			assignState({
				display: '5',
				memory: '10',
				operator: '+',
				waitingForOperand: false,
				history: '10 +',
			})
			evalString('(action_operator "*")', env)
			expect(env.display).toBe('15')
			expect(env.memory).toBe('15')
			expect(env.operator).toBe('*')
			expect(env.waitingForOperand).toBe(true)
			expect(env.history).toBe('15 *')
		})

		it('action_equals calculates result', () => {
			assignState({
				display: '3',
				memory: '5',
				operator: '+',
				waitingForOperand: false,
				history: '5 +',
			})
			evalString('(action_equals)', env)
			expect(env.display).toBe('8')
			expect(env.operator).toBe('')
			expect(env.memory).toBe('0')
			expect(env.history).toBe('5 + 3 = 8')
		})

		it('action_equals with multiplication', () => {
			assignState({
				display: '7',
				memory: '6',
				operator: '*',
				waitingForOperand: false,
				history: '6 *',
			})
			evalString('(action_equals)', env)
			expect(env.display).toBe('42')
			expect(env.history).toBe('6 * 7 = 42')
		})

		it('action_equals with subtraction', () => {
			assignState({
				display: '3',
				memory: '10',
				operator: '-',
				waitingForOperand: false,
				history: '10 -',
			})
			evalString('(action_equals)', env)
			expect(env.display).toBe('7')
			expect(env.history).toBe('10 - 3 = 7')
		})

		it('action_equals with division', () => {
			assignState({
				display: '4',
				memory: '20',
				operator: '/',
				waitingForOperand: false,
				history: '20 /',
			})
			evalString('(action_equals)', env)
			expect(env.display).toBe('5')
			expect(env.history).toBe('20 / 4 = 5')
		})

		it('action_equals does nothing without operator', () => {
			assignState({
				display: '42',
				memory: '0',
				operator: '',
				waitingForOperand: false,
				history: '',
			})
			evalString('(action_equals)', env)
			expect(env.display).toBe('42')
			expect(env.history).toBe('')
		})
	})

	describe('Full Calculation Flow', () => {
		it('calculates 5 + 3 = 8', () => {
			evalString('(action_digit 5)', env)
			expect(env.display).toBe('5')

			evalString('(action_operator "+")', env)
			expect(env.waitingForOperand).toBe(true)

			evalString('(action_digit 3)', env)
			expect(env.display).toBe('3')

			evalString('(action_equals)', env)
			expect(env.display).toBe('8')
			expect(env.history).toBe('5 + 3 = 8')
		})

		it('calculates 12.5 * 4 = 50', () => {
			evalString('(action_digit 1)', env)
			evalString('(action_digit 2)', env)
			evalString('(action_decimal)', env)
			evalString('(action_digit 5)', env)
			expect(env.display).toBe('12.5')

			evalString('(action_operator "*")', env)

			evalString('(action_digit 4)', env)
			evalString('(action_equals)', env)
			expect(env.display).toBe('50')
		})

		it('calculates chained operations: 10 + 5 * 2 = 30', () => {
			// Start with 10
			evalString('(action_digit 1)', env)
			evalString('(action_digit 0)', env)
			expect(env.display).toBe('10')

			// + 5 (intermediate result: 15)
			evalString('(action_operator "+")', env)
			evalString('(action_digit 5)', env)

			// * 2 (triggers 10 + 5 = 15, then sets up * operation)
			evalString('(action_operator "*")', env)
			expect(env.display).toBe('15')

			// = (calculates 15 * 2 = 30)
			evalString('(action_digit 2)', env)
			evalString('(action_equals)', env)
			expect(env.display).toBe('30')
		})

		it('handles negate and percent in calculation', () => {
			evalString('(action_digit 5)', env)
			evalString('(action_digit 0)', env)
			evalString('(action_percent)', env)
			expect(env.display).toBe('0.5')

			evalString('(action_negate)', env)
			expect(env.display).toBe('-0.5')
		})

		it('handles clear during calculation', () => {
			evalString('(action_digit 5)', env)
			evalString('(action_operator "+")', env)
			evalString('(action_digit 3)', env)
			evalString('(action_clear)', env)

			expect(env.display).toBe('0')
			expect(env.operator).toBe('')
			expect(env.memory).toBe('0')
			expect(env.history).toBe('')
		})
	})
})
