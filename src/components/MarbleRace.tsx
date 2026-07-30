import { useEffect, useRef, useState } from 'react'
import type MatterNamespace from 'matter-js'

// matter-js is only needed on this one admin page, so it's dynamically
// imported (not a static top-level import) — Vite splits it into its own
// chunk, keeping it out of the bundle every student/judge downloads.
type MatterModule = typeof MatterNamespace

async function loadMatter(): Promise<MatterModule> {
  const mod = await import('matter-js')
  // matter-js is a UMD/CJS module (`module.exports = Matter`); bundlers
  // expose that as `.default` on dynamic import, but fall back to the
  // module object itself in case interop differs.
  return (mod as unknown as { default?: MatterModule }).default ?? (mod as unknown as MatterModule)
}

export interface FinishedTeam {
  id: string
  name: string
}

interface MarbleRaceProps {
  teams: FinishedTeam[]
  /** Called once per marble crossing the finish gap, with the team that
   * marble was carrying and its 1-based finish rank. The physics race
   * itself decides this order — nothing pre-determines it. */
  onMarbleFinish: (team: FinishedTeam, rank: number) => void
  /** Called once all marbles have finished, with the full ordered list of
   * team ids in finish order (rank 1 first). */
  onComplete: (finalOrderTeamIds: string[]) => void
}

// ---- Track layout (world space — much taller than the visible viewport;
// the camera pans down to follow the leader). Alternates peg fields,
// zigzag deflector walls, and rotating motor paddles so there's something
// new happening throughout the whole descent, not just near the top. ----
const VIEWPORT_WIDTH = 480
const VIEWPORT_HEIGHT = 720
const TRACK_WIDTH = 480
// Sized to still read clearly when the canvas is displayed small (embedded
// in the admin page) as well as scaled way up (fullscreen, projected for a
// room) — see the fullscreen-sizing logic further down.
const MARBLE_RADIUS = 16
const PEG_RADIUS = 5

// Fullscreen display sizing: the physics/world coordinates above never
// change, only how large the fixed VIEWPORT_WIDTH x VIEWPORT_HEIGHT canvas
// is drawn on screen (the browser scales the same raster bitmap up, same
// idea as an <img> — cheaper than re-deriving the whole track layout for
// an arbitrary aspect ratio).
const FULLSCREEN_ASPECT_RATIO = VIEWPORT_WIDTH / VIEWPORT_HEIGHT
const FULLSCREEN_MARGIN_X = 32
const FULLSCREEN_MARGIN_Y = 96

const SPAWN_Y = 40

// Peg fields 1 and 2 originally used 8 pegs per row (60px pitch) — fine
// for the original MARBLE_RADIUS of 11 (22px diameter), but after that
// grew to 16 (32px diameter) for legibility, 15 marbles funneling through
// an 8-wide peg grid genuinely clogged (verified via a headless
// matter-js simulation harness, not just eyeballing: with 8 cols, races
// routinely never got past ~10/15 finishers even after 90+ simulated
// seconds; peg field 3 already used 6 cols/70px pitch and was never a
// problem). 5/6 cols (96px/80px pitch) give the bigger marbles enough
// room to pass without gridlocking, confirmed by the same harness
// reliably reaching all 15 finishers in ~15-20s.
const PEG_FIELD_1_COLS = 5
const PEG_FIELD_2_COLS = 6

const PEG_FIELD_1_TOP = 120
const PEG_FIELD_1_ROWS = 8
const PEG_FIELD_1_BOTTOM = PEG_FIELD_1_TOP + PEG_FIELD_1_ROWS * 58

const MOTOR_1_Y = PEG_FIELD_1_BOTTOM + 90

// Deflector zone geometry: the original walls ran almost the full track
// width for only a ~46px vertical drop (~8° from horizontal) — barely
// steeper than a shelf. With 15 marbles funneling through, several would
// land on the same near-flat wall together, jam against each other, and
// sit there (low friction alone isn't enough to clear a multi-body jam on
// that shallow a slope) until an escalating-chaos impulse eventually
// happened to knock them loose — the reported "stalling". DEFLECTOR_DROP/
// DEFLECTOR_SPAN below are steep enough (~40° from horizontal) that
// gravity's along-slope component clears a jam quickly instead of
// resting, and the taller DEFLECTOR_ROW_HEIGHT gives a deflected marble
// room to actually fall (regain speed) before reaching the next one,
// instead of chaining hits at near-zero velocity.
const DEFLECTOR_1_TOP = MOTOR_1_Y + 100
const DEFLECTOR_1_ROWS = 3
const DEFLECTOR_ROW_HEIGHT = 150
const DEFLECTOR_DROP = 120
const DEFLECTOR_SPAN = 150
const DEFLECTOR_1_BOTTOM = DEFLECTOR_1_TOP + DEFLECTOR_1_ROWS * DEFLECTOR_ROW_HEIGHT

