import katex from 'katex'
import { closestParameter, distance, format, geometryFor, intersections, round, shapeAnchors } from './geometry.mjs'
import { latexForPreview } from './latex.mjs'
import { compileExpression, parsePlotInput } from './math.mjs'
import { captureStep, clamp, defaults, freshView, hitTest, maxScale, minScale, paintScene, screenShape, toScreen, toWorld } from './drawing.mjs'
import { groups, objectName, tools } from './tools.mjs'

const $ = (selector) => document.querySelector(selector)
const canvas = $('#plot')
const ctx = canvas.getContext('2d')
const panel = $('#object-list')
const inspector = $('#inspector')
const toolButtons = $('#tool-buttons')
const parametersInput = $('#parameter-input')
const viewOptions = $('#view-options')
const rangeForm = $('#range-form')
const coordinates = $('#coordinates')
const expressionInput = $('#expression')
const expressionPreview = $('#expression-preview')
const expressionError = $('#expression-error')
const storageKey = 'dadealbit-geometry-v2'
const previousKey = 'dadealbit-coordinate-plot-v1'
const colors = ['#3158d7', '#087662', '#a44087', '#a45719', '#5b55a1', '#24638c']
const limit = 1_000_000
const numeric = (n) => Number.isFinite(n) && Math.abs(n) <= limit
const notify = (text = '') => { $('#plot-status').textContent = text }

function initialState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    if (Array.isArray(saved?.objects)) {
      const objects = saved.objects.filter((o) => Number.isSafeInteger(o?.id) && o.id > 0 && typeof o.kind === 'string' &&
        typeof o.name === 'string' && /^#[a-f\d]{6}$/i.test(o.color))
      const options = { ...defaults }
      for (const key of Object.keys(defaults)) {
        if (typeof saved.options?.[key] === typeof defaults[key]) options[key] = saved.options[key]
      }
      const view = saved.view
      const validView = view && numeric(view.x / 2) && numeric(view.y / 2) &&
        [view.sx, view.sy].every((scale) => scale >= minScale && scale <= maxScale)
      return { objects, options, savedView: validView ? view : null }
    }
    const old = JSON.parse(localStorage.getItem(previousKey))
    const objects = []
    for (const figure of old?.figures ?? []) {
      const refs = []
      const color = colors[objects.length % colors.length]
      for (const point of figure.points ?? []) {
        if (!numeric(point.x) || !numeric(point.y)) continue
        const id = objects.length + 1
        objects.push({ id, kind: 'point', color, name: pointLabel(objects), x: point.x, y: point.y })
        refs.push(id)
      }
      if (refs.length >= 2) {
        const id = objects.length + 1
        const kind = figure.closed && refs.length > 2 ? 'polygon' : 'polyline'
        objects.push({ id, kind, color, name: `${objectName(kind)} ${id}`, refs })
      }
    }
    return { objects, options: { ...defaults } }
  } catch {
    return { objects: [], options: { ...defaults } }
  }
}

const loaded = initialState()
let { objects, options } = loaded
let nextId = Math.max(0, ...objects.map(({ id }) => id)) + 1
let selected = null
let group = 0
let active = 'select'
let pending = []
let cursor = null
let gesture = null
let view = null
let size = { w: 1, h: 1, ratio: 1 }
let renderables = []
let resolveShape = geometryFor([])
let draftExpression = null
let previewFrame = 0
const past = []
const future = []
const formulas = new Map()
const lookup = (id) => objects.find((o) => o.id === id)
const values = () => Object.fromEntries(objects.filter((o) => o.kind === 'parameter').map((o) => [o.name, o.value]))

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ objects, options, view })) } catch { /* 浏览器禁用存储时仍可导出。 */ }
}

function snapshot() {
  return structuredClone({ objects, options, selected })
}

function record(before) {
  past.push(before)
  if (past.length > 50) past.shift()
  future.length = 0
  refreshHistory()
  save()
}

function refreshHistory() {
  $('#undo').disabled = !past.length
  $('#redo').disabled = !future.length
}

function restore(from, to, message) {
  const target = from.pop()
  if (!target) return
  to.push(snapshot())
  objects = target.objects
  options = target.options
  selected = target.selected
  pending = []
  refreshSettings()
  refresh()
  refreshHistory()
  save()
  notify(message)
}

