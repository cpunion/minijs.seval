import fs from 'node:fs'
import path from 'node:path'
import { createEvaluator } from 'seval.js'

const minijsSeval = fs.readFileSync(path.join(import.meta.dir, 'minijs.seval'), 'utf-8')
const { evalString } = createEvaluator({ maxDepth: 10000 })

const env: Record<string, unknown> = {}
evalString(`(progn ${minijsSeval})`, env)

// Test array with strings directly
console.log('Test 1: Array with strings')
const result1 = evalString(`(compile-to-sexpr "[\\\"display\\\", \\\"test\\\"]")`, env)
console.log('Result:', JSON.stringify(result1, null, 2))

// Test nested array
console.log('\nTest 2: Nested array (action return format)')
const result2 = evalString(`(compile-to-sexpr "[[\\\"display\\\", \\\"9\\\"]]")`, env)
console.log('Result:', JSON.stringify(result2, null, 2))

// Test ternary with arrays
console.log('\nTest 3: Ternary with arrays')
const result3 = evalString(`(compile-to-sexpr "true ? [[\\\"display\\\", \\\"9\\\"]] : []")`, env)
console.log('Result:', JSON.stringify(result3, null, 2))