const PEG_FIELD_2_TOP = DEFLECTOR_1_BOTTOM + 40
const PEG_FIELD_2_ROWS = 8
const PEG_FIELD_2_BOTTOM = PEG_FIELD_2_TOP + PEG_FIELD_2_ROWS * 58

const MOTOR_2_Y = PEG_FIELD_2_BOTTOM + 90

const PEG_FIELD_3_TOP = MOTOR_2_Y + 130
const PEG_FIELD_3_ROWS = 6
const PEG_FIELD_3_BOTTOM = PEG_FIELD_3_TOP + PEG_FIELD_3_ROWS * 70

const MOTOR_3_Y = PEG_FIELD_3_BOTTOM + 90

const DEFLECTOR_2_TOP = MOTOR_3_Y + 100
const DEFLECTOR_2_ROWS = 2
const DEFLECTOR_2_BOTTOM = DEFLECTOR_2_TOP + DEFLECTOR_2_ROWS * DEFLECTOR_ROW_HEIGHT

const MOTOR_4_Y = DEFLECTOR_2_BOTTOM + 100

const CHAOS_ZONE_TOP = MOTOR_4_Y + 140
const CHAOS_ZONE_HEIGHT = 340
const FUNNEL_TOP = CHAOS_ZONE_TOP + CHAOS_ZONE_HEIGHT
const FUNNEL_HEIGHT = 380
const FUNNEL_GAP = 70
const FINISH_PLAZA_HEIGHT = 220
const TRACK_HEIGHT = FUNNEL_TOP + FUNNEL_HEIGHT + FINISH_PLAZA_HEIGHT

// The funnel narrows the full track width down to this gap; CENTER_X/
// GAP_LEFT/GAP_RIGHT are shared module-level constants (not locals inside
// buildTrack) because checkFinishes() below needs them too, to verify a
// marble is actually within the gap — not just past a Y line — before
// counting it as finished (see checkFinishes' comment for why).
const CENTER_X = TRACK_WIDTH / 2
const GAP_LEFT = CENTER_X - FUNNEL_GAP / 2
const GAP_RIGHT = CENTER_X + FUNNEL_GAP / 2

// Was FUNNEL_TOP + FUNNEL_HEIGHT + 14 — only 14px past where the funnel
// narrows to the gap, right at the neck where marbles jam/arch waiting
// their turn through a gap barely 2 marble-diameters wide. A marble
// being jostled by that jam could have its center momentarily pushed past
// a line that close while still trapped, not genuinely through. More
// clearance (see THROAT_BOTTOM below, which encloses this whole stretch
// on both sides) means a marble is only past FINISH_Y once it has
// actually cleared the jam into open space below the throat.
const FINISH_Y = FUNNEL_TOP + FUNNEL_HEIGHT + 40
// How far the throat (straight walls continuing the funnel's gap width)
// extends below the funnel's tip. Below the tip there would otherwise be
// nothing but the far-away track border walls — wide open space where a
// marble that somehow ended up there (a fast physics step tunneling
// through a thin wall, or a jam shoving it forward) could sit at any X
// position, including outside the real gap, while still registering
// past FINISH_Y. Enclosing this stretch on both sides removes that
// possibility structurally, not just via the position check below.
const THROAT_BOTTOM = FUNNEL_TOP + FUNNEL_HEIGHT + 70

// Escalating chaos: every IMPULSE_INTERVAL_FRAMES, every still-racing
// marble gets a small random nudge, growing stronger the longer the race
// runs so it can never fully stall out.
const IMPULSE_INTERVAL_FRAMES = 15
const IMPULSE_BASE = 0.0007
const IMPULSE_MAX = 0.006
const IMPULSE_RAMP_SECONDS = 25

const MARBLE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
]

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** A straight wall segment between two world points — used for track
 * borders, the angled funnel walls near the finish, and the zigzag
 * deflector obstacles. */