function pointLabel(existing = objects) {
  const taken = new Set(existing.map(({ name }) => name))
  for (let i = 0; ; i++) {
    const name = String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) + 1 : '')
    if (!taken.has(name)) return name
  }
}

function newObject(kind, fields = {}, name, models = objects) {
  const id = nextId++
  const derivedPoint = ['point', 'onObject', 'midpoint', 'intersection', 'root', 'extremum', 'invert'].includes(kind)
  return { id, kind, name: name ?? (derivedPoint ? pointLabel(models) : `${objectName(kind)} ${id}`), color: colors[(id - 1) % colors.length], ...fields }
}

function modelGeometry(models) {
  const parameters = Object.fromEntries(models.filter((object) => object.kind === 'parameter').map(({ name, value }) => [name, value]))
  const names = Object.keys(parameters).sort()
  return geometryFor(models, (object) => {
    const key = object.formula + '|' + names.join(',')
    try {
      if (!formulas.has(key)) {
        if (formulas.size >= 128) formulas.clear()
        formulas.set(key, compileExpression(object.formula, names))
      }
      const evaluate = formulas.get(key)
      return (x) => evaluate(x, parameters)
    } catch { return null }
  })
}

function recompute() { resolveShape = modelGeometry(objects) }

function draftRenderables() {
  if (!draftExpression) return []
  const { kind, name, ...fields } = draftExpression
  const previous = name && objects.find((object) => object.name === name)
  if (previous && previous.kind !== kind) return []
  if (kind === 'parameter') {
    if (!previous || fields.value === previous.value) return []
    const resolve = modelGeometry(objects.map((object) => object === previous ? { ...object, ...fields } : object))
    return objects.flatMap((object) => {
      if (object.hidden || object.kind !== 'function' || !new RegExp(`\\b${name}\\b`, 'i').test(object.formula)) return []
      const shape = resolve(object.id)
      return shape ? [{ object, shape, screen: screenShape(shape, view, size), draft: true }] : []
    })
  }
  const object = { id: 0, kind, name: name ?? (kind === 'point' ? pointLabel() : ''), color: previous?.color ?? colors[(nextId - 1) % colors.length], ...fields }
  const shape = modelGeometry([...objects, object])(object.id)
  return shape ? [{ object, shape, screen: screenShape(shape, view, size), draft: true }] : []
}

function draw() {
  if (!view) return
  recompute()
  renderables = objects.flatMap((object) => {
    const shape = object.hidden ? null : resolveShape(object.id)
    return shape ? [{ object, shape, screen: screenShape(shape, view, size) }] : []
  })
  const preview = gesture?.ink ?? pending.flatMap((entry) => {
    if (entry.position) return [entry.position]
    const shape = resolveShape(entry.id)
    return shape?.type === 'point' ? [shape.position] : []
  })
  paintScene(ctx, size, view, options, [...renderables, ...draftRenderables()], selected, preview)
}

function refreshGuide() {
  const tool = tools[active]
  $('#active-tool').textContent = tool.name
  $('#plot-help').textContent = tool.hint ?? (tool.minimum ? `${tool.steps[0]}（${pending.length} 点）` :
    `第 ${pending.length + 1} 步 · ${tool.steps[pending.length] ?? tool.steps[0]}`)
  const finish = $('#finish-shape')
  finish.hidden = !tool.minimum
  finish.disabled = pending.length < tool.minimum
}

function button(text, callback, css = 'plot-control') {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = css
  element.textContent = text
  element.addEventListener('click', callback)
  return element
}

const groupButtons = groups.map(([name, symbol], index) => {
  const element = button('', () => selectTool(groups[index][2][0], index), 'plot-group')
  const icon = document.createElement('span')
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = symbol
  element.append(icon, name)
  return element
})
$('#tool-groups').append(...groupButtons)

