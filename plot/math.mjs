import { toGraphExpression } from './latex.mjs'

const functions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
}

function nthRoot(value, order) {
  if (order === 0) return NaN
  if (value < 0 && Number.isInteger(order) && Math.abs(order % 2) === 1) return -((-value) ** (1 / order))
  return value ** (1 / order)
}

export function normalizeExpression(text) {
  return text.trim().replace(/[（）＝，＋－＾＊／]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-').replaceAll('²', '^2').replaceAll('³', '^3').replaceAll('π', 'pi')
}

export function compileExpression(text, variables = []) {
  const source = normalizeExpression(text).toLowerCase()
  if (!source || source.length > 2048) throw new Error('表达式为空或过长。')
  const tokens = source.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?|[a-z]+|[+*/^()\-]|\S/g) ?? []
  const known = new Set(['x', 'pi', 'e', ...variables])
  let cursor = 0
  const take = (token) => {
    if (tokens[cursor] !== token) return false
    cursor++
    return true
  }
  const startsAtom = (token) => token === '(' || /^[a-z\d.]/.test(token ?? '')

  function sum() {
    let left = product()
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const operator = tokens[cursor++]
      const a = left, b = product()
      left = operator === '+' ? (scope) => a(scope) + b(scope) : (scope) => a(scope) - b(scope)
    }
    return left
  }

  function product() {
    let left = signed()
    while (tokens[cursor] === '*' || tokens[cursor] === '/' || startsAtom(tokens[cursor])) {
      const divide = take('/')
      if (!divide) take('*')
      const a = left, b = signed()
      left = divide ? (scope) => a(scope) / b(scope) : (scope) => a(scope) * b(scope)
    }
    return left
  }

  function signed() {
    if (take('+')) return signed()
    if (take('-')) {
      const operand = signed()
      return (scope) => -operand(scope)
    }
    const base = atom()
    if (!take('^')) return base
    const exponent = signed()
    return (scope) => base(scope) ** exponent(scope)
  }

  function parenthesized() {
    const operand = sum()
    if (!take(')')) throw new Error('缺少右括号。')
    return operand
  }

  function atom() {
    if (take('(')) return parenthesized()
    const token = tokens[cursor++]
    if (token && /^[\d.]/.test(token)) {
      const number = Number(token)
      if (Number.isFinite(number)) return () => number
    }
    if (Object.hasOwn(functions, token)) {
      if (!take('(')) throw new Error(`${token} 的参数需要放在括号内。`)
      const operand = parenthesized()
      return (scope) => functions[token](operand(scope))
    }
    if (token === 'root') {
      if (!take('(')) throw new Error('根式缺少参数。')
      const operand = sum()
      if (!take(',')) throw new Error('根式缺少根指数。')
      const order = parenthesized()
      return (scope) => nthRoot(operand(scope), order(scope))
    }
    if (known.has(token)) return (scope) => scope[token]
    throw new Error(token ? `无法识别「${token}」。` : '表达式还未写完。')
  }

  const expression = sum()
  if (cursor !== tokens.length) throw new Error(`无法识别「${tokens[cursor]}」。`)
  return (x, values = {}) => expression({ x, pi: Math.PI, e: Math.E, ...values })
}

function parseCoordinatePair(expression) {
  const point = expression.match(/^(?:([A-Z][0-9]*)\s*=\s*)?\(([\s\S]*)\)$/)
  if (!point) return null
  const contents = point[2]
  let depth = 0
  let separator = -1
  for (let i = 0; i < contents.length; i++) {
    const token = contents[i]
    if (token === '(') depth++
    if (token === ')') depth--
    if (depth < 0) return null
    if (depth === 0 && token === ',') {
      if (separator >= 0) throw new Error('平面坐标需要两个分量，例如 A=(2,3)。')
      separator = i
    }
  }
  if (depth || separator < 0) return null
  return [point[1], contents.slice(0, separator), contents.slice(separator + 1)]
}

