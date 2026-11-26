import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import { foldGraph } from '../src/index.ts'
import { firstDifference } from './compare.ts'
import { foldGraph as oracleFold } from './oracle/fold.ts'
import { randomEnds, randomGraph } from './random.ts'

import type {
  FoldOptions,
  InputNode,
  InputTrack,
  WalkEnds,
} from '../src/index.ts'
import type { RandomEnds } from './random.ts'

interface Window {
  nodes: InputNode[]
  tracks: InputTrack[]
  revisited: number
}

interface Graph {
  nodes: InputNode[]
  tracks: InputTrack[]
  options: FoldOptions
}

interface Allowance {
  oracleInput?: (graph: Graph) => Graph
  results?: (found: Shape, expected: Shape) => [Shape, Shape]
}

interface Shape {
  folded: boolean
  members?: Record<string, string[]>
  tracks: { sequence: string[]; variation?: { walks?: number } }[]
}

const nameOf = (step: string) => step.replace(/^-/, '')

const allowances: Record<string, Allowance> = {
  "the distinct-walk count is dropped from each track's variation": {
    results: (found, expected) => [
      found,
      {
        ...expected,
        tracks: expected.tracks.map(({ variation, ...track }) => {
          const { walks: _, ...rest } = variation ?? {}
          return variation === undefined ? track : { ...track, variation: rest }
        }),
      },
    ],
  },
  "a walk with no step on the reference is one node of its own bp, off:<walk>:<bp>, which the oracle is given in its place, so such walks share no track even where their steps are the same, a walk of 0 bp off the reference steps nothing, and that node holds the walk's nodes and not the stand-in":
    {
      oracleInput: ({ nodes, tracks, options }) => {
        const lengths = new Map(
          nodes.map(n => [n.name, n.sequenceLength ?? n.seq?.length ?? 0]),
        )
        const reference = new Set(
          tracks[options.reference ?? 0]?.sequence.map(nameOf),
        )
        const standIns: InputNode[] = []
        const rewritten = tracks.map((track, index) => {
          const bp = track.sequence.reduce(
            (sum, step) => sum + (lengths.get(nameOf(step)) ?? 0),
            0,
          )
          const off =
            index !== (options.reference ?? 0) &&
            track.sequence.every(step => !reference.has(nameOf(step)))
          const name = `off:${index}:${bp}`
          if (off && bp > 0) {
            standIns.push({ name, sequenceLength: bp })
          }
          return off ? { ...track, sequence: bp > 0 ? [name] : [] } : track
        })
        return { nodes: [...nodes, ...standIns], tracks: rewritten, options }
      },
      results: (found, expected) => {
        const standIn = (members: Record<string, string[]> | undefined) =>
          Object.fromEntries(
            Object.entries(members ?? {}).map(([node, held]) => [
              node,
              node.startsWith('off:') ? [] : held,
            ]),
          )
        return found.folded
          ? [
              { ...found, members: standIn(found.members) },
              { ...expected, members: standIn(expected.members) },
            ]
          : [found, expected]
      },
    },
}

function agrees(
  nodes: InputNode[],
  tracks: InputTrack[],
  options: FoldOptions,
  ends?: WalkEnds,
) {
  const given = { nodes, tracks, options }
  const original: Shape = JSON.parse(
    JSON.stringify(oracleFold(nodes, tracks, options)),
  )
  const oracleInput = original.folded
    ? Object.values(allowances).reduce(
        (graph, allowance) => allowance.oracleInput?.(graph) ?? graph,
        given,
      )
    : given
  const plain: [Shape, Shape] = [
    JSON.parse(
      JSON.stringify(
        foldGraph(nodes, tracks, {
          ...options,
          ...(ends === undefined ? {} : { ends }),
        }),
      ),
    ),
    original.folded
      ? JSON.parse(
          JSON.stringify(
            oracleFold(
              oracleInput.nodes,
              oracleInput.tracks,
              oracleInput.options,
            ),
          ),
        )
      : original,
  ]
  const [found, expected] = Object.values(allowances).reduce(
    (pair, allowance) => allowance.results?.(pair[0], pair[1]) ?? pair,
    plain,
  )
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
        throw new Error(`seed ${seed}: ${String(error)}`, { cause: error })
      }
    }
  }, 60_000)

  test('on 3,000 seeded random graphs given every end as nowhere, where no inversion is open', () => {
    let compared = 0
    for (let seed = 1; seed <= 3000; seed++) {
      const { nodes, tracks, options } = randomGraph(seed)
      const ends = randomEnds(seed, tracks.length, 0, 100_000)
      const unread = (table: RandomEnds['before']) => ({
        ...table,
        kinds: table.kinds.map(() => 'nowhere' as const),
      })
      const openInversion = oracleFold(nodes, tracks, options).branches.some(
        branch => branch.kind === 'inversion' && branch.open === true,
      )
      if (!openInversion) {
        try {
          agrees(nodes, tracks, options, {
            before: unread(ends.before),
            after: unread(ends.after),
          })
        } catch (error) {
          throw new Error(`seed ${seed}: ${String(error)}`, { cause: error })
        }
        compared += 1
      }
    }
    expect(compared).toBeGreaterThan(1500)
  }, 60_000)
})