function selectTool(name, parent = group) {
  const groupChanged = parent !== group || !toolButtons.childElementCount
  group = parent
  active = name
  pending = []
  notify()
  groupButtons.forEach((element, index) => element.setAttribute('aria-pressed', String(index === group)))
  if (groupChanged) {
    toolButtons.replaceChildren(...groups[group][2].map((key) => {
      const element = button(tools[key].name, () => selectTool(key), 'plot-control plot-tool')
      element.dataset.tool = key
      return element
    }))
  }
  for (const element of toolButtons.children) element.setAttribute('aria-pressed', String(element.dataset.tool === active))
  const tool = tools[name]
  $('#tool-parameter').hidden = !tool.value && !tool.text
  if (tool.value) {
    const [label, value, min, max, step = 'any'] = tool.value
    $('#parameter-label').textContent = label
    parametersInput.type = 'number'
    parametersInput.step = step
    parametersInput.min = min
    parametersInput.max = max
    parametersInput.value = value
    parametersInput.required = true
  } else if (tool.text) {
    $('#parameter-label').textContent = '标注文字'
    parametersInput.type = 'text'
    parametersInput.maxLength = 90
    parametersInput.value = ''
  }
  canvas.dataset.cursor = name === 'select' || name === 'pan' ? 'move' : 'draw'
  refreshGuide()
  draw()
}

function describe(object) {
  if (object.kind === 'parameter') return `= ${format(object.value)}`
  if (object.source) return object.source
  const shape = resolveShape(object.id)
  if (!shape) return '当前无法构造'
  if (shape.type === 'point') return `(${format(shape.position.x)}, ${format(shape.position.y)})`
  if (shape.type === 'text') return shape.text
  if (shape.type === 'circle') return `半径 ${format(shape.radius)}`
  const refs = object.refs?.map((id) => lookup(id)?.name).filter(Boolean).join('、')
  return refs || objectName(object.kind)
}

function refreshDescriptions() {
  for (const element of panel.querySelectorAll('[data-object-description]')) {
    const object = lookup(Number(element.dataset.objectDescription))
    if (object) element.textContent = describe(object)
  }
}

function refreshList() {
  panel.replaceChildren(...objects.map((object) => {
    const item = document.createElement('div')
    item.className = 'plot-object'
    item.dataset.selected = String(selected === object.id)
    item.style.setProperty('--object-color', object.color)
    const name = document.createElement('span')
    name.textContent = object.name
    const description = document.createElement('span')
    description.className = 'plot-object-description'
    description.dataset.objectDescription = object.id
    description.textContent = describe(object)
    const select = button('', () => {
      if (active !== 'select' && active !== 'pan' && active !== 'ink') {
        const shape = resolveShape(object.id)
        if (shape && acceptType(shape, expected())) takeInput({ id: object.id })
        else notify(tools[active].steps[pending.length] ?? tools[active].steps[0])
      } else focusObject(object.id)
    }, 'plot-object-select')
    select.dataset.objectId = object.id
    select.setAttribute('aria-pressed', String(selected === object.id))
    select.append(name, description)
    item.append(select)
    const visibility = button(object.hidden ? '显示' : '隐藏', () => {
      const before = snapshot()
      object.hidden = !object.hidden
      record(before)
      refresh()
      panel.querySelector(`[data-visibility="${object.id}"]`)?.focus()
    }, 'plot-control plot-object-visibility')
    visibility.dataset.visibility = object.id
    visibility.setAttribute('aria-label', `${visibility.textContent} ${object.name}`)
    item.append(visibility)
    return item
  }))
  $('#plot-empty').hidden = Boolean(objects.length)
}

function focusObject(id) {
  selected = id
  for (const row of panel.children) {
    const select = row.querySelector('.plot-object-select')
    const matched = Number(select.dataset.objectId) === id
    row.dataset.selected = String(matched)
    select.setAttribute('aria-pressed', String(matched))
  }
  refreshInspector()
  draw()
}

function field(label, input) {
  const wrapper = document.createElement('label')
  const caption = document.createElement('span')
  caption.textContent = label
  wrapper.append(caption, input)
  return wrapper
}

function updateField(object, key, attrs, label) {
  const input = document.createElement('input')
  Object.assign(input, attrs, { value: object[key] })
  input.addEventListener('change', () => {
    const value = input.type === 'number' ? input.valueAsNumber : input.value.trim()
    if (!input.checkValidity() || !String(value).trim()) { input.reportValidity(); input.value = object[key]; return }
    if (value === object[key]) return
    if (key === 'name' && objects.some((candidate) => candidate.name === value)) {
      notify('这个名称已用于其他对象。')
      input.value = object.name
      return
    }
    const before = snapshot()
    object[key] = value
    record(before)
    draw()
    if (key === 'name' || key === 'color') refreshList()
    else refreshDescriptions()
  })
  return field(label, input)
}

