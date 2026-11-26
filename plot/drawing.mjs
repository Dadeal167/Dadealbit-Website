import { distance, format, tau } from './geometry.mjs'

export const defaults = {
  grid: 'fine', gridColor: '#d3dfed', gridWeight: 1, gridDash: 'solid', gridX: 0, gridY: 0,
  background: '#fcfdff', axesColor: '#526a87', axisX: true, axisY: true,
  arrow: 'end', xName: 'x', yName: 'y', xUnit: '', yUnit: '', xTicks: 0, yTicks: 0,
  xPositive: false, yPositive: false, xNumbers: true, yNumbers: true, tickStyle: 'major',
  labels: true, cursor: false, snap: 'free', equalScale: true,
}

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
export const minScale = .00001
export const maxScale = 1000

export const freshView = (width) => {
  const scale = clamp(width / 17, 24, 64)
  return { x: 0, y: 0, sx: scale, sy: scale }
}

export function toScreen(view, size, point) {
  return { x: size.w / 2 + (point.x - view.x) * view.sx, y: size.h / 2 - (point.y - view.y) * view.sy }
}

export function toWorld(view, size, point) {
  return { x: view.x + (point.x - size.w / 2) / view.sx, y: view.y - (point.y - size.h / 2) / view.sy }
}

export function autoStep(scale) {
  const ideal = 48 / scale
  const base = 10 ** Math.floor(Math.log10(ideal))
  return base * [1, 2, 5, 10].find((n) => base * n >= ideal)
}

export function captureStep(scale, fixed) {
  return fixed > 0 && fixed * scale >= 9 ? fixed : autoStep(scale)
}

function ticks(min, max, step, doTick) {
  const first = Math.ceil(min / step), last = Math.floor(max / step)
  const skip = Math.max(1, Math.ceil((last - first) / 200))
  for (let i = first; i <= last; i += skip) doTick(i * step, i)
}

function line(ctx, a, b) {
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
}

function frame(ctx, view, size, options) {
  const { w, h } = size
  ctx.fillStyle = options.background
  ctx.fillRect(0, 0, w, h)
  const origin = toScreen(view, size, { x: 0, y: 0 })
  const cornerA = toWorld(view, size, { x: 0, y: h })
  const cornerB = toWorld(view, size, { x: w, y: 0 })
  const xStep = captureStep(view.sx, options.gridX)
  const yStep = captureStep(view.sy, options.gridY)
  ctx.strokeStyle = options.gridColor
  ctx.fillStyle = options.gridColor
  ctx.lineWidth = options.gridWeight
  ctx.setLineDash(options.gridDash === 'dash' ? [5, 4] : options.gridDash === 'dot' ? [1, 5] : [])
  if (options.grid === 'dots') {
    ticks(cornerA.x, cornerB.x, xStep, (x) => {
      ticks(cornerA.y, cornerB.y, yStep, (y) => {
        const p = toScreen(view, size, { x, y })
        ctx.fillRect(p.x - .85, p.y - .85, 1.7, 1.7)
      })
    })
  } else if (options.grid !== 'off') {
    const factor = options.grid === 'fine' ? 5 : 1
    const xFine = xStep / (xStep * view.sx / factor >= 7 ? factor : 1)
    const yFine = yStep / (yStep * view.sy / factor >= 7 ? factor : 1)
    for (const axis of ['x', 'y']) {
      const step = axis === 'x' ? xFine : yFine
      const major = axis === 'x' ? xStep : yStep
      ticks(cornerA[axis], cornerB[axis], step, (value, index) => {
        if (index === 0) return
        ctx.globalAlpha = index % Math.round(major / step) ? .53 : 1
        if (axis === 'x') {
          const x = Math.round(toScreen(view, size, { x: value, y: 0 }).x) + .5
          line(ctx, { x, y: 0 }, { x, y: h })
        } else {
          const y = Math.round(toScreen(view, size, { x: 0, y: value }).y) + .5
          line(ctx, { x: 0, y }, { x: w, y })
        }
      })
    }
  }
  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.strokeStyle = options.axesColor
  ctx.fillStyle = options.axesColor
  ctx.lineWidth = 1.35
  ctx.font = '12px system-ui, sans-serif'

  const arrows = (x, y, dx, dy) => {
    line(ctx, { x, y }, { x: x - dx + dy * .45, y: y - dy + dx * .45 })
    line(ctx, { x, y }, { x: x - dx - dy * .45, y: y - dy - dx * .45 })
  }
  const axisNumber = (n, unit) => format(n) + unit
  if (options.axisX && origin.y >= 0 && origin.y <= h && (!options.xPositive || origin.x <= w)) {
    const start = options.xPositive ? Math.max(0, origin.x) : 0
    line(ctx, { x: start, y: origin.y }, { x: w, y: origin.y })
    if (options.arrow !== 'none' && w - start > 12) arrows(w - 3, origin.y, 8, 0)
    if (options.arrow === 'both' && !options.xPositive) arrows(3, origin.y, -8, 0)
    const step = captureStep(view.sx, options.xTicks)
    const divider = options.tickStyle === 'minor' && step * view.sx >= 28 ? 2 : 1
    ticks(options.xPositive ? Math.max(0, cornerA.x) : cornerA.x, cornerB.x, step / divider, (value, i) => {
      const x = toScreen(view, size, { x: value, y: 0 }).x
      if (i && options.tickStyle !== 'none') line(ctx, { x, y: origin.y }, { x, y: origin.y + (i % divider ? 3 : 5) })
      if (i && i % divider === 0 && options.xNumbers && x > 16 && x < w - 24) {
        const number = axisNumber(value, options.xUnit)
        ctx.fillText(number, clamp(x - ctx.measureText(number).width / 2, 4, w - ctx.measureText(number).width - 4),
          origin.y > h - 22 ? origin.y - 7 : origin.y + 17)
      }
    })
    ctx.fillText(options.xName, w - Math.max(20, ctx.measureText(options.xName).width + 10), origin.y < 22 ? origin.y + 16 : origin.y - 7)
  }
  if (options.axisY && origin.x >= 0 && origin.x <= w && (!options.yPositive || origin.y >= 0)) {
    const end = options.yPositive ? Math.min(h, origin.y) : h
    line(ctx, { x: origin.x, y: 0 }, { x: origin.x, y: end })
    if (options.arrow !== 'none' && end > 12) arrows(origin.x, 3, 0, -8)
    if (options.arrow === 'both' && !options.yPositive) arrows(origin.x, h - 3, 0, 8)
    const step = captureStep(view.sy, options.yTicks)
    const divider = options.tickStyle === 'minor' && step * view.sy >= 28 ? 2 : 1
    ticks(options.yPositive ? Math.max(0, cornerA.y) : cornerA.y, cornerB.y, step / divider, (value, i) => {
      const y = toScreen(view, size, { x: 0, y: value }).y
      if (i && options.tickStyle !== 'none') line(ctx, { x: origin.x, y }, { x: origin.x - (i % divider ? 3 : 5), y })
      if (i && i % divider === 0 && options.yNumbers && y > 22 && y < h - 8) {
        const number = axisNumber(value, options.yUnit)
        ctx.fillText(number, origin.x > 38 ? Math.max(2, origin.x - ctx.measureText(number).width - 8) : origin.x + 7, y + 4)
      }
    })
    ctx.fillText(options.yName, clamp(origin.x + 8, 5, Math.max(5, w - ctx.measureText(options.yName).width - 5)), 18)
  }
  if ((options.axisX && options.xNumbers || options.axisY && options.yNumbers) && origin.x >= 10 && origin.x < w - 6 && origin.y >= 0 && origin.y < h - 6) {
    ctx.fillText('0', origin.x - 11, Math.min(h - 3, origin.y + 16))
  }
}

