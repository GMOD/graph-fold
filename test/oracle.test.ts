import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import { foldGraph } from '../src/index.ts'
import { foldGraph as oracleFold } from './oracle/fold.ts'
import { randomGraph } from './random.ts'

import type { FoldOptions, InputNode, InputTrack } from '../src/index.ts'

interface Window {
  nodes: InputNode[]
  tracks: InputTrack[]
  revisited: number
}

const allowances: Record<string, (result: unknown) => unknown> = {}

function allowed(result: unknown) {
  return Object.values(allowances).reduce(
    (shaped, allowance) => allowance(shaped),
    JSON.parse(JSON.stringify(result)),
  )
}

export function firstDifference(a: unknown, b: unknown, path = ''): string {
  const fields = (x: unknown) =>
    x !== null && typeof x === 'object' ? new Map(Object.entries(x)) : undefined
  const left = fields(a)
  const right = fields(b)
  return JSON.stringify(a) === JSON.stringify(b)
    ? ''
    : left !== undefined &&
        right !== undefined &&
        Array.isArray(a) === Array.isArray(b)
      ? ([...new Set([...left.keys(), ...right.keys()])]
          .map(key =>
            firstDifference(left.get(key), right.get(key), `${path}.${key}`),
          )
          .find(found => found !== '') ?? `${path}: keys in another order`)
      : `${path}: ${JSON.stringify(a)?.slice(0, 300)} against ${JSON.stringify(b)?.slice(0, 300)}`
}

function agrees(
  nodes: InputNode[],
  tracks: InputTrack[],
  options: FoldOptions,
) {
  const found = allowed(foldGraph(nodes, tracks, options))
  const expected = allowed(oracleFold(nodes, tracks, options))
  expect(firstDifference(found, expected)).toBe('')
}

const fixtures = [
  'test/fixtures/chr15-92768150-92768700.json',
  'test/fixtures/ecoli-pggb.json',
  'data/chr1-72298000-72349000.json',
  'data/chr16-75204000-75225000.json',
  'data/chr14-34543000-34562000.json',
  'data/chr6-31970000-32050000.json',
  'data/chr1-103550000-103800000.json',
].filter(file => existsSync(file))

const panSN = (name: string | undefined) =>
  name?.split('#', 2).join('#') ?? 'unnamed'

const variants = [50, 236, 1000, 5000].flatMap(threshold =>
  [false, true].flatMap(cluster =>
    (['walk', 'box'] as const).map(inversions => ({
      threshold,
      cluster,
      inversions,
    })),
  ),
)

describe('foldGraph agrees with the 1.2.0 oracle', () => {
  describe.each(fixtures)('%s', file => {
    const window: Window = JSON.parse(readFileSync(file, 'utf8'))
    const named = window.tracks.map(track => ({
      ...track,
      haplotype: panSN(track.name),
    }))
    test.each(variants)(
      'at $threshold bp, cluster $cluster, inversions $inversions',
      options => {
        const withRevisits = { ...options, referenceRevisits: window.revisited }
        agrees(window.nodes, window.tracks, withRevisits)
        agrees(window.nodes, named, withRevisits)
      },
      60_000,
    )
  })

  test('on 3,000 seeded random graphs', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const { nodes, tracks, options } = randomGraph(seed)
      try {
        agrees(nodes, tracks, options)
      } catch (error) {
        throw new Error(`seed ${seed}: ${String(error)}`)
      }
    }
  }, 60_000)
})