function wallSegment(
  Matter: MatterModule,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness: number,
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx)
  const wall = Matter.Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, length, thickness, {
    isStatic: true,
    friction: 0.05,
    restitution: 0.4,
  })
  Matter.Body.setAngle(wall, angle)
  return wall
}

interface Motor {
  body: MatterNamespace.Body
  angularVelocity: number
}

/** A rotating "paddle" obstacle: pinned in place by a zero-length
 * constraint (so collisions can't knock it off-center) while a constant
 * angular velocity is re-asserted every step — the standard matter-js
 * recipe for a motor body that keeps spinning regardless of what hits it. */
function createMotor(Matter: MatterModule, x: number, y: number, length: number, angularVelocity: number) {
  const body = Matter.Bodies.rectangle(x, y, length, 18, {
    friction: 0.05,
    restitution: 0.9,
  })
  const pin = Matter.Constraint.create({
    pointA: { x, y },
    bodyB: body,
    pointB: { x: 0, y: 0 },
    length: 0,
    stiffness: 1,
  })
  return { body, pin, motor: { body, angularVelocity } as Motor }
}

function buildPegField(
  Matter: MatterModule,
  topY: number,
  rows: number,
  pegsPerRow: number,
  pegRadius: number,
  rowSpacing: number,
) {
  const pegs: MatterNamespace.Body[] = []
  const colSpacing = TRACK_WIDTH / pegsPerRow
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 0 ? 0 : colSpacing / 2
    for (let col = 0; col < pegsPerRow; col++) {
      const x = offset + (col + 0.5) * colSpacing
      if (x < 22 || x > TRACK_WIDTH - 22) continue
      const y = topY + row * rowSpacing
      pegs.push(
        Matter.Bodies.circle(x, y, pegRadius, { isStatic: true, restitution: 0.5, friction: 0 }),
      )
    }
  }
  return pegs
}

/** A zigzag chute of alternating diagonal walls — a different obstacle
 * "feel" from the round peg fields, forcing marbles to weave side to
 * side rather than just bouncing straight down. Steep (~40° from
 * horizontal via DEFLECTOR_DROP/DEFLECTOR_SPAN) so marbles slide off
 * quickly instead of resting/jamming — see the constants' comment above
 * for why the original ~8° walls caused stalling. */
function buildDeflectorZone(Matter: MatterModule, topY: number, rows: number) {
  const walls: MatterNamespace.Body[] = []
  for (let i = 0; i < rows; i++) {
    const y = topY + i * DEFLECTOR_ROW_HEIGHT
    const fromLeft = i % 2 === 0
    walls.push(
      fromLeft
        ? wallSegment(Matter, 15, y, 15 + DEFLECTOR_SPAN, y + DEFLECTOR_DROP, 14)
        : wallSegment(
            Matter,
            TRACK_WIDTH - 15,
            y,
            TRACK_WIDTH - 15 - DEFLECTOR_SPAN,
            y + DEFLECTOR_DROP,
            14,
          ),
    )
  }
  return walls
}

interface TrackState {
  Matter: MatterModule
  engine: MatterNamespace.Engine
  marbles: MatterNamespace.Body[]
  marbleTeams: Map<number, FinishedTeam & { color: string }>
  motors: Motor[]
  finished: boolean[]
  finishOrder: number[]
  frameCount: number
  frameId: number
  done: boolean
  cameraY: number
  bursts: Burst[]
}

interface Burst {
  x: number
  y: number
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[]
}

function spawnBurst(x: number, y: number, color: string): Burst {
  const particles = Array.from({ length: 14 }, () => {
    const angle = Math.random() * Math.PI * 2
    const speed = 2 + Math.random() * 4
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 40 + Math.random() * 20,
      color: Math.random() < 0.5 ? color : MARBLE_COLORS[Math.floor(Math.random() * MARBLE_COLORS.length)],
    }
  })
  return { x, y, particles }
}