export function parsePlotInput(input, parameters) {
  const source = input.trim()
  if (!source || source.length > 240) throw new Error('请输入 1 到 240 个字符的表达式。')
  const infix = toGraphExpression(normalizeExpression(source))
  const names = Object.keys(parameters)
  const valueOf = (text) => {
    const result = compileExpression(text, names)(NaN, parameters)
    if (!Number.isFinite(result) || Math.abs(result) > 1_000_000) throw new Error('请输入有限数值，绝对值不超过 1,000,000。')
    return result
  }
  const point = parseCoordinatePair(infix)
  if (point) return { kind: 'point', name: point[0], x: valueOf(point[1]), y: valueOf(point[2]) }
  const assignment = infix.match(/^([a-z])\s*=\s*([\s\S]+)$/)
  if (assignment?.[1] === 'x') return { kind: 'vertical', x: valueOf(assignment[2]), source }
  if (assignment && assignment[1] !== 'y') {
    if (assignment[1] === 'e') throw new Error('e 已保留为自然常数。')
    return { kind: 'parameter', name: assignment[1], value: valueOf(assignment[2]) }
  }
  const named = infix.match(/^([a-z])\s*\(\s*x\s*\)\s*=\s*([\s\S]+)$/)
  const formula = named?.[2] ?? assignment?.[2] ?? infix
  compileExpression(formula, names)
  return { kind: 'function', name: named ? `${named[1]}(x)` : undefined, formula, source }
}

function minimize(fn, left, right) {
  for (let i = 0; i < 38; i++) {
    const a = (2 * left + right) / 3, b = (left + 2 * right) / 3
    if (fn(a) < fn(b)) right = b
    else left = a
  }
  return (left + right) / 2
}

export function featuresInInterval(evaluate, left, right, mode) {
  if (!Number.isFinite(left) || !Number.isFinite(right) || left >= right) return []
  const count = 256
  const samples = Array.from({ length: count + 1 }, (_, i) => {
    const x = left + (right - left) * i / count
    return { x, y: evaluate(x) }
  })
  const results = []
  const step = (right - left) / count
  const add = (x, y) => {
    if (mode === 'root' && Math.abs(x) < step * 1e-9 && evaluate(0) === 0) x = 0
    if (Number.isFinite(y) && !results.some((p) => Math.abs(p.x - x) < step / 4)) results.push({ x, y })
  }
  if (mode === 'root') {
    for (let i = 0; i < count; i++) {
      const a = samples[i], b = samples[i + 1]
      if (!Number.isFinite(a.y) || !Number.isFinite(b.y)) continue
      if (a.y === 0 && (b.y !== 0 || samples[i - 1] && samples[i - 1].y !== 0)) add(a.x, 0)
      if (i === count - 1 && b.y === 0 && a.y !== 0) add(b.x, 0)
      if (Math.sign(a.y) * Math.sign(b.y) !== -1) continue
      let lo = a.x, hi = b.x
      for (let k = 0; k < 45; k++) {
        const center = (lo + hi) / 2
        const y = evaluate(center)
        if (!Number.isFinite(y)) break
        if (Math.sign(y) === Math.sign(a.y)) lo = center
        else hi = center
      }
      const x = (lo + hi) / 2
      const y = evaluate(x)
      const tolerance = Math.min(Math.abs(a.y), Math.abs(b.y)) * 1e-5
      if (Math.abs(y) <= tolerance) add(x, 0)
    }
  }
  for (let i = 1; i < count; i++) {
    const a = samples[i - 1], b = samples[i], c = samples[i + 1]
    if (![a.y, b.y, c.y].every(Number.isFinite)) continue
    if (mode === 'root') {
      if (b.y === 0 || Math.abs(b.y) >= Math.abs(a.y) || Math.abs(b.y) >= Math.abs(c.y)) continue
      const x = minimize((value) => Math.abs(evaluate(value)), a.x, c.x)
      const tolerance = Math.min(Math.abs(a.y), Math.abs(c.y)) * 1e-6
      if (Math.abs(evaluate(x)) <= tolerance) add(x, 0)
    } else {
      const direction = b.y >= a.y && b.y >= c.y && (b.y > a.y || b.y > c.y) ? -1 :
        b.y <= a.y && b.y <= c.y && (b.y < a.y || b.y < c.y) ? 1 : 0
      if (!direction) continue
      const refined = minimize((value) => direction * evaluate(value), a.x, c.x)
      const x = direction * evaluate(refined) < direction * b.y ? refined : b.x
      const y = evaluate(x)
      const leftValue = evaluate(x - step / 100), rightValue = evaluate(x + step / 100)
      if (![y, leftValue, rightValue].every(Number.isFinite) || Math.max(Math.abs(leftValue - y), Math.abs(rightValue - y)) >
        Math.max(Math.abs(b.y - a.y), Math.abs(b.y - c.y))) continue
      if (direction * y < direction * a.y && direction * y < direction * c.y) add(x, y)
    }
  }
  return results.sort((a, b) => a.x - b.x).map(({ x, y }) => ({ x: Number(x.toPrecision(10)), y: Number(y.toPrecision(10)) }))
}
