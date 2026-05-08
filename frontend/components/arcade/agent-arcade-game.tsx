'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bot, Gauge, Loader2, Radar, Rocket, Trophy, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useVaraWallet } from '@/hooks/use-vara-wallet'
import {
  hasAgentArcadeProgram,
  loadArcadeLeaderboard,
  submitArcadeScore,
  type ArcadeLeaderboardEntry,
  type SubmitArcadeScoreResult,
} from '@/lib/agent-arcade-chain'

type NodeKind = 'task' | 'integration' | 'spam' | 'bounty'
type GameMode = 'idle' | 'running' | 'ended'

type GameNode = {
  id: number
  kind: NodeKind
  x: number
  y: number
  r: number
  value: number
  dodged?: boolean
}

type RunResult = {
  score: number
  tasksCompleted: number
  threatsDodged: number
  profile: string
}

type Hud = {
  score: number
  energy: number
  timeLeft: number
  combo: number
  tasksCompleted: number
  threatsDodged: number
  mode: GameMode
}

type World = {
  mode: GameMode
  agent: { x: number; y: number; vx: number; vy: number }
  nodes: GameNode[]
  score: number
  energy: number
  timeLeft: number
  combo: number
  tasksCompleted: number
  threatsDodged: number
  nextNodeId: number
  scanUntil: number
  boostUntil: number
  boostReadyAt: number
  lastTs: number
  bestTargetId: number | null
}

const W = 900
const H = 520
const GAME_SECONDS = 60
const START_ENERGY = 100

const nodeSpec: Record<NodeKind, { color: string; glow: string; label: string }> = {
  task: { color: '#78f58f', glow: 'rgba(120,245,143,0.28)', label: 'task' },
  integration: { color: '#59d6ff', glow: 'rgba(89,214,255,0.30)', label: 'api' },
  spam: { color: '#ff5468', glow: 'rgba(255,84,104,0.26)', label: 'spam' },
  bounty: { color: '#ffe05d', glow: 'rgba(255,224,93,0.32)', label: 'bounty' },
}