function buildTrack(Matter: MatterModule, teams: FinishedTeam[]): TrackState {
  const { Bodies, Body, Composite } = Matter
  const engine = Matter.Engine.create()
  engine.gravity.y = 1

  const bodies: MatterNamespace.Body[] = []
  const wallOptions = { isStatic: true, friction: 0.05, restitution: 0.3 }
  bodies.push(
    Bodies.rectangle(-10, TRACK_HEIGHT / 2, 20, TRACK_HEIGHT, wallOptions),
    Bodies.rectangle(TRACK_WIDTH + 10, TRACK_HEIGHT / 2, 20, TRACK_HEIGHT, wallOptions),
    Bodies.rectangle(TRACK_WIDTH / 2, TRACK_HEIGHT + 10, TRACK_WIDTH, 20, wallOptions),
  )

  bodies.push(...buildPegField(Matter, PEG_FIELD_1_TOP, PEG_FIELD_1_ROWS, PEG_FIELD_1_COLS, PEG_RADIUS, 58))
  bodies.push(...buildDeflectorZone(Matter, DEFLECTOR_1_TOP, DEFLECTOR_1_ROWS))
  bodies.push(...buildPegField(Matter, PEG_FIELD_2_TOP, PEG_FIELD_2_ROWS, PEG_FIELD_2_COLS, PEG_RADIUS, 58))
  bodies.push(...buildPegField(Matter, PEG_FIELD_3_TOP, PEG_FIELD_3_ROWS, 6, 7, 70))
  bodies.push(...buildDeflectorZone(Matter, DEFLECTOR_2_TOP, DEFLECTOR_2_ROWS))

  // The narrow finish chokepoint: two angled walls funnel the full track
  // width down to a deliberately tight gap, creating a bottleneck.
  bodies.push(
    wallSegment(Matter, 0, FUNNEL_TOP, GAP_LEFT, FUNNEL_TOP + FUNNEL_HEIGHT, 20),
    wallSegment(Matter, TRACK_WIDTH, FUNNEL_TOP, GAP_RIGHT, FUNNEL_TOP + FUNNEL_HEIGHT, 20),
  )
  // The throat: straight walls continuing the funnel's gap width a bit
  // further down, through FINISH_Y — see THROAT_BOTTOM's comment above.
  bodies.push(
    wallSegment(Matter, GAP_LEFT, FUNNEL_TOP + FUNNEL_HEIGHT, GAP_LEFT, THROAT_BOTTOM, 16),
    wallSegment(Matter, GAP_RIGHT, FUNNEL_TOP + FUNNEL_HEIGHT, GAP_RIGHT, THROAT_BOTTOM, 16),
  )

  const motorDefs = [
    createMotor(Matter, CENTER_X, MOTOR_1_Y, 170, 0.05),
    createMotor(Matter, CENTER_X, MOTOR_2_Y, 190, -0.045),
    createMotor(Matter, CENTER_X, MOTOR_3_Y, 160, 0.06),
    createMotor(Matter, CENTER_X, MOTOR_4_Y, 200, -0.05),
  ]
  const motors = motorDefs.map((m) => m.motor)
  for (const m of motorDefs) {
    bodies.push(m.body)
    Composite.add(engine.world, m.pin)
  }

  const raceTeams = shuffled(teams)
  const marbles: MatterNamespace.Body[] = []
  const marbleTeams = new Map<number, FinishedTeam & { color: string }>()
  const spawnMargin = 30
  const spawnWidth = TRACK_WIDTH - spawnMargin * 2
  // Staggered grid, not one long row: with 15 marbles at MARBLE_RADIUS 16
  // (32px diameter) spread across a single row, each got only
  // spawnWidth/15 ≈ 28px of "slot" width — less than their own diameter,
  // so they spawned already overlapping and matter-js's very first
  // collision-resolution step launched them in random directions before
  // the race even properly started. SPAWN_COLS=5 gives each marble ~84px
  // of slot width (comfortably more than 32px) with 3 shallow rows
  // (staggered in Y too) instead of 1 crowded one.
  const spawnCols = 5
  const spawnColSpacing = spawnWidth / spawnCols
  raceTeams.forEach((team, index) => {
    const col = index % spawnCols
    const row = Math.floor(index / spawnCols)
    const x = spawnMargin + spawnColSpacing * (col + 0.5) + (Math.random() - 0.5) * (spawnColSpacing * 0.4)
    const y = SPAWN_Y + row * 26 + Math.random() * 12
    const color = MARBLE_COLORS[index % MARBLE_COLORS.length]
    const marble = Bodies.circle(x, y, MARBLE_RADIUS, {
      restitution: 0.6,
      friction: 0.02,
      frictionAir: 0.0008,
      density: 0.002,
    })
    Body.setVelocity(marble, { x: (Math.random() - 0.5) * 2, y: 0 })
    marbles.push(marble)
    marbleTeams.set(marble.id, { ...team, color })
  })

  Composite.add(engine.world, [...bodies, ...marbles])

  return {
    Matter,
    engine,
    marbles,
    marbleTeams,
    motors,
    finished: new Array(marbles.length).fill(false),
    finishOrder: [],
    frameCount: 0,
    frameId: 0,
    done: false,
    cameraY: 0,
    bursts: [],
  }
}