function refreshInspector() {
  const object = lookup(selected)
  inspector.hidden = !object
  inspector.replaceChildren()
  if (!object) return
  const fields = document.createElement('div')
  fields.className = 'settings-grid'
  const heading = document.createElement('h2')
  heading.textContent = '对象属性'
  if (!['parameter', 'function'].includes(object.kind)) fields.append(updateField(object, 'name', { maxLength: 40 }, '名称'))
  fields.append(updateField(object, 'color', { type: 'color' }, '颜色'))
  if (object.kind === 'point') {
    for (const axis of ['x', 'y']) fields.append(updateField(object, axis, { type: 'number', step: 'any', min: -limit, max: limit, required: true }, `${axis} 坐标`))
  }
  if (object.kind === 'parameter') {
    const range = document.createElement('input')
    const bound = Math.max(10, Math.ceil(Math.abs(object.value) / 10) * 10)
    Object.assign(range, { type: 'range', min: -bound, max: bound, step: 'any', value: object.value })
    let before
    range.addEventListener('input', () => {
      before ??= snapshot()
      object.value = range.valueAsNumber
      readout.value = format(object.value)
      draw()
      refreshDescriptions()
    })
    range.addEventListener('change', () => { if (before) record(before); before = undefined })
    const readout = document.createElement('output')
    readout.value = format(object.value)
    const wrap = field(`${object.name} 的值`, range)
    wrap.className = 'plot-range'
    wrap.append(readout)
    fields.append(wrap)
  }
  if (resolveShape(object.id)?.type === 'point') {
    const toggle = document.createElement('input')
    toggle.type = 'checkbox'
    toggle.checked = object.label !== false
    toggle.addEventListener('change', () => {
      const before = snapshot()
      object.label = toggle.checked
      record(before)
      draw()
    })
    const label = document.createElement('label')
    label.className = 'plot-check'
    label.append(toggle, '显示点名')
    fields.append(label)
  }
  const remove = button('删除对象', () => deleteObject(object.id), 'plot-control plot-danger')
  inspector.append(heading, fields, remove)
}

function refresh() {
  draw()
  refreshList()
  refreshInspector()
  refreshGuide()
}

function deleteObject(id) {
  const before = snapshot()
  const deleted = new Set([id])
  for (const object of objects) if (object.refs?.some((ref) => deleted.has(ref))) deleted.add(object.id)
  objects = objects.filter((object) => !deleted.has(object.id))
  selected = null
  pending = []
  record(before)
  refresh()
  notify(deleted.size > 1 ? `已删除对象和 ${deleted.size - 1} 个相关构造，可撤销。` : '已删除对象，可撤销。')
}

function expected() { return tools[active].accept?.[pending.length] ?? 'point' }

function acceptType(shape, type) {
  if (type === 'figure') return ['point', 'linear', 'path', 'circle', 'curve', 'arc'].includes(shape.type)
  if (type === 'position') return false
  if (type === 'vector') return shape.type === 'linear' && shape.span === 'vector'
  if (type === 'linearOrCircle') return shape.type === 'linear' || shape.type === 'circle'
  if (type === 'region') return shape.type === 'circle' || shape.type === 'path' && shape.closed
  return shape.type === type
}

function snapped(position, forceInteger = false) {
  const mode = forceInteger ? 'integer' : options.snap
  return Object.fromEntries(['x', 'y'].map((axis) => {
    const step = mode === 'integer' ? 1 : mode === 'grid' ? captureStep(axis === 'x' ? view.sx : view.sy, axis === 'x' ? options.gridX : options.gridY) : 0
    const value = step ? Math.round(position[axis] / step) * step : Math.round(position[axis] * 1000) / 1000
    return [axis, round(clamp(value, -limit, limit))]
  }))
}

function takeInput(entry) {
  const tool = tools[active]
  if (entry.id && pending.some((item) => item.id === entry.id)) {
    if (active === 'polygon' && pending[0].id === entry.id && pending.length >= 3) commitTool()
    else notify('请选择另一个对象。')
    return
  }
  pending.push(entry)
  notify()
  if (!tool.minimum && pending.length >= tool.steps.length) commitTool()
  else { refreshGuide(); draw() }
}