const initialHud: Hud = {
  score: 0,
  energy: START_ENERGY,
  timeLeft: GAME_SECONDS,
  combo: 1,
  tasksCompleted: 0,
  threatsDodged: 0,
  mode: 'idle',
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function makeNode(id: number): GameNode {
  const roll = Math.random()
  const kind: NodeKind = roll < 0.48
    ? 'task'
    : roll < 0.70
      ? 'integration'
      : roll < 0.88
        ? 'spam'
        : 'bounty'

  const value = kind === 'task' ? 25 : kind === 'integration' ? 55 : kind === 'bounty' ? 120 : -35
  return {
    id,
    kind,
    x: randomBetween(40, W - 40),
    y: randomBetween(40, H - 40),
    r: kind === 'bounty' ? 14 : kind === 'spam' ? 13 : 11,
    value,
  }
}

function createWorld(): World {
  const nodes = Array.from({ length: 34 }, (_, index) => makeNode(index + 1))
  return {
    mode: 'idle',
    agent: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    nodes,
    score: 0,
    energy: START_ENERGY,
    timeLeft: GAME_SECONDS,
    combo: 1,
    tasksCompleted: 0,
    threatsDodged: 0,
    nextNodeId: nodes.length + 1,
    scanUntil: 0,
    boostUntil: 0,
    boostReadyAt: 0,
    lastTs: 0,
    bestTargetId: null,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalize(x: number, y: number) {
  const length = Math.hypot(x, y)
  if (length < 0.001) return { x: 0, y: 0, length: 0 }
  return { x: x / length, y: y / length, length }
}

function classifyRun(result: RunResult) {
  if (result.score >= 1800) return 'Coordination Savant'
  if (result.threatsDodged > result.tasksCompleted * 0.7) return 'Spam Dodger'
  if (result.tasksCompleted >= 35) return 'Task Harvester'
  if (result.score >= 1100) return 'Integration Runner'
  return 'Junior Operator'
}

function findBestTarget(world: World) {
  let best: GameNode | null = null
  let bestWeight = -Infinity

  for (const node of world.nodes) {
    if (node.kind === 'spam') continue
    const distance = Math.hypot(node.x - world.agent.x, node.y - world.agent.y)
    const weight = node.value / Math.max(80, distance)
    if (weight > bestWeight) {
      best = node
      bestWeight = weight
    }
  }

  return best
}

function drawWorld(ctx: CanvasRenderingContext2D, world: World, input: { x: number; y: number }) {
  ctx.clearRect(0, 0, W, H)

  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, '#07100d')
  gradient.addColorStop(0.55, '#0d1117')
  gradient.addColorStop(1, '#08171a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = 'rgba(120,245,143,0.06)'
  ctx.lineWidth = 1
  for (let x = 0; x <= W; x += 36) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 0; y <= H; y += 36) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }

  const now = performance.now()
  const target = world.bestTargetId == null
    ? null
    : world.nodes.find((node) => node.id === world.bestTargetId) ?? null

  if (target && world.scanUntil > now) {
    ctx.save()
    ctx.strokeStyle = 'rgba(89,214,255,0.78)'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.moveTo(world.agent.x, world.agent.y)
    ctx.lineTo(target.x, target.y)
    ctx.stroke()
    ctx.restore()
  }

  for (const node of world.nodes) {
    const spec = nodeSpec[node.kind]
    ctx.save()
    ctx.shadowColor = spec.color
    ctx.shadowBlur = node.kind === 'bounty' ? 20 : 12
    ctx.fillStyle = spec.glow
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.r + 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = spec.color
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = node.kind === 'bounty' ? '#141000' : '#06100c'
    ctx.font = '10px Geist Mono, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(spec.label.slice(0, 1).toUpperCase(), node.x, node.y + 0.5)
    ctx.restore()
  }

  if (world.scanUntil > now) {
    const pulse = 1 + (world.scanUntil - now) / 1600
    ctx.strokeStyle = 'rgba(89,214,255,0.18)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(world.agent.x, world.agent.y, 90 * pulse, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.save()
  const isBoosting = world.boostUntil > now
  ctx.translate(world.agent.x, world.agent.y)
  const angle = Math.atan2(world.agent.vy + input.y * 0.4, world.agent.vx + input.x * 0.4)
  ctx.rotate(Number.isFinite(angle) ? angle : 0)
  ctx.shadowColor = isBoosting ? '#ffe05d' : '#78f58f'
  ctx.shadowBlur = isBoosting ? 24 : 16
  ctx.fillStyle = isBoosting ? '#ffe05d' : '#78f58f'
  ctx.beginPath()
  ctx.moveTo(18, 0)
  ctx.lineTo(-12, -12)
  ctx.lineTo(-6, 0)
  ctx.lineTo(-12, 12)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '12px Geist Mono, monospace'
  ctx.fillText('operator intent', 18, H - 20)
  ctx.strokeStyle = 'rgba(120,245,143,0.55)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(142, H - 24)
  ctx.lineTo(142 + input.x * 42, H - 24 + input.y * 42)
  ctx.stroke()
}

function updateWorld(world: World, input: { x: number; y: number }, dt: number) {
  if (world.mode !== 'running') return

  const now = performance.now()
  world.timeLeft = Math.max(0, world.timeLeft - dt)
  if (world.timeLeft <= 0 || world.energy <= 0) {
    world.mode = 'ended'
    return
  }

  const target = findBestTarget(world)
  world.bestTargetId = target?.id ?? null

  let ax = input.x * 620
  let ay = input.y * 620
  if (target) {
    const toTarget = normalize(target.x - world.agent.x, target.y - world.agent.y)
    const autonomy = input.x === 0 && input.y === 0 ? 520 : 260
    ax += toTarget.x * autonomy
    ay += toTarget.y * autonomy
  }

  for (const node of world.nodes) {
    if (node.kind !== 'spam') continue
    const dx = world.agent.x - node.x
    const dy = world.agent.y - node.y
    const distance = Math.hypot(dx, dy)
    if (distance < 92 && distance > 0.001) {
      ax += (dx / distance) * (880 / Math.max(18, distance))
      ay += (dy / distance) * (880 / Math.max(18, distance))
    }
    if (distance < 54 && !node.dodged) {
      node.dodged = true
      world.threatsDodged += 1
      world.score += 3 * world.combo
    }
  }

  const boost = world.boostUntil > now ? 1.85 : 1
  world.agent.vx = (world.agent.vx + ax * dt) * 0.88
  world.agent.vy = (world.agent.vy + ay * dt) * 0.88
  const speed = normalize(world.agent.vx, world.agent.vy)
  const maxSpeed = 235 * boost
  if (speed.length > maxSpeed) {
    world.agent.vx = speed.x * maxSpeed
    world.agent.vy = speed.y * maxSpeed
  }

  world.agent.x = clamp(world.agent.x + world.agent.vx * dt, 22, W - 22)
  world.agent.y = clamp(world.agent.y + world.agent.vy * dt, 22, H - 22)

  for (let index = world.nodes.length - 1; index >= 0; index -= 1) {
    const node = world.nodes[index]
    const distance = Math.hypot(node.x - world.agent.x, node.y - world.agent.y)
    if (distance > node.r + 15) continue

    if (node.kind === 'spam') {
      world.energy = Math.max(0, world.energy - 18)
      world.combo = 1
      world.score = Math.max(0, world.score - 25)
    } else {
      const multiplier = node.kind === 'integration' || node.kind === 'bounty'
        ? Math.min(5, world.combo + 1)
        : world.combo
      world.score += node.value * multiplier
      world.combo = multiplier
      world.tasksCompleted += node.kind === 'bounty' ? 2 : 1
      world.energy = Math.min(START_ENERGY, world.energy + (node.kind === 'bounty' ? 8 : 3))
    }

    world.nodes.splice(index, 1, makeNode(world.nextNodeId))
    world.nextNodeId += 1
  }
}

export function AgentArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const worldRef = useRef<World>(createWorld())
  const inputRef = useRef({ x: 0, y: 0 })
  const keysRef = useRef(new Set<string>())
  const frameRef = useRef<number | null>(null)
  const [hud, setHud] = useState<Hud>(initialHud)
  const [lastRun, setLastRun] = useState<RunResult | null>(null)
  const [leaders, setLeaders] = useState<ArcadeLeaderboardEntry[]>([])
  const [submitResult, setSubmitResult] = useState<SubmitArcadeScoreResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [chainError, setChainError] = useState<string | null>(null)
  const { account, status, connect } = useVaraWallet()
  const chainReady = hasAgentArcadeProgram()

  const localLeaders = useMemo(() => {
    const base = lastRun
      ? [{ rank: 1, player: 'local-operator', bestScore: lastRun.score, tasksCompleted: lastRun.tasksCompleted, threatsDodged: lastRun.threatsDodged, runId: 'local', updatedAt: '' }]
      : []
    return chainReady ? leaders : base
  }, [chainReady, lastRun, leaders])

  const refreshLeaderboard = useCallback(async () => {
    if (!chainReady) return
    try {
      setLeaders(await loadArcadeLeaderboard(8))
    } catch (error) {
      setChainError(error instanceof Error ? error.message : 'Could not load leaderboard')
    }
  }, [chainReady])

  useEffect(() => {
    void refreshLeaderboard()
  }, [refreshLeaderboard])

  const syncInputFromKeys = useCallback(() => {
    const keys = keysRef.current
    const x = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0)
    const y = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0)
    const direction = normalize(x, y)
    inputRef.current = { x: direction.x, y: direction.y }
  }, [])

  const endRun = useCallback(() => {
    const world = worldRef.current
    const result = {
      score: Math.floor(world.score),
      tasksCompleted: world.tasksCompleted,
      threatsDodged: world.threatsDodged,
      profile: '',
    }
    result.profile = classifyRun(result)
    setLastRun(result)
    setHud((current) => ({ ...current, mode: 'ended' }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    const tick = (ts: number) => {
      const world = worldRef.current
      if (!world.lastTs) world.lastTs = ts
      const dt = Math.min(0.033, (ts - world.lastTs) / 1000)
      world.lastTs = ts

      updateWorld(world, inputRef.current, dt)
      drawWorld(ctx, world, inputRef.current)

      setHud({
        score: Math.floor(world.score),
        energy: Math.ceil(world.energy),
        timeLeft: Math.ceil(world.timeLeft),
        combo: world.combo,
        tasksCompleted: world.tasksCompleted,
        threatsDodged: world.threatsDodged,
        mode: world.mode,
      })

      if (world.mode === 'ended' && hud.mode === 'running') {
        endRun()
      }

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [endRun, hud.mode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key)) {
        event.preventDefault()
      }
      if (key === ' ') {
        scan()
        return
      }
      if (key === 'shift') {
        boost()
        return
      }
      keysRef.current.add(key)
      syncInputFromKeys()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase())
      syncInputFromKeys()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [syncInputFromKeys])

  const startRun = () => {
    const world = createWorld()
    world.mode = 'running'
    worldRef.current = world
    keysRef.current.clear()
    inputRef.current = { x: 0, y: 0 }
    setLastRun(null)
    setSubmitResult(null)
    setChainError(null)
    setHud({ ...initialHud, mode: 'running' })
  }

  const scan = () => {
    const world = worldRef.current
    if (world.mode !== 'running') return
    world.scanUntil = performance.now() + 1600
    world.bestTargetId = findBestTarget(world)?.id ?? null
  }

  const boost = () => {
    const world = worldRef.current
    const now = performance.now()
    if (world.mode !== 'running' || now < world.boostReadyAt || world.energy < 12) return
    world.boostUntil = now + 850
    world.boostReadyAt = now + 3200
    world.energy -= 8
  }

  const holdDirection = (x: number, y: number) => {
    inputRef.current = normalize(x, y)
  }

  const clearDirection = () => {
    inputRef.current = { x: 0, y: 0 }
  }

  const submitScore = async () => {
    if (!lastRun) return
    if (!account) {
      await connect()
      return
    }
    setSubmitting(true)
    setChainError(null)
    try {
      const result = await submitArcadeScore(
        account,
        lastRun.score,
        lastRun.tasksCompleted,
        lastRun.threatsDodged,
      )
      setSubmitResult(result)
      await refreshLeaderboard()
    } catch (error) {
      setChainError(error instanceof Error ? error.message : 'Score submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-5 py-7 sm:px-6 lg:px-7">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-primary/35 bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Agent Arcade</h1>
                <p className="text-sm text-muted-foreground">Intent-driven routing game for autonomous agents.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startRun}
                className="neon-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                <Rocket className="h-4 w-4" />
                {hud.mode === 'running' ? 'Restart' : 'Start Run'}
              </button>
              <button
                type="button"
                onClick={scan}
                disabled={hud.mode !== 'running'}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Radar className="h-4 w-4 text-accent" />
                Scan
              </button>
              <button
                type="button"
                onClick={boost}
                disabled={hud.mode !== 'running'}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Gauge className="h-4 w-4 text-primary" />
                Boost
              </button>
            </div>
          </div>

          <div className="grid gap-3 border-b border-border bg-background/50 px-4 py-3 sm:grid-cols-5">
            {[
              ['Score', hud.score],
              ['Energy', `${hud.energy}%`],
              ['Time', `${hud.timeLeft}s`],
              ['Tasks', hud.tasksCompleted],
              ['Dodges', hud.threatsDodged],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-card/70 px-3 py-2">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</div>
              </div>
            ))}
          </div>

          <div className="relative bg-black">
            <canvas
              ref={canvasRef}
              className="block aspect-[90/52] w-full bg-black"
              aria-label="Agent Arcade game canvas"
            />
            {hud.mode !== 'running' && (
              <div className="absolute inset-0 grid place-items-center bg-background/45 p-5 backdrop-blur-sm">
                <div className="max-w-md rounded-lg border border-border bg-card/95 p-5 text-center shadow-2xl">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-primary/35 bg-primary/10 text-primary">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-foreground">
                    {lastRun ? 'Run complete' : 'Agent ready'}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Chase useful work, preserve energy, and turn the cleanest route into a public score.
                  </p>
                  {lastRun && (
                    <div className="mt-4 rounded-lg border border-border bg-background p-3 text-left">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Agent profile</span>
                        <span className="font-mono text-sm text-primary">{lastRun.profile}</span>
                      </div>
                      <div className="mt-2 font-mono text-2xl font-semibold text-foreground">{lastRun.score}</div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={startRun}
                    className="neon-btn mt-5 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold"
                  >
                    {lastRun ? 'Run Again' : 'Start Run'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent/35 bg-accent/10 text-accent">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">On-chain score</h2>
                <p className="text-sm text-muted-foreground">{chainReady ? 'Global board active' : 'Local practice mode'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void submitScore()}
              disabled={!lastRun || submitting || !chainReady}
              className={cn(
                'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors',
                lastRun && chainReady
                  ? 'neon-btn'
                  : 'cursor-not-allowed border border-border bg-background text-muted-foreground',
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                Submit Run
              </button>

              {!chainReady && (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Global scoring unlocks after the arcade contract is live.
                </p>
              )}
            {status !== 'connected' && chainReady && (
              <button
                type="button"
                onClick={() => void connect()}
                className="mt-3 w-full rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-primary/40"
              >
                Connect wallet
              </button>
            )}
            {submitResult && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                Run #{submitResult.runId || 'confirmed'} {submitResult.improved ? 'improved' : 'kept'} your best score:
                {' '}<span className="font-mono text-primary">{submitResult.currentBest}</span>
              </div>
            )}
            {chainError && (
              <div className="mt-3 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
                {chainError}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Trophy className="h-4 w-4 text-primary" />
              Leaderboard
            </h2>
            <div className="mt-4 space-y-2">
              {localLeaders.length === 0 && (
                  <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  No scores yet.
                  </div>
                )}
              {localLeaders.map((entry, index) => (
                <div key={`${entry.player}-${entry.runId}-${index}`} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 font-mono text-sm text-primary">
                    {entry.rank || index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm font-semibold text-foreground">{entry.bestScore}</div>
                    <div className="truncate text-xs text-muted-foreground">{entry.player}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{entry.tasksCompleted} tasks</div>
                    <div>{entry.threatsDodged} dodges</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Intent Pad</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <span />
              <ControlButton label="Up" onDown={() => holdDirection(0, -1)} onUp={clearDirection}>
                <ArrowUp className="h-4 w-4" />
              </ControlButton>
              <span />
              <ControlButton label="Left" onDown={() => holdDirection(-1, 0)} onUp={clearDirection}>
                <ArrowLeft className="h-4 w-4" />
              </ControlButton>
              <ControlButton label="Down" onDown={() => holdDirection(0, 1)} onUp={clearDirection}>
                <ArrowDown className="h-4 w-4" />
              </ControlButton>
              <ControlButton label="Right" onDown={() => holdDirection(1, 0)} onUp={clearDirection}>
                <ArrowRight className="h-4 w-4" />
              </ControlButton>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={scan} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                Scan
              </button>
              <button type="button" onClick={boost} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                Boost
              </button>
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

function ControlButton({
  children,
  label,
  onDown,
  onUp,
}: {
  children: ReactNode
  label: string
  onDown: () => void
  onUp: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      className="grid h-11 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {children}
    </button>
  )
}
