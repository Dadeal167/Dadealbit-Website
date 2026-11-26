import { featuresInInterval } from './math.mjs'

const epsilon = 1e-9
export const tau = 2 * Math.PI
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y })
export const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
export const multiply = (p, k) => ({ x: p.x * k, y: p.y * k })
export const dot = (a, b) => a.x * b.x + a.y * b.y
const cross = (a, b) => a.x * b.y - a.y * b.x
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const length = (p) => Math.hypot(p.x, p.y)
const perpendicular = (p) => ({ x: -p.y, y: p.x })
const normalize = (p) => length(p) > epsilon ? multiply(p, 1 / length(p)) : null
const middle = (a, b) => multiply(add(a, b), .5)
const rotate = (p, angle) => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) })
const radians = (degrees) => degrees * Math.PI / 180
export const round = (n) => Number(n.toPrecision(12))
const rounded = (p) => ({ x: round(p.x), y: round(p.y) })
export const format = (n) => Number.isFinite(n) ? String(Number(n.toPrecision(5))) : '未定义'
const point = (position) => ({ type: 'point', position })
const linear = (a, b, span = 'line') => distance(a, b) > epsilon ? { type: 'linear', a, b, span } : null
const path = (points, closed = false) => ({ type: 'path', points, closed })
const circle = (center, radius) => radius > epsilon ? { type: 'circle', center, radius } : null
const curve = (branches, anchors) => ({ type: 'curve', branches, anchors })
const label = (position, text) => ({ type: 'text', position, text })

function clampParameter(span, t) {
  if (span === 'segment' || span === 'vector') return Math.min(1, Math.max(0, t))
  return span === 'ray' ? Math.max(0, t) : t
}

export function positionOn(object, t) {
  if (object.type === 'circle') return add(object.center, multiply({ x: Math.cos(t), y: Math.sin(t) }, object.radius))
  return add(object.a, multiply(subtract(object.b, object.a), clampParameter(object.span, t)))
}

export function closestParameter(object, position) {
  if (object.type === 'circle') return Math.atan2(position.y - object.center.y, position.x - object.center.x)
  const direction = subtract(object.b, object.a)
  return clampParameter(object.span, dot(subtract(position, object.a), direction) / dot(direction, direction))
}

const allowed = (line, position) => {
  const vector = subtract(line.b, line.a)
  const t = dot(subtract(position, line.a), vector) / dot(vector, vector)
  return Math.abs(t - clampParameter(line.span, t)) < epsilon
}

function intersectionLineCircle(line, circle) {
  const direction = normalize(subtract(line.b, line.a))
  const along = dot(subtract(circle.center, line.a), direction)
  const nearest = add(line.a, multiply(direction, along))
  const square = circle.radius ** 2 - distance(nearest, circle.center) ** 2
  if (square < -epsilon) return []
  const roots = square < epsilon ? [nearest] : [add(nearest, multiply(direction, -Math.sqrt(square))), add(nearest, multiply(direction, Math.sqrt(square)))]
  return roots.filter((position) => allowed(line, position))
}

export function intersections(a, b) {
  if (!a || !b) return []
  if (a.type === 'linear' && b.type === 'linear') {
    const da = subtract(a.b, a.a), db = subtract(b.b, b.a)
    const denominator = cross(da, db)
    if (Math.abs(denominator) < epsilon) return []
    const result = add(a.a, multiply(da, cross(subtract(b.a, a.a), db) / denominator))
    return allowed(a, result) && allowed(b, result) ? [result] : []
  }
  if (a.type === 'linear' && b.type === 'circle') return intersectionLineCircle(a, b)
  if (a.type === 'circle' && b.type === 'linear') return intersectionLineCircle(b, a)
  if (a.type !== 'circle' || b.type !== 'circle') return []
  const d = distance(a.center, b.center)
  if (d < epsilon || d > a.radius + b.radius + epsilon || d < Math.abs(a.radius - b.radius) - epsilon) return []
  const direction = multiply(subtract(b.center, a.center), 1 / d)
  const along = (d ** 2 + a.radius ** 2 - b.radius ** 2) / (2 * d)
  const nearest = add(a.center, multiply(direction, along))
  const offset = Math.sqrt(Math.max(0, a.radius ** 2 - along ** 2))
  if (offset < epsilon) return [nearest]
  const normal = multiply(perpendicular(direction), offset)
  return [subtract(nearest, normal), add(nearest, normal)]
}

function circumcircle(a, b, c) {
  const u = subtract(b, a), v = subtract(c, a)
  const denominator = 2 * cross(u, v)
  if (Math.abs(denominator) < epsilon) return null
  const u2 = dot(u, u), v2 = dot(v, v)
  const center = add(a, { x: (v.y * u2 - u.y * v2) / denominator, y: (u.x * v2 - v.x * u2) / denominator })
  return circle(center, distance(center, a))
}

