// The open bag's heap of face-down discs, as plain numbers so it can be tested without a page.
// Coordinates run from the centre of the bag's mouth; speeds are per 60 Hz frame.
//
// Two discs may overlap up to a share of their width, so they pile up, and the one on top slides
// off the one below. Velvet grips: friction takes a fixed amount of speed every frame, so a push
// weaker than the grip never builds into a slow glide, and once the whole heap is quiet it
// sleeps until something touches it. A disc changes layer only while it is visibly lifted
// (dragged, tossed or picked by keyboard), so nothing sinks out of sight or pops back up.

// Overlap allowed between two resting discs, and between a dragged disc and the rest.
const allow = 0.42
const allowDrag = 0.3
const slide = 0.05
const damp = 0.88
const grip = 0.12
// The bag's bottom is a bowl, but only while the heap slumps as the bag opens.
const bowl = 0.0014
// How far a disc's centre may sit from the middle: a little of it tucks under the lip.
const tuck = 0.32

export interface Disc {
  readonly at: number // the token's place in the draw
  x: number
  y: number
  vx: number
  vy: number
  turn: number // degrees
  spin: number
  z: number
  hop: number // frames left in the air
  fx: number
  fy: number
  press: number[] // unit normals toward neighbours this disc leans on, flattened
}

export interface Finger { readonly x: number; readonly y: number; readonly vx: number; readonly vy: number }

export interface Pile {
  readonly radius: number
  readonly token: number
  discs: Disc[]
  contacts: Set<number>
  drag: Disc | undefined
  finger: Finger | undefined
  quiet: number
  asleep: boolean
  slump: number
  loose: boolean
}

// Large enough to tap, small enough that twenty make a heap rather than a carpet.
export const bagToken = (radius: number, count: number): number =>
  Math.min(radius * 0.62, 2 * radius * Math.sqrt(1.25 / Math.max(1, count)))

const pair = (a: Disc, b: Disc) => Math.min(a.at, b.at) * 1000 + Math.max(a.at, b.at)
const top = (pile: Pile) => pile.discs.reduce((m, d) => Math.max(m, d.z), 0)
const restack = (pile: Pile) => { pile.discs.sort((a, b) => a.z - b.z).forEach((d, i) => { d.z = i }) }
const above = (pile: Pile, d: Disc, under: Disc) => { if (d.z < under.z) { d.z = under.z + 0.5; restack(pile) } }

export const wakePile = (pile: Pile) => { pile.asleep = false; pile.quiet = 0 }

// The tokens still in the bag, tipped in around the middle and left to slump to rest.
export const openPile = (places: readonly number[], radius: number, token: number, random: () => number): Pile => {
  const spread = Math.min(radius - token * 0.6, token * 0.45 * Math.sqrt(places.length))
  const pile: Pile = {
    radius, token, contacts: new Set(), drag: undefined, finger: undefined, quiet: 0, asleep: false, slump: 400, loose: true,
    discs: places.map((at, z) => {
      const r = Math.sqrt(random()) * spread, a = random() * Math.PI * 2
      return { at, x: r * Math.cos(a), y: r * Math.sin(a), vx: 0, vy: 0, turn: random() * 360, spin: 0, z, hop: 0, fx: 0, fy: 0, press: [] }
    }),
  }
  for (let i = 0; i < 900 && (pile.slump > 0 || !pile.asleep); i++) stepPile(pile)
  pile.slump = 0
  pile.loose = false
  return pile
}

const bound = (pile: Pile, d: Disc) => {
  const limit = pile.radius - pile.token * tuck, r = Math.hypot(d.x, d.y)
  if (r <= limit) return
  const nx = d.x / r, ny = d.y / r
  d.x = nx * limit; d.y = ny * limit
  const out = d.vx * nx + d.vy * ny
  if (out > 0) { d.vx -= 1.4 * out * nx; d.vy -= 1.4 * out * ny }
}

