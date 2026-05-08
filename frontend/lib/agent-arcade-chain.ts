'use client'

import { env } from '@/lib/env'
import { getGearApi, type WalletAccount } from '@/lib/vara-program'

export type ArcadeLeaderboardEntry = {
  rank: number
  player: string
  bestScore: number
  tasksCompleted: number
  threatsDodged: number
  runId: string
  updatedAt: string
}

export type SubmitArcadeScoreResult = {
  runId: string
  accepted: boolean
  improved: boolean
  previousBest: number
  currentBest: number
  rank: number | null
}

const IDL_PATH = '/idl/agent_arcade_client.idl'

let idlPromise: Promise<string> | null = null
let sailsPromise: Promise<any> | null = null

export function hasAgentArcadeProgram() {
  return /^0x[0-9a-fA-F]{64}$/.test(env.agentArcadeProgramId)
}

async function loadIdl() {
  if (!idlPromise) {
    idlPromise = fetch(IDL_PATH, { cache: 'force-cache' }).then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load Agent Arcade IDL from ${IDL_PATH}`)
      return res.text()
    })
  }

  return idlPromise
}

async function getSigner(account: WalletAccount) {
  const { web3FromSource } = await import('@polkadot/extension-dapp')
  const injector = await web3FromSource(account.source)
  return injector.signer
}

async function getAgentArcadeClient() {
  if (!hasAgentArcadeProgram()) {
    throw new Error('NEXT_PUBLIC_AGENT_ARCADE_PROGRAM_ID is not set to a deployed program id.')
  }

  if (!sailsPromise) {
    sailsPromise = (async () => {
      const [{ Sails }, { SailsIdlParser }, api, idl] = await Promise.all([
        import('sails-js'),
        import('sails-js-parser'),
        getGearApi(),
        loadIdl(),
      ])
      const parser = await SailsIdlParser.new()
      const sails = new Sails(parser)

      sails.parseIdl(idl)
      sails.setApi(api)
      sails.setProgramId(env.agentArcadeProgramId as `0x${string}`)
      return sails
    })()
  }

  return sailsPromise
}

function unwrapSailsResult<T>(value: any): T {
  if (value && typeof value === 'object') {
    const ok = value.ok ?? value.Ok
    if (ok !== undefined) return ok as T

    const error = value.err ?? value.Err
    if (error !== undefined) {
      throw new Error(`Agent Arcade contract error: ${JSON.stringify(error)}`)
    }
  }

  return value as T
}

function formatActorId(value: unknown) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return `0x${value.map((byte) => Number(byte).toString(16).padStart(2, '0')).join('')}`
  }
  return String(value ?? '')
}

export async function loadArcadeLeaderboard(limit = 10): Promise<ArcadeLeaderboardEntry[]> {
  const sails = await getAgentArcadeClient()
  const result = unwrapSailsResult<any[]>(
    await sails.services.AgentArcade.queries.Leaderboard(limit).call(),
  )
  const entries = Array.isArray(result) ? result : []

  return entries.map((entry: any) => ({
    rank: Number(entry.rank ?? 0),
    player: formatActorId(entry.player),
    bestScore: Number(entry.best_score ?? entry.bestScore ?? 0),
    tasksCompleted: Number(entry.tasks_completed ?? entry.tasksCompleted ?? 0),
    threatsDodged: Number(entry.threats_dodged ?? entry.threatsDodged ?? 0),
    runId: String(entry.run_id ?? entry.runId ?? ''),
    updatedAt: String(entry.updated_at ?? entry.updatedAt ?? ''),
  }))
}

export async function submitArcadeScore(
  account: WalletAccount,
  score: number,
  tasksCompleted: number,
  threatsDodged: number,
): Promise<SubmitArcadeScoreResult> {
  const sails = await getAgentArcadeClient()
  const signer = await getSigner(account)
  const tx = sails.services.AgentArcade.functions.SubmitScore(
    Math.max(0, Math.floor(score)),
    Math.max(0, Math.floor(tasksCompleted)),
    Math.max(0, Math.floor(threatsDodged)),
  )

  tx.withAccount(account.address, { signer })
  await tx.calculateGas()
  const result = await tx.signAndSend()
  const response = await result.response()
  const payload = unwrapSailsResult<any>(response?.result ?? response)

  return {
    runId: String(payload?.run_id ?? payload?.runId ?? ''),
    accepted: Boolean(payload?.accepted),
    improved: Boolean(payload?.improved),
    previousBest: Number(payload?.previous_best ?? payload?.previousBest ?? 0),
    currentBest: Number(payload?.current_best ?? payload?.currentBest ?? 0),
    rank: payload?.rank == null ? null : Number(payload.rank),
  }
}