function stepMotors(state: TrackState) {
  for (const motor of state.motors) {
    state.Matter.Body.setAngularVelocity(motor.body, motor.angularVelocity)
  }
}

function applyEscalatingChaos(state: TrackState) {
  if (state.frameCount % IMPULSE_INTERVAL_FRAMES !== 0) return
  const elapsedSeconds = (state.frameCount / 60) | 0
  const intensity = Math.min(
    IMPULSE_BASE + (IMPULSE_MAX - IMPULSE_BASE) * (elapsedSeconds / IMPULSE_RAMP_SECONDS),
    IMPULSE_MAX,
  )
  state.marbles.forEach((marble, index) => {
    if (state.finished[index]) return
    const angle = Math.random() * Math.PI * 2
    state.Matter.Body.applyForce(marble, marble.position, {
      x: Math.cos(angle) * intensity,
      y: Math.sin(angle) * intensity,
    })
  })
}

function checkFinishes(
  state: TrackState,
  onMarbleFinish: (team: FinishedTeam, rank: number) => void,
) {
  state.marbles.forEach((marble, index) => {
    if (state.finished[index]) return
    const { x, y } = marble.position
    if (y <= FINISH_Y) return
    // Correctness guard, not just tuning: a marble should only ever be
    // past FINISH_Y while genuinely within the gap it funneled through —
    // the throat walls in buildTrack physically enforce that in the
    // normal case, but this checks it explicitly too, so a marble can
    // never be counted as "finished" purely from a Y-position false
    // positive (e.g. a fast physics step tunneling past a thin wall, or
    // a multi-body jam shoving it forward) without actually having
    // cleared the gap. Margin of one marble radius on each side so a
    // genuinely-through marble's center is never rejected right at the
    // edge.
    if (x < GAP_LEFT - MARBLE_RADIUS || x > GAP_RIGHT + MARBLE_RADIUS) return
    state.finished[index] = true
    state.finishOrder.push(index)
    const team = state.marbleTeams.get(marble.id)
    const rank = state.finishOrder.length
    if (team) {
      state.bursts.push(spawnBurst(marble.position.x, FINISH_Y, team.color))
      onMarbleFinish({ id: team.id, name: team.name }, rank)
    }
  })
}

/** Once every marble except one has genuinely crossed the finish gap,
 * immediately place the lone straggler at the final rank instead of
 * waiting for it to physically arrive — it may be stuck (track jam, slow
 * chaotic path), and there's no meaningful difference between being last
 * by arrival vs. by elimination. Also acts as a safety net for
 * checkFinishes above: even in some edge case it hasn't fully accounted
 * for, the race can never hang waiting on more than one marble. */
function checkAutoFinishStraggler(
  state: TrackState,
  onMarbleFinish: (team: FinishedTeam, rank: number) => void,
) {
  if (state.marbles.length <= 1) return
  if (state.finishOrder.length !== state.marbles.length - 1) return
  const stragglerIndex = state.finished.findIndex((isFinished) => !isFinished)
  if (stragglerIndex === -1) return

  state.finished[stragglerIndex] = true
  state.finishOrder.push(stragglerIndex)
  const marble = state.marbles[stragglerIndex]
  const team = state.marbleTeams.get(marble.id)
  const rank = state.finishOrder.length
  if (team) {
    onMarbleFinish({ id: team.id, name: team.name }, rank)
  }
}

function updateBursts(state: TrackState) {
  for (const burst of state.bursts) {
    for (const particle of burst.particles) {
      particle.x += particle.vx
      particle.y += particle.vy
      particle.vy += 0.15
      particle.life -= 1
    }
  }
  state.bursts = state.bursts
    .map((burst) => ({ ...burst, particles: burst.particles.filter((p) => p.life > 0) }))
    .filter((burst) => burst.particles.length > 0)
}

/** Keep team-name labels short — full names would overlap badly with 15
 * marbles potentially clustered together. */