function commitTool() {
  const tool = tools[active]
  const before = snapshot()
  const fail = (message) => { pending = []; notify(message); refreshGuide(); draw() }
  const value = tool.value ? parametersInput.valueAsNumber : undefined
  const text = tool.text ? parametersInput.value.trim() : undefined
  if (tool.value && !parametersInput.reportValidity()) { fail('请先输入有效的工具参数。'); return }
  if (tool.text && !text) { fail('请先输入标注文字。'); parametersInput.focus(); return }
  const models = [...objects]
  const add = (kind, fields, name) => {
    const object = newObject(kind, fields, name, models)
    models.push(object)
    return object.id
  }
  const positional = ['onObject', 'root', 'extremum'].includes(active)
  const refs = pending.map((entry) => entry.id ?? (positional ? null : add('point', entry.position)))
  let result
  if (active === 'point') result = refs[0]
  else if (active === 'intersection') {
    const possible = intersections(resolveShape(refs[0]), resolveShape(refs[1]))
    if (!possible.length) { fail('这两个对象当前没有可标出的交点。'); return }
    for (let i = 0; i < possible.length; i++) result = add(active, { refs, value: i })
  } else if (active === 'onObject') {
    result = add(active, { refs: refs.slice(0, 1), value: closestParameter(resolveShape(refs[0]), pending[1].position) })
  } else if (active === 'root' || active === 'extremum') {
    const interval = [pending[1].position.x, pending[2].position.x].sort((a, b) => a - b)
    const possible = resolveShape(refs[0]).features(active, interval)
    if (!possible.length) { fail('在所选区间未找到可标注的点。可以缩小区间后重试。'); return }
    possible.forEach((_point, index) => { result = add(active, { refs: [refs[0]], interval, value: index }) })
  } else if (active === 'tangent') {
    const resolve = geometryFor(models)
    const p = resolve(refs[0])?.position, circle = resolve(refs[1])
    if (!p || !circle || distance(p, circle.center) < circle.radius - 1e-9) { fail('圆内的点无法向圆作切线。'); return }
    result = add(active, { refs, value: 1 })
    if (distance(p, circle.center) > circle.radius + 1e-9) result = add(active, { refs, value: -1 })
  } else result = add(active === 'triangle' ? 'polygon' : active, { refs, value, text })

  if (!modelGeometry(models)(result)) { fail('当前选择无法完成构造，请更换点或参数。'); return }
  objects = models
  selected = result
  pending = []
  record(before)
  refresh()
  notify(`已创建${tool.name === '描点' ? '点' : tool.name}。`)
}

function clickCanvas(position, event) {
  const kind = expected()
  const radius = event.pointerType === 'touch' ? 23 : 13
  if (kind === 'position') { takeInput({ position: toWorld(view, size, position) }); return }
  if (active === 'polygon' && pending.length >= 3) {
    const first = pending[0].position ?? resolveShape(pending[0].id)?.position
    if (first && distance(position, toScreen(view, size, first)) <= radius) { commitTool(); return }
  }
  const found = hitTest(renderables, position, radius, (shape) => acceptType(shape, kind))
  if (found) {
    if (active === 'point') { focusObject(found.object.id); notify(`已选中 ${found.object.name}。`) }
    else takeInput({ id: found.object.id })
    return
  }
  if (kind === 'point') takeInput({ position: snapped(toWorld(view, size, position), event.shiftKey) })
  else notify(tools[active].steps[pending.length] ?? tools[active].steps[0])
}

function freePoints(id, found = new Set()) {
  if (found.has(id)) return found
  found.add(id)
  for (const ref of lookup(id)?.refs ?? []) freePoints(ref, found)
  return found
}