// One frame. Returns how much is still moving; a sleeping heap returns 0 and costs nothing.
export const stepPile = (pile: Pile): number => {
  if (pile.asleep) return 0
  const { token: D, discs } = pile
  const now = new Set<number>()
  for (const d of discs) { d.fx = 0; d.fy = 0; d.press = [] }
  for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) {
    const a = discs[i]!, b = discs[j]!
    const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy
    const key = pair(a, b), was = pile.contacts.has(key)
    // A contact ends a little past touching, so two discs at the edge do not flicker in and out of it.
    if (d2 >= D * D * (was ? 1.08 : 1)) continue
    now.add(key)
    const d = Math.sqrt(d2) || 0.01, nx = dx / d || 1, ny = dy / d
    const wa = a === pile.drag ? 0 : b === pile.drag ? 1 : 0.5, wb = a === pile.drag ? 1 : b === pile.drag ? 0 : 0.5
    if (!was) {
      if (a === pile.drag) above(pile, a, b); else if (b === pile.drag) above(pile, b, a)
      else if (a.hop && !b.hop) above(pile, a, b); else if (b.hop && !a.hop) above(pile, b, a)
    }
    const minD = D * (1 - (wa === 0 || wb === 0 ? allowDrag : allow))
    // Discs held at the overlap limit lean on each other: each one's push into the other is cancelled.
    if (d < minD + 1.5) { a.press.push(nx, ny); b.press.push(-nx, -ny) }
    if (d < minD) {
      const pen = (minD - d) * 0.55
      a.x -= nx * pen * wa; a.y -= ny * pen * wa
      b.x += nx * pen * wb; b.y += ny * pen * wb
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
      if (vn < 0) {
        const kick = -vn * 0.9
        a.vx -= nx * kick * wa; a.vy -= ny * kick * wa; b.vx += nx * kick * wb; b.vy += ny * kick * wb
        const across = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx
        a.spin += across * 0.35 * wa; b.spin -= across * 0.35 * wb
      }
    }
    // The disc on top slides down off the one below.
    const o = Math.max(0, 1 - d / D)
    const up = a.z > b.z ? a : b, sign = up === b ? 1 : -1
    if (up !== pile.drag) { up.fx += nx * sign * slide * o; up.fy += ny * sign * slide * o }
  }
  pile.contacts = now
  if (pile.slump > 0) pile.slump--
  const f = pile.finger
  let energy = 0
  for (const d of discs) {
    if (d === pile.drag) continue
    // A finger in the heap pushes discs aside and drags the nearest along.
    if (f && !pile.drag) {
      const dx = d.x - f.x, dy = d.y - f.y, r = Math.hypot(dx, dy) || 0.01, reach = D * 0.75
      if (r < reach) {
        const k = (reach - r) / reach
        d.vx += dx / r * k * 1.4 + f.vx * k * 0.35; d.vy += dy / r * k * 1.4 + f.vy * k * 0.35
        d.spin += (f.vx * dy - f.vy * dx) / reach * 0.4 * k
      }
    }
    if (pile.slump > 0) { d.fx -= d.x * bowl; d.fy -= d.y * bowl }
    for (let k = 0; k < d.press.length; k += 2) {
      const into = d.fx * d.press[k]! + d.fy * d.press[k + 1]!
      if (into > 0) { d.fx -= into * d.press[k]!; d.fy -= into * d.press[k + 1]! }
    }
    d.vx += d.fx; d.vy += d.fy
    const speed = Math.hypot(d.vx, d.vy), mu = d.hop || pile.loose ? grip * 0.2 : grip
    const keep = speed > mu ? (speed - mu) / speed : 0
    d.vx *= keep * damp; d.vy *= keep * damp
    d.spin = Math.abs(d.spin) < 0.08 ? 0 : d.spin * 0.88
    d.x += d.vx; d.y += d.vy; d.turn += d.spin
    bound(pile, d)
    if (d.hop) d.hop--
    energy = Math.max(energy, Math.hypot(d.vx, d.vy) + Math.abs(d.spin) * 0.05 + (d.hop ? 1 : 0))
  }
  if (pile.drag || f || pile.slump > 0 || energy > 0.05) pile.quiet = 0
  else if (++pile.quiet > 12) {
    for (const d of discs) { d.vx = 0; d.vy = 0; d.spin = 0 }
    pile.asleep = true
    return 0
  }
  return energy
}