function arc(center, start, end, through, closed) {
  const radius = distance(center, start)
  if (radius < epsilon) return null
  const angle = (p) => Math.atan2(p.y - center.y, p.x - center.x)
  const positive = (value) => (value + tau) % tau
  const first = angle(start), last = angle(end)
  let sweep = positive(last - first)
  if (through && positive(angle(through) - first) > sweep) sweep -= tau
  return { type: 'arc', center, radius, first, sweep, closed, anchors: [center, start, end] }
}

function regularPolygon(a, b, count) {
  const side = subtract(b, a)
  if (length(side) < epsilon) return null
  const points = [a, b]
  let current = b
  for (let i = 1; i < count - 1; i++) {
    current = add(current, rotate(side, i * tau / count))
    points.push(current)
  }
  return path(points, true)
}

function conic(type, a, b, c) {
  const axis = normalize(subtract(b, a))
  if (!axis) return null
  const center = middle(a, b)
  const focal = distance(a, b) / 2
  const normal = perpendicular(axis)
  const at = (u, v) => add(center, add(multiply(axis, u), multiply(normal, v)))
  if (type === 'ellipse') {
    const major = (distance(c, a) + distance(c, b)) / 2
    if (major <= focal + epsilon) return null
    const minor = Math.sqrt(major ** 2 - focal ** 2)
    return curve([{ from: 0, to: tau, at: (t) => at(major * Math.cos(t), minor * Math.sin(t)) }],
      [at(-major, 0), at(major, 0), at(0, -minor), at(0, minor)])
  }
  const major = Math.abs(distance(c, a) - distance(c, b)) / 2
  if (major < epsilon || major >= focal - epsilon) return null
  const minor = Math.sqrt(focal ** 2 - major ** 2)
  return curve([-1, 1].map((branch) => ({ from: -8, to: 8, at: (t) => at(branch * major * Math.cosh(t), minor * Math.sinh(t)) })), [a, b, c])
}

function parabola(focus, directrix) {
  const foot = positionOn({ ...directrix, span: 'line' }, closestParameter({ ...directrix, span: 'line' }, focus))
  const vertex = middle(focus, foot)
  const normal = normalize(subtract(focus, vertex))
  if (!normal) return null
  const p = distance(focus, vertex)
  const axis = perpendicular(normal)
  return curve([{ from: -100, to: 100, at: (t) => add(vertex,
    add(multiply(axis, p * t), multiply(normal, p * t ** 2 / 4))) }], [focus, vertex])
}

function transform(shape, fn) {
  if (shape.type === 'point') return point(fn(shape.position))
  if (shape.type === 'linear') return linear(fn(shape.a), fn(shape.b), shape.span)
  if (shape.type === 'path') return path(shape.points.map(fn), shape.closed)
  if (shape.type === 'circle') {
    const center = fn(shape.center)
    return circle(center, distance(center, fn(add(shape.center, { x: shape.radius, y: 0 }))))
  }
  if (shape.type === 'arc') {
    const at = (t) => fn(add(shape.center, multiply({ x: Math.cos(t), y: Math.sin(t) }, shape.radius)))
    if (shape.closed) {
      const points = Array.from({ length: 121 }, (_, i) => at(shape.first + shape.sweep * i / 120))
      return path([...points, fn(shape.center)], true)
    }
    return curve([{ from: shape.first, to: shape.first + shape.sweep, at }], shape.anchors.map(fn))
  }
  if (shape.type === 'curve') return curve(shape.branches.map((branch) => ({ ...branch, at: (t) => fn(branch.at(t)) })), shape.anchors.map(fn))
  return null
}

export function shapeAnchors(shape) {
  if (!shape) return []
  if (shape.type === 'linear') return [shape.a, shape.b]
  if (shape.type === 'path') return shape.points
  if (shape.type === 'point' || shape.type === 'text') return [shape.position]
  if (shape.type === 'circle') {
    const { center, radius } = shape
    return [add(center, { x: -radius, y: -radius }), add(center, { x: radius, y: radius })]
  }
  return shape.anchors ?? []
}

function formatMeasure(kind, shapes, points) {
  const [a, b, c] = points
  const figure = shapes[0]
  if (kind === 'distance') return label(middle(a, b), `距离 ${format(distance(a, b))}`)
  if (kind === 'slope') {
    const direction = subtract(figure.b, figure.a)
    return label(middle(figure.a, figure.b), `斜率 ${format(Math.abs(direction.x) < epsilon ? NaN : direction.y / direction.x)}`)
  }
  if (kind === 'angle') {
    const left = normalize(subtract(a, b)), right = normalize(subtract(c, b))
    if (!left || !right) return null
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(left, right))))
    const result = label(b, `${format(angle / Math.PI * 180)}°`)
    return { ...result, angle: { left, right } }
  }
  if (figure.type === 'circle') return label(figure.center, `面积 ${format(Math.PI * figure.radius ** 2)}`)
  if (figure.type === 'path' && figure.closed) {
    const coordinates = figure.points
    const area = coordinates.reduce((total, p, i) => total + cross(p, coordinates[(i + 1) % coordinates.length]), 0) / 2
    const center = multiply(coordinates.reduce(add, { x: 0, y: 0 }), 1 / coordinates.length)
    return label(center, `面积 ${format(Math.abs(area))}`)
  }
  return null
}