function shortLabel(name: string): string {
  return name.length > 7 ? `${name.slice(0, 7)}…` : name
}

function drawMarbleLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const metrics = ctx.measureText(text)
  const paddingX = 6
  const chipWidth = metrics.width + paddingX * 2
  const chipHeight = 19
  const chipX = x - chipWidth / 2
  const chipY = y + MARBLE_RADIUS + 5

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  if (ctx.roundRect) {
    ctx.beginPath()
    ctx.roundRect(chipX, chipY, chipWidth, chipHeight, 3)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillRect(chipX, chipY, chipWidth, chipHeight)
    ctx.strokeRect(chipX, chipY, chipWidth, chipHeight)
  }

  ctx.fillStyle = '#18181b'
  ctx.fillText(text, x, chipY + chipHeight / 2 + 0.5)
}

function render(ctx: CanvasRenderingContext2D, state: TrackState) {
  const { Matter, engine } = state

  // Camera: ease toward keeping the current leader (furthest marble down
  // the track) in view, roughly 40% down the viewport.
  const leaderY = Math.max(...state.marbles.map((m) => m.position.y))
  const targetCameraY = Math.max(
    0,
    Math.min(leaderY - VIEWPORT_HEIGHT * 0.4, TRACK_HEIGHT - VIEWPORT_HEIGHT),
  )
  state.cameraY += (targetCameraY - state.cameraY) * 0.08

  ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT)

  ctx.save()
  ctx.translate(0, -state.cameraY)

  // Finish line marker across the gap.
  ctx.strokeStyle = '#6d28d9'
  ctx.lineWidth = 2
  ctx.setLineDash([8, 6])
  ctx.beginPath()
  ctx.moveTo(0, FINISH_Y)
  ctx.lineTo(TRACK_WIDTH, FINISH_Y)
  ctx.stroke()
  ctx.setLineDash([])

  const marbleBodies: MatterNamespace.Body[] = []

  for (const body of Matter.Composite.allBodies(engine.world)) {
    if (body.isStatic) {
      if (body.circleRadius) {
        ctx.beginPath()
        ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2)
        ctx.fillStyle = '#d4d4d8'
        ctx.fill()
      } else {
        // Rectangles (walls / funnel / deflectors) — draw using their
        // actual vertices so angled walls render correctly.
        const vertices = body.vertices
        ctx.beginPath()
        ctx.moveTo(vertices[0].x, vertices[0].y)
        for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y)
        ctx.closePath()
        ctx.fillStyle = '#e4e4e7'
        ctx.fill()
      }
      continue
    }

    // Motor paddles are non-static but not marbles — distinguish by radius.
    if (!body.circleRadius) {
      const vertices = body.vertices
      ctx.beginPath()
      ctx.moveTo(vertices[0].x, vertices[0].y)
      for (let i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y)
      ctx.closePath()
      ctx.fillStyle = '#52525b'
      ctx.fill()
      continue
    }

    ctx.beginPath()
    ctx.arc(body.position.x, body.position.y, MARBLE_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = state.marbleTeams.get(body.id)?.color ?? '#6d28d9'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
    ctx.lineWidth = 1
    ctx.stroke()
    marbleBodies.push(body)
  }

  // Labels drawn in a second pass, after all marbles, so a label never
  // gets visually buried under a neighboring marble.
  for (const body of marbleBodies) {
    const team = state.marbleTeams.get(body.id)
    if (!team) continue
    drawMarbleLabel(ctx, body.position.x, body.position.y, shortLabel(team.name), team.color)
  }

  for (const burst of state.bursts) {
    for (const particle of burst.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / 60)
      ctx.fillStyle = particle.color
      ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4)
    }
  }
  ctx.globalAlpha = 1

  ctx.restore()
}

/** Runs a real matter-js physics simulation: marbles (one per team,
 * shuffled start order) race down an elongated track through peg fields,
 * zigzag deflector walls, and four rotating "motor" paddles, funneling
 * into a narrow finish chokepoint, with escalating random impulses so the
 * race can never fully stall. Finish order is genuinely decided by the
 * physics — the caller persists it via submit_presentation_order() once
 * onComplete fires. */