function screenPosition(event) {
  const bounds = canvas.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

canvas.addEventListener('pointerdown', (event) => {
  if (!view || gesture || event.button !== 0) return
  const at = screenPosition(event)
  const radius = event.pointerType === 'touch' ? 23 : 12
  gesture = { id: event.pointerId, at, view: { ...view } }
  if (active === 'select') {
    const found = hitTest(renderables, at, radius)
    if (found) {
      focusObject(found.object.id)
      const refs = [...freePoints(selected)].map(lookup).filter((object) => object?.kind === 'point')
      gesture.points = refs.map((o) => ({ object: o, x: o.x, y: o.y }))
      if (found.object.kind === 'onObject') gesture.attached = found.object
      if (found.object.kind === 'ink') gesture.inkObject = { object: found.object, points: found.object.points }
    } else gesture.pan = true
  } else if (active === 'pan') gesture.pan = true
  else if (active === 'ink') gesture.ink = [toWorld(view, size, at)]
  else gesture.pick = true
  canvas.setPointerCapture(event.pointerId)
  canvas.focus({ preventScroll: true })
})

canvas.addEventListener('pointermove', (event) => {
  if (!view) return
  const at = screenPosition(event)
  cursor = toWorld(view, size, at)
  if (options.cursor) showCoordinates()
  if (!gesture || gesture.id !== event.pointerId || gesture.pick) return
  const dx = (at.x - gesture.at.x) / view.sx, dy = (gesture.at.y - at.y) / view.sy
  if (gesture.ink) {
    if (distance(gesture.ink.at(-1), cursor) * view.sx > 2) gesture.ink.push(cursor)
  } else if (gesture.pan) {
    view.x = clamp(gesture.view.x - dx, -limit * 2, limit * 2)
    view.y = clamp(gesture.view.y - dy, -limit * 2, limit * 2)
  } else if (distance(at, gesture.at) >= 2 || gesture.before) {
    const { attached, inkObject, points } = gesture
    if (!attached && !inkObject && !points?.length) return
    gesture.before ??= snapshot()
    if (attached) attached.value = closestParameter(resolveShape(attached.refs[0]), cursor)
    else if (inkObject) inkObject.object.points = inkObject.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
    else {
      const movement = points.length === 1 && (event.shiftKey || options.snap !== 'free')
        ? snapped({ x: points[0].x + dx, y: points[0].y + dy }, event.shiftKey) : undefined
      const shiftX = clamp(dx, -limit - Math.min(...points.map(({ x }) => x)), limit - Math.max(...points.map(({ x }) => x)))
      const shiftY = clamp(dy, -limit - Math.min(...points.map(({ y }) => y)), limit - Math.max(...points.map(({ y }) => y)))
      for (const { object, x, y } of points) {
        object.x = movement?.x ?? round(x + shiftX)
        object.y = movement?.y ?? round(y + shiftY)
      }
    }
  }
  draw()
  if (gesture.before) refreshDescriptions()
})

function endPointer(event) {
  if (gesture?.id !== event.pointerId) return
  const { at, ink, pick, before } = gesture
  gesture = null
  const position = screenPosition(event)
  if (event.type === 'pointerup' && pick && distance(at, position) < 15) clickCanvas(position, event)
  if (ink?.length >= 2) {
    const initial = snapshot()
    const object = newObject('ink', { points: ink })
    objects.push(object)
    selected = object.id
    record(initial)
    refresh()
  } else if (before) {
    record(before)
    refreshInspector()
  }
  if (event.type !== 'pointerup' || !pick) draw()
  updateRanges()
}

canvas.addEventListener('pointerup', endPointer)
canvas.addEventListener('pointercancel', endPointer)
canvas.addEventListener('lostpointercapture', endPointer)
canvas.addEventListener('pointerleave', () => { cursor = null; showCoordinates() })

$('#expression-form').addEventListener('submit', (event) => {
  event.preventDefault()
  expressionError.hidden = true
  try {
    const { kind, name, ...fields } = parsePlotInput(expressionInput.value, values())
    const before = snapshot()
    const existing = name && objects.find((object) => object.name === name)
    if (existing && existing.kind !== kind) throw new Error('该名称已用于其他对象。')
    if (existing) { Object.assign(existing, fields); selected = existing.id }
    else {
      const object = newObject(kind, fields, name)
      objects.push(object)
      selected = object.id
    }
    expressionInput.value = ''
    updateExpressionPreview()
    record(before)
    if (kind === 'point') {
      const p = toScreen(view, size, fields)
      if (p.x < 20 || p.x > size.w - 20 || p.y < 20 || p.y > size.h - 20) fitView()
    }
    refresh()
    notify(`已${existing ? '更新' : '添加'}${lookup(selected).name}。`)
  } catch (error) {
    expressionError.textContent = error.message
    expressionError.hidden = false
  }
})

function updateExpressionPreview() {
  const text = expressionInput.value.trim()
  draftExpression = null
  if (text) {
    try {
      katex.render(latexForPreview(text), expressionPreview, {
        output: 'mathml', displayMode: true, throwOnError: true, trust: false, maxExpand: 100, maxSize: 8,
      })
      expressionPreview.dataset.state = 'math'
    } catch {
      expressionPreview.textContent = text
      expressionPreview.dataset.state = 'raw'
    }
    try { draftExpression = parsePlotInput(text, values()) } catch { /* 等输入完整后再预览曲线。 */ }
  } else {
    expressionPreview.textContent = '公式预览'
    delete expressionPreview.dataset.state
  }
  draw()
}

expressionInput.addEventListener('input', () => {
  expressionError.hidden = true
  if (previewFrame) cancelAnimationFrame(previewFrame)
  previewFrame = requestAnimationFrame(() => {
    previewFrame = 0
    updateExpressionPreview()
  })
})

const latexTemplates = {
  fraction: (selected) => [`\\frac{${selected}}{}`, selected ? 8 + selected.length : 6],
  root: (selected) => [`\\sqrt{${selected}}`, 6 + selected.length],
  power: (selected) => selected ? [`(${selected})^{}`, 4 + selected.length] : ['^{}', 2],
  absolute: (selected) => [`\\left|${selected}\\right|`, 6 + selected.length],
}

for (const button of document.querySelectorAll('[data-latex-template]')) {
  button.addEventListener('click', () => {
    const { selectionStart: start, selectionEnd: end, value } = expressionInput
    const [insert, cursor] = latexTemplates[button.dataset.latexTemplate](value.slice(start, end))
    if (value.length - (end - start) + insert.length > expressionInput.maxLength) {
      expressionError.textContent = '表达式最多可输入 240 个字符。'
      expressionError.hidden = false
      return
    }
    expressionInput.setRangeText(insert, start, end, 'end')
    expressionInput.focus()
    expressionInput.setSelectionRange(start + cursor, start + cursor)
    expressionInput.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function showCoordinates() {
  coordinates.hidden = !options.cursor || !cursor
  if (!coordinates.hidden) coordinates.value = `x ${format(cursor.x)}　y ${format(cursor.y)}`
}

function zoom(factor, at = { x: size.w / 2, y: size.h / 2 }) {
  const anchor = toWorld(view, size, at)
  const ratio = clamp(factor, Math.max(minScale / view.sx, minScale / view.sy), Math.min(maxScale / view.sx, maxScale / view.sy))
  view.sx *= ratio
  view.sy *= ratio
  const after = toWorld(view, size, at)
  view.x += anchor.x - after.x
  view.y += anchor.y - after.y
  draw()
  updateRanges()
}

function resetView() {
  view = freshView(size.w)
  draw()
  updateRanges()
}

function fitView() {
  recompute()
  const anchors = objects.flatMap((object) => object.hidden ? [] : shapeAnchors(resolveShape(object.id)))
  if (!anchors.length) { resetView(); return }
  const xs = anchors.map(({ x }) => x), ys = anchors.map(({ y }) => y)
  const left = Math.min(...xs), right = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys)
  const sx = (size.w - 68) / Math.max(right - left, 1), sy = (size.h - 68) / Math.max(top - bottom, 1)
  const s = clamp(Math.min(sx, sy, freshView(size.w).sx * 1.8), minScale, maxScale)
  view = { x: (left + right) / 2, y: (bottom + top) / 2, sx: s, sy: s }
  draw()
  updateRanges()
}

function updateRanges() {
  if (!view || !$('#range-section').open) return
  const p = toWorld(view, size, { x: 0, y: size.h }), q = toWorld(view, size, { x: size.w, y: 0 })
  for (const [key, value] of Object.entries({ xMin: p.x, xMax: q.x, yMin: p.y, yMax: q.y })) {
    if (document.activeElement !== rangeForm.elements[key]) rangeForm.elements[key].value = round(value)
  }
}

function refreshSettings() {
  for (const control of viewOptions.elements) {
    if (!control.name) continue
    if (control.type === 'checkbox') control.checked = options[control.name]
    else control.value = options[control.name]
  }
  rangeForm.elements.equalScale.checked = options.equalScale
  showCoordinates()
}

viewOptions.addEventListener('change', (event) => {
  const control = event.target
  if (!control.name) return
  if (!control.checkValidity()) { control.reportValidity(); refreshSettings(); return }
  const before = snapshot()
  options[control.name] = control.type === 'checkbox' ? control.checked : control.type === 'number' ? control.valueAsNumber || 0 : control.value
  record(before)
  draw()
  showCoordinates()
})

$('#range-section').addEventListener('toggle', updateRanges)
rangeForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const r = rangeForm.elements
  const [left, right, bottom, top] = ['xMin', 'xMax', 'yMin', 'yMax'].map((id) => r[id].valueAsNumber)
  if (![left, right, bottom, top].every(numeric) || left >= right || bottom >= top) {
    notify('范围的最小值须小于最大值，坐标绝对值不能超过 1,000,000。')
    return
  }
  options.equalScale = r.equalScale.checked
  const sx = clamp(size.w / (right - left), minScale, maxScale), sy = clamp(size.h / (top - bottom), minScale, maxScale)
  view = { x: (left + right) / 2, y: (bottom + top) / 2, sx: options.equalScale ? Math.min(sx, sy) : sx, sy: options.equalScale ? Math.min(sx, sy) : sy }
  draw()
  save()
  notify('已应用坐标范围。')
})

canvas.addEventListener('wheel', (event) => {
  if (event.ctrlKey || event.metaKey || gesture || !event.deltaY) return
  event.preventDefault()
  zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, screenPosition(event))
}, { passive: false })
canvas.addEventListener('keydown', (event) => {
  const key = event.key
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
  if (directions[key]) {
    view.x = clamp(view.x + directions[key][0] * 30 / view.sx, -limit * 2, limit * 2)
    view.y = clamp(view.y + directions[key][1] * 30 / view.sy, -limit * 2, limit * 2)
    draw()
    updateRanges()
  } else if (key === '+' || key === '=') zoom(1.25)
  else if (key === '-') zoom(.8)
  else if (key === 'Enter' && tools[active].minimum && pending.length >= tools[active].minimum) commitTool()
  else return
  event.preventDefault()
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && pending.length) { pending = []; refreshGuide(); draw(); notify('已取消当前构造。') }
  if (event.target instanceof Element && event.target.matches('input, textarea, select, [contenteditable]')) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) restore(future, past, '已重做。')
    else restore(past, future, '已撤销。')
  }
})