// The disc a finger lands on: the highest one under it.
export const hitPile = (pile: Pile, x: number, y: number): Disc | undefined =>
  pile.discs.filter(d => Math.hypot(d.x - x, d.y - y) < pile.token * 0.48).sort((a, b) => b.z - a.z)[0]

// Picked up: on top of everything, and seen to rise there.
export const lift = (pile: Pile, d: Disc, hop = 0) => {
  d.z = top(pile) + 1
  d.hop = Math.max(d.hop, hop)
  restack(pile)
  wakePile(pile)
}

// A finger slid from a disc carries it, on top of what it crosses.
export const grab = (pile: Pile, d: Disc) => { pile.drag = d; lift(pile, d) }

// A finger slid from an empty spot stirs the heap instead of carrying one disc.
export const stir = (pile: Pile, finger: Finger) => { pile.finger = finger; wakePile(pile) }

// A disc let go mid-slide carries on a little, still above what it crosses.
export const letGo = (pile: Pile) => {
  pile.finger = undefined
  if (pile.drag) { pile.drag.hop = 6; pile.drag = undefined }
  wakePile(pile)
}

export const dragTo = (pile: Pile, x: number, y: number) => {
  const d = pile.drag
  if (!d) return
  d.vx = (x - d.x) * 0.55; d.vy = (y - d.y) * 0.55
  d.x += d.vx; d.y += d.vy
  bound(pile, d)
}

// The bag moved: every disc keeps some of its old speed, so relative to the bag it lurches the other way.
export const joltPile = (pile: Pile, fx: number, fy: number, strength: number, random: () => number) => {
  wakePile(pile)
  for (const d of pile.discs) {
    if (d === pile.drag) continue
    const k = 0.75 + random() * 0.5
    d.vx += fx * k; d.vy += fy * k; d.spin += (random() - 0.5) * strength * 0.25
  }
}

// A hard shake throws one disc from low in the heap up onto the top.
export const tossPile = (pile: Pile, random: () => number) => {
  const low = [...pile.discs].sort((a, b) => a.z - b.z).slice(0, Math.ceil(pile.discs.length / 2))
  const d = low[Math.floor(random() * low.length)]
  if (!d) return
  const a = random() * Math.PI * 2
  d.vx += Math.cos(a) * 2; d.vy += Math.sin(a) * 2
  lift(pile, d, 12)
}

export interface Pose {
  readonly level: number // how many discs it rests on, stacked
  readonly cover: number // how much of it lies under others
  readonly tilt: number // degrees, its edge raised toward the disc below
  readonly toward: readonly [number, number] // unit direction of that raised edge
}

// How each disc lies: resting with one edge on a neighbour, that edge rises; a disc lying almost
// flat on another barely tilts.
export const posePile = (pile: Pile): ReadonlyMap<number, Pose> => {
  const D = pile.token
  const discs = [...pile.discs].sort((a, b) => a.z - b.z)
  const acc = discs.map(() => ({ level: 0, tx: 0, ty: 0, cover: 0, most: 0 }))
  for (let i = 0; i < discs.length; i++) for (let j = 0; j < i; j++) {
    const d = discs[i]!, u = discs[j]!, r = Math.hypot(d.x - u.x, d.y - u.y)
    if (r >= D * 0.97) continue
    const o = 1 - r / D
    if (o < 0.04) continue
    const me = acc[i]!, below = acc[j]!
    me.level = Math.max(me.level, below.level + 1)
    me.tx += (u.x - d.x) / (r || 1) * o; me.ty += (u.y - d.y) / (r || 1) * o
    me.most = Math.max(me.most, o); below.cover += o
  }
  return new Map(discs.map((d, i) => {
    const { level, tx, ty, cover, most } = acc[i]!, m = Math.hypot(tx, ty)
    const tilt = m > 0.001 ? Math.min(14, 5 + 11 * (1 - most)) * Math.min(1, m * 4) : 0
    return [d.at, { level, cover, tilt, toward: m ? [tx / m, ty / m] as const : [0, 0] as const }]
  }))
}
