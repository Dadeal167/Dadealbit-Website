const fractions = new Set(['frac', 'dfrac', 'tfrac'])
const mathFunctions = {
  sin: 'sin', cos: 'cos', tan: 'tan', asin: 'asin', acos: 'acos', atan: 'atan',
  arcsin: 'asin', arccos: 'acos', arctan: 'atan', ln: 'ln', log: 'log', exp: 'exp', abs: 'abs',
}
const symbols = { pi: 'pi', cdot: '*', times: '*', div: '/' }
const space = /^[\s\u00a0]$/

export function stripMathDelimiters(input) {
  const text = input.trim()
  for (const [opening, closing] of [['$$', '$$'], ['\\[', '\\]'], ['\\(', '\\)'], ['$', '$']]) {
    if (text.length > opening.length + closing.length && text.startsWith(opening) && text.endsWith(closing)) {
      return text.slice(opening.length, -closing.length).trim()
    }
  }
  return text
}

export function toGraphExpression(input) {
  const text = stripMathDelimiters(input)
  if (!/[\\{}|_]/.test(text)) return text
  const source = text
    .replace(/\\(?:left|right)(?:\s*\.)?(?![a-zA-Z])/g, '')
    .replace(/\\(?:big|Big)(?:g)?[lrm]?(?![a-zA-Z])/g, '')
    .replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)(?![a-zA-Z])/g, '')
    .replace(/\\(?:lvert|rvert|vert)(?![a-zA-Z])/g, '|')
    .replace(/\\lbrack(?![a-zA-Z])/g, '[').replace(/\\rbrack(?![a-zA-Z])/g, ']')
    .replace(/\\(?:qquad|quad|enspace)(?![a-zA-Z])|\\[,;:!> ]/g, ' ')
  let index = 0
  const current = () => source[index]

  function ignoreSpaces() {
    while (space.test(current() ?? '')) index++
  }

  function sequence(end) {
    const parts = []
    ignoreSpaces()
    while (index < source.length && current() !== end) {
      const character = current()
      if (character === '{') parts.push(`(${group('{')})`)
      else if (character === '(') parts.push(`(${group('(')})`)
      else if (character === '[') parts.push(`(${group('[')})`)
      else if (character === '|') parts.push(`abs(${group('|')})`)
      else if (character === '\\') parts.push(readCommand())
      else if (character === '^') {
        index++
        parts.push(`^(${argument('指数')})`)
      } else if (/[a-zA-Z0-9.]/.test(character)) parts.push(word())
      else if ('+-*/=,×÷−'.includes(character)) { parts.push(character); index++ }
      else throw new Error(`绘图表达式中无法使用「${character}」。`)
      ignoreSpaces()
    }
    if (end && current() !== end) throw new Error('LaTeX 的括号或大括号尚未闭合。')
    if (end) index++
    return parts.join(' ')
  }

  function group(opening) {
    const closing = { '{': '}', '(': ')', '[': ']', '|': '|' }[opening]
    index++
    return sequence(closing)
  }

  function word() {
    const rest = source.slice(index)
    const numeric = /^(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/.exec(rest)
    if (numeric) { index += numeric[0].length; return numeric[0] }
    const name = /^[A-Z][0-9]*(?:_(?:\{[0-9]+\}|[0-9]))?/.exec(rest)
    if (name) { index += name[0].length; return name[0].replace(/[_{}]/g, '') }
    const known = /^(?:arcsin|arccos|arctan|sqrt|sin|cos|tan|asin|acos|atan|ln|log|abs|exp|pi|floor|ceil|root)\b/.exec(rest)
    if (known) { index += known[0].length; return mathFunctions[known[0]] ?? known[0] }
    return source[index++]
  }

  function argument(label) {
    ignoreSpaces()
    const character = current()
    if (!character) throw new Error(`LaTeX ${label}尚未输入完整。`)
    let value
    if (character === '{' || character === '(' || character === '[') value = group(character)
    else if (character === '|') value = `abs(${group('|')})`
    else if (character === '\\') value = readCommand()
    else if (/[a-zA-Z0-9]/.test(character)) value = source[index++]
    else throw new Error(`请用大括号包住${label}。`)
    if (!value) throw new Error(`请填写${label}。`)
    return value
  }

  function functionArgument(label) {
    ignoreSpaces()
    if ('{([|'.includes(current() ?? '\u0000')) return argument(label)
    const sign = '+-−'.includes(current() ?? '\u0000') ? source[index++] : ''
    const factors = []
    ignoreSpaces()
    while (index < source.length && /[a-zA-Z0-9.\\]/.test(current())) {
      if (current() === '\\') {
        const next = /^\\([a-zA-Z]+)/.exec(source.slice(index))?.[1]
        if (next === 'cdot' || next === 'times' || next === 'div' ||
            factors.length && (Object.hasOwn(mathFunctions, next) || next === 'operatorname')) break
        factors.push(readCommand())
      } else factors.push(word())
      ignoreSpaces()
      if (current() === '^') { index++; factors.push(`^(${argument('指数')})`); ignoreSpaces() }
    }
    if (!factors.length) throw new Error(`请填写${label}。`)
    return sign + factors.join(' ')
  }

  function readFunction(name) {
    let power, base
    ignoreSpaces()
    while (current() === '^' || current() === '_') {
      const operator = source[index++]
      if (operator === '^' && power === undefined) power = argument('指数')
      else if (operator === '_' && name === 'log' && base === undefined) base = argument('对数底数')
      else throw new Error('此函数的上标或下标无法识别。')
      ignoreSpaces()
    }
    const value = functionArgument('函数参数')
    const call = base === undefined ? `${name}(${value})` : `(ln(${value})/ln(${base}))`
    return power === undefined ? call : `(${call})^(${power})`
  }

  function readCommand() {
    index++
    const command = /^[a-zA-Z]+/.exec(source.slice(index))?.[0]
    if (!command) throw new Error('LaTeX 命令尚未输入完整。')
    index += command.length
    if (Object.hasOwn(symbols, command)) return symbols[command]
    if (fractions.has(command)) return `((${argument('分子')})/(${argument('分母')}))`
    if (command === 'sqrt') {
      ignoreSpaces()
      const order = current() === '[' ? group('[') : undefined
      const value = argument('被开方数')
      if (order === '') throw new Error('请填写根指数。')
      return order === undefined ? `sqrt(${value})` : `root(${value},${order})`
    }
    if (command === 'operatorname') {
      const name = argument('函数名').replace(/\s+/g, '')
      if (Object.hasOwn(mathFunctions, name)) return readFunction(mathFunctions[name])
    }
    if (Object.hasOwn(mathFunctions, command)) return readFunction(mathFunctions[command])
    throw new Error(`绘图暂不支持 LaTeX 命令 \\${command}。`)
  }

  return sequence()
}

export function latexForPreview(input) {
  return stripMathDelimiters(input)
    .replace(/(?<!\\)\b(?:sin|cos|tan|arcsin|arccos|arctan|ln|log|exp|pi)\b/g, (name) => `\\${name} `)
    .replace(/(?<!\\)\*/g, '\\cdot ')
}