export function MarbleRace({ teams, onMarbleFinish, onComplete }: MarbleRaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<TrackState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [liveRanking, setLiveRanking] = useState<{ rank: number; name: string }[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenSize, setFullscreenSize] = useState<{ width: number; height: number } | null>(
    null,
  )

  // The race is meant to be projected for a whole room, and the fixed
  // 480x720 canvas reads too small for that even with the bigger marbles
  // above — so fullscreen doesn't just blow up the surrounding page, it
  // recomputes a display size that actually fills the screen (preserving
  // the canvas's aspect ratio) and applies it as inline width/height,
  // overriding the normal responsive CSS sizing.
  useEffect(() => {
    function computeFullscreenSize() {
      const availableWidth = Math.max(window.innerWidth - FULLSCREEN_MARGIN_X, 240)
      const availableHeight = Math.max(window.innerHeight - FULLSCREEN_MARGIN_Y, 360)
      let width = availableWidth
      let height = width / FULLSCREEN_ASPECT_RATIO
      if (height > availableHeight) {
        height = availableHeight
        width = height * FULLSCREEN_ASPECT_RATIO
      }
      return { width: Math.round(width), height: Math.round(height) }
    }

    function handleFullscreenChange() {
      const active = document.fullscreenElement === containerRef.current
      setIsFullscreen(active)
      setFullscreenSize(active ? computeFullscreenSize() : null)
    }

    function handleResize() {
      if (document.fullscreenElement === containerRef.current) {
        setFullscreenSize(computeFullscreenSize())
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  async function handleToggleFullscreen() {
    const container = containerRef.current
    if (!container) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await container.requestFullscreen()
      }
    } catch {
      // Fullscreen can be denied (no user gesture, browser/OS policy,
      // etc.) — not fatal, the race still runs fine at normal size.
    }
  }

  useEffect(() => {
    let cancelled = false

    loadMatter()
      .then((Matter) => {
        if (cancelled) return
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        const state = buildTrack(Matter, teams)
        stateRef.current = state
        setLoading(false)

        function handleFinish(team: FinishedTeam, rank: number) {
          setLiveRanking((previous) => [...previous, { rank, name: team.name }])
          onMarbleFinish(team, rank)
        }

        function frame() {
          if (state.done) return
          state.frameCount += 1
          stepMotors(state)
          applyEscalatingChaos(state)
          Matter.Engine.update(state.engine, 1000 / 60)
          checkFinishes(state, handleFinish)
          checkAutoFinishStraggler(state, handleFinish)
          updateBursts(state)
          render(ctx!, state)

          if (state.finished.every(Boolean)) {
            state.done = true
            const finalOrderTeamIds = state.finishOrder.map(
              (marbleIndex) => state.marbleTeams.get(state.marbles[marbleIndex].id)!.id,
            )
            onComplete(finalOrderTeamIds)
            return
          }
          state.frameId = requestAnimationFrame(frame)
        }

        state.frameId = requestAnimationFrame(frame)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoading(false)
          setLoadError(err instanceof Error ? err.message : String(err))
        }
      })

    return () => {
      cancelled = true
      const state = stateRef.current
      if (state) {
        state.done = true
        cancelAnimationFrame(state.frameId)
        state.Matter.Composite.clear(state.engine.world, false)
        state.Matter.Engine.clear(state.engine)
      }
      stateRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="marble-race" ref={containerRef}>
      {loading && <p className="page-status">물리 엔진 불러오는 중...</p>}
      {loadError && <p className="error-text">마블 레이스를 불러오지 못했습니다: {loadError}</p>}
      <div className="marble-race__toolbar">
        <button type="button" onClick={handleToggleFullscreen}>
          {isFullscreen ? '전체화면 종료' : '전체화면'}
        </button>
      </div>
      <div
        className={`marble-race__stage${isFullscreen ? ' marble-race__stage--fullscreen' : ''}`}
        style={fullscreenSize ? { width: fullscreenSize.width, height: fullscreenSize.height } : undefined}
      >
        <canvas
          ref={canvasRef}
          width={VIEWPORT_WIDTH}
          height={VIEWPORT_HEIGHT}
          className="marble-race__canvas"
          style={fullscreenSize ? { width: fullscreenSize.width, height: fullscreenSize.height } : undefined}
        />
        <div className="marble-race__ranking">
          {liveRanking.map((entry) => (
            <div key={entry.rank} className="marble-race__ranking-row">
              <span className="marble-race__ranking-rank">{entry.rank}</span>
              <span className="marble-race__ranking-name">{entry.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