function resolveShape(model, shapes) {
  const [first, second, third] = shapes
  const points = shapes.map((shape) => shape?.type === 'point' ? shape.position : null)
  const [a, b, c] = points
  const value = model.value
  switch (model.kind) {
    case 'point': return point({ x: model.x, y: model.y })
    case 'onObject': return point(positionOn(first, value))
    case 'midpoint': return point(rounded(middle(a, b)))
    case 'intersection': {
      const position = intersections(first, second)[value]
      return position ? point(position) : null
    }
    case 'root': case 'extremum': {
      const position = shapes[0].features?.(model.kind, model.interval)[value]
      return position ? point(position) : null
    }
    case 'line': case 'segment': case 'ray': case 'vector': return linear(a, b, model.kind)
    case 'fixedSegment': return linear(a, add(a, { x: value, y: 0 }), 'segment')
    case 'parallel': case 'perpendicular': {
      const direction = normalize(subtract(second.b, second.a))
      return direction ? linear(a, add(a, model.kind === 'parallel' ? direction : perpendicular(direction))) : null
    }
    case 'perpendicularBisector': return linear(middle(a, b), add(middle(a, b), perpendicular(subtract(b, a))))
    case 'angleBisector': {
      const u = normalize(subtract(a, b)), v = normalize(subtract(c, b))
      if (!u || !v) return null
      return linear(b, add(b, normalize(add(u, v)) ?? perpendicular(u)), 'ray')
    }
    case 'fixedAngle': return linear(b, add(b, rotate(subtract(a, b), radians(value))), 'ray')
    case 'tangent': {
      const delta = subtract(a, second.center)
      const d = length(delta)
      if (d < second.radius - epsilon || d < epsilon) return null
      const along = Math.acos(Math.min(1, second.radius / d)) * value
      const radial = rotate(normalize(delta), along)
      const contact = add(second.center, multiply(radial, second.radius))
      return linear(contact, add(contact, perpendicular(radial)))
    }
    case 'polyline': return path(points)
    case 'polygon': return path(points, true)
    case 'rectangle': return Math.abs(b.x - a.x) > epsilon && Math.abs(b.y - a.y) > epsilon
      ? path([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], true) : null
    case 'regular': return regularPolygon(a, b, value)
    case 'circle': return circle(a, distance(a, b))
    case 'radiusCircle': return circle(a, value)
    case 'circumcircle': return circumcircle(a, b, c)
    case 'semicircle': return arc(middle(a, b), a, b)
    case 'arc': case 'sector': return arc(a, b, c, undefined, model.kind === 'sector')
    case 'circumarc': {
      const circum = circumcircle(a, b, c)
      return circum ? arc(circum.center, a, c, b) : null
    }
    case 'ellipse': case 'hyperbola': return conic(model.kind, a, b, c)
    case 'parabola': return parabola(a, second)
    case 'angle': case 'distance': case 'slope': case 'area': return formatMeasure(model.kind, shapes, points)
    case 'rotate': return transform(first, (p) => add(b, rotate(subtract(p, b), radians(value))))
    case 'dilate': return transform(first, (p) => add(b, multiply(subtract(p, b), value)))
    case 'central': return transform(first, (p) => subtract(multiply(b, 2), p))
    case 'translate': return transform(first, (p) => add(p, subtract(c, b)))
    case 'equalVector': return linear(b, add(b, subtract(first.b, first.a)), 'vector')
    case 'invert': {
      const delta = subtract(a, second.center)
      const squared = dot(delta, delta)
      return squared > epsilon ? point(add(second.center, multiply(delta, second.radius ** 2 / squared))) : null
    }
    case 'reflect': {
      const axis = { ...second, span: 'line' }
      return transform(first, (p) => subtract(multiply(positionOn(axis, closestParameter(axis, p)), 2), p))
    }
    case 'text': return label(a, model.text)
    case 'ink': return path(model.points)
    case 'vertical': return linear({ x: model.x, y: 0 }, { x: model.x, y: 1 })
    default: return null
  }
}

export function geometryFor(models, resolveFunction) {
  const map = new Map(models.map((model) => [model.id, model]))
  const computed = new Map()
  function resolve(id) {
    if (computed.has(id)) return computed.get(id)
    const model = map.get(id)
    if (!model) return null
    if (model.kind === 'function') {
      const evaluate = resolveFunction?.(model)
      if (!evaluate) return null
      const results = new Map()
      const features = (mode, interval) => {
        const key = `${mode}:${interval}`
        if (!results.has(key)) results.set(key, featuresInInterval(evaluate, ...interval, mode))
        return results.get(key)
      }
      const shape = { type: 'function', evaluate, features }
      computed.set(id, shape)
      return shape
    }
    computed.set(id, null)
    const refs = model.refs?.map(resolve) ?? []
    if (refs.some((shape) => !shape)) return null
    let shape
    try { shape = resolveShape(model, refs) } catch { return null }
    computed.set(id, shape)
    return shape
  }
  return resolve
}