function changePane(settings) {
  $('#objects-pane').hidden = settings
  $('#settings-pane').hidden = !settings
  $('#objects-tab').setAttribute('aria-pressed', String(!settings))
  $('#settings-tab').setAttribute('aria-pressed', String(settings))
  if (settings) updateRanges()
}

$('#objects-tab').addEventListener('click', () => changePane(false))
$('#settings-tab').addEventListener('click', () => changePane(true))
$('#finish-shape').addEventListener('click', commitTool)
$('#undo').addEventListener('click', () => restore(past, future, '已撤销。'))
$('#redo').addEventListener('click', () => restore(future, past, '已重做。'))
$('#zoom-in').addEventListener('click', () => zoom(1.25))
$('#zoom-out').addEventListener('click', () => zoom(.8))
$('#fit-view').addEventListener('click', fitView)
$('#reset-view').addEventListener('click', resetView)
$('#export-png').addEventListener('click', () => {
  draw()
  const target = document.createElement('canvas')
  const ratio = 2
  target.width = Math.round(size.w * ratio)
  target.height = Math.round(size.h * ratio)
  paintScene(target.getContext('2d'), { ...size, ratio }, view, options, renderables, null)
  target.toBlob((blob) => {
    if (!blob) { notify('无法导出 PNG，请重试。'); return }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Dadealbit-坐标绘图.png'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('已生成 PNG。')
  }, 'image/png')
})

new ResizeObserver(() => {
  const { width, height } = canvas.getBoundingClientRect()
  if (!width || !height) return
  const first = !view
  size = { w: width, h: height, ratio: Math.min(window.devicePixelRatio || 1, 3) }
  canvas.width = Math.round(width * size.ratio)
  canvas.height = Math.round(height * size.ratio)
  if (first) view = loaded.savedView ?? freshView(width)
  if (first && !loaded.savedView && objects.length && objects.some((object) => object.kind === 'point' &&
      (Math.abs(object.x) * view.sx > width * .45 || Math.abs(object.y) * view.sy > height * .45))) fitView()
  else draw()
  updateRanges()
}).observe(canvas)

window.addEventListener('pagehide', save)
recompute()
selectTool('select')
refreshList()
refreshSettings()
refreshHistory()