function clipLinear(a, b, span, size) {
  const delta = { x: b.x - a.x, y: b.y - a.y }
  let min = span === 'line' ? -Infinity : 0
  let max = span === 'segment' || span === 'vector' ? 1 : Infinity
  for (const [axis, upper] of [['x', size.w], ['y', size.h]]) {
    if (!delta[axis]) {
      if (a[axis] < -4 || a[axis] > upper + 4) return []
      continue
    }
    const t0 = (-4 - a[axis]) / delta[axis], t1 = (upper + 4 - a[axis]) / delta[axis]
    min = Math.max(min, Math.min(t0, t1))
    max = Math.min(max, Math.max(t0, t1))
  }
  if (max < min || !Number.isFinite(min) || !Number.isFinite(max)) return []
  return [min, max].map((t) => ({ x: a.x + delta.x * t, y: a.y + delta.y * t }))
}

const samples = (sample, start, end, count) => Array.from({ length: count + 1 }, (_, i) => sample(start + (end - start) * i / count))

export function screenShape(shape, view, size) {
  const screen = (p) => toScreen(view, size, p)
  if (shape.type === 'point' || shape.type === 'text') {
    const position = screen(shape.position)
    const angle = (vector) => Math.atan2(-vector.y * view.sy, vector.x * view.sx)
    const sides = shape.angle && [angle(shape.angle.left), angle(shape.angle.right)]
    return { position, text: shape.text, sides }
  }
  if (shape.type === 'linear') return { strokes: [clipLinear(screen(shape.a), screen(shape.b), shape.span, size)], arrow: shape.span === 'vector' }
  if (shape.type === 'path') return { strokes: [shape.points.map(screen)], closed: shape.closed }
  if (shape.type === 'curve') return { strokes: shape.branches.map((branch) => samples((t) => screen(branch.at(t)), branch.from, branch.to, 280)) }
  if (shape.type === 'circle' || shape.type === 'arc') {
    const start = shape.first ?? 0, sweep = shape.sweep ?? tau
    const points = samples((angle) => screen({ x: shape.center.x + shape.radius * Math.cos(angle), y: shape.center.y + shape.radius * Math.sin(angle) }), start, start + sweep, 180)
    if (shape.closed) points.push(screen(shape.center))
    return { strokes: [points], closed: shape.closed }
  }
  if (shape.type === 'function') {
    const strokes = []
    let segment = []
    const step = Math.max(1, size.w / 1800)
    for (let px = 0; px < size.w + step; px += step) {
      const { x } = toWorld(view, size, { x: px, y: 0 })
      const y = shape.evaluate(x)
      const sy = screen({ x, y }).y
      const valid = Number.isFinite(sy) && Math.abs(sy) < size.h * 30
      if (!valid || segment.length && Math.abs(segment.at(-1).y - sy) > size.h * .85) {
        if (segment.length > 1) strokes.push(segment)
        segment = []
      }
      if (valid) segment.push({ x: px, y: sy })
    }
    if (segment.length > 1) strokes.push(segment)
    return { strokes }
  }
  return {}
}

function paint(ctx, object, screen, options, selected) {
  const color = object.color
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = selected ? 3 : 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (screen.position) {
    const { x, y } = screen.position
    if (screen.text !== undefined) {
      let textX = x + 8, textY = y - 10
      if (screen.sides) {
        const [first, last] = screen.sides
        const sweep = (last - first + tau * 1.5) % tau - Math.PI
        ctx.beginPath()
        ctx.arc(x, y, 22, first, first + sweep, sweep < 0)
        ctx.stroke()
        const middle = first + sweep / 2
        textX = x + Math.cos(middle) * 30
        textY = y + Math.sin(middle) * 30
      }
      ctx.font = '600 13px system-ui, sans-serif'
      ctx.strokeStyle = options.background
      ctx.lineWidth = 5
      ctx.strokeText(screen.text, textX, textY)
      ctx.fillText(screen.text, textX, textY)
      return
    }
    ctx.beginPath()
    ctx.arc(x, y, selected ? 5.5 : 4.25, 0, tau)
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = options.background
    ctx.stroke()
    if (options.labels && object.label !== false) {
      ctx.font = '600 13px system-ui, sans-serif'
      ctx.lineWidth = 3
      ctx.strokeText(object.name, x + 8, y - 8)
      ctx.fillText(object.name, x + 8, y - 8)
    }
    return
  }
  for (const points of screen.strokes ?? []) {
    if (points.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
    if (screen.closed) {
      ctx.closePath()
      ctx.globalAlpha = selected ? .18 : .11
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.stroke()
    if (screen.arrow) {
      const [a, b] = points
      const angle = Math.atan2(b.y - a.y, b.x - a.x)
      line(ctx, b, { x: b.x - 11 * Math.cos(angle - .42), y: b.y - 11 * Math.sin(angle - .42) })
      line(ctx, b, { x: b.x - 11 * Math.cos(angle + .42), y: b.y - 11 * Math.sin(angle + .42) })
    }
  }
}

export function paintScene(ctx, size, view, options, renderables, selected, pending = []) {
  ctx.setTransform(size.ratio, 0, 0, size.ratio, 0, 0)
  frame(ctx, view, size, options)
  const ordered = [...renderables.filter((item) => item.shape.type !== 'point'), ...renderables.filter((item) => item.shape.type === 'point')]
  for (const { object, screen, draft } of ordered) {
    if (draft) {
      ctx.globalAlpha = .55
      ctx.setLineDash([6, 4])
    }
    paint(ctx, object, screen, options, selected === object.id)
    if (draft) {
      ctx.globalAlpha = 1
      ctx.setLineDash([])
    }
  }
  const points = pending.map((point) => toScreen(view, size, point))
  ctx.strokeStyle = '#576bc2'
  ctx.lineWidth = 1.5
  ctx.setLineDash([4, 4])
  for (let i = 1; i < points.length; i++) line(ctx, points[i - 1], points[i])
  ctx.setLineDash([])
  for (const point of points) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, 7, 0, tau)
    ctx.stroke()
  }
}

function nearSegment(p, a, b, radius) {
  const dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <= radius
}

function insidePolygon(p, polygon) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j]
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result
  }
  return result
}

export function hitTest(renderables, p, radius, accept = () => true) {
  const eligible = renderables.filter(({ shape }) => accept(shape))
  let nearest = radius
  let match
  for (const item of eligible) {
    if (!item.screen.position) continue
    const d = distance(item.screen.position, p)
    if (d < nearest) {
      match = item
      nearest = d
    }
  }
  if (match) return match
  return eligible.findLast(({ screen }) => screen.strokes?.some((stroke) => stroke.slice(1).some((b, i) => nearSegment(p, stroke[i], b, radius)) ||
    screen.closed && stroke.length >= 3 && (nearSegment(p, stroke.at(-1), stroke[0], radius) || insidePolygon(p, stroke))))
}
