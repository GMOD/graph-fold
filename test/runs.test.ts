import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
  foldGraph,
  foldProblems,
  foldRuns,
  foldRunsProblems,
} from '../src/index.ts'
import { firstDifference, sortedKeys } from './compare.ts'
import { randomEnds, randomGraph } from './random.ts'
import { stepsToRuns } from './steps-to-runs.ts'

import type {
  FoldOptions,
  InputNode,
  InputTrack,
  RunsInput,
} from '../src/index.ts'
import type { RandomEnds } from './random.ts'

function outsideIdentity(result: unknown) {
  const { members: _, ...rest } = JSON.parse(JSON.stringify(result))
  return sortedKeys(rest)
}

function referenceMembers(
  members: Record<string, string[]>,
  reference: Set<string>,
) {
  return Object.fromEntries(
    Object.entries(members).map(([node, held]) => [
      node,
      held.filter(name => reference.has(name)),
    ]),
  )
}

function agrees(
  nodes: InputNode[],
  tracks: InputTrack[],
  options: FoldOptions,
  ends?: RandomEnds,
) {
  const reference = options.reference ?? 0
  const { input, tracks: ordered } = stepsToRuns(nodes, tracks, reference)
  const { reference: _, ...rest } = options
  const withReference = (table: RandomEnds['before']) => ({
    kinds: ['nowhere' as const, ...table.kinds],
    pos: [0, ...Array.from(table.pos)],
    reversed: [0, ...Array.from(table.reversed)],
    ownBp: [0, ...Array.from(table.ownBp)],
    missingBp: [0, ...Array.from(table.missingBp)],
  })
  const steps = foldGraph(nodes, ordered, {
    ...rest,
    reference: 0,
    ...(ends === undefined
      ? {}
      : {
          ends: {
            before: withReference(ends.before),
            after: withReference(ends.after),
          },
        }),
  })
  const runs = foldRuns(ends === undefined ? input : { ...input, ends }, rest)
  if (runs.folded || steps.folded) {
    expect(firstDifference(outsideIdentity(runs), outsideIdentity(steps))).toBe(
      '',
    )
    const named = new Set(input.reference.nodes.map(node => node.name))
    expect(
      firstDifference(runs.members, referenceMembers(steps.members, named)),
    ).toBe('')
  } else {
    expect([runs.reason, runs.haplotypes]).toEqual([
      steps.reason,
      steps.haplotypes,
    ])
  }
  expect(foldRunsProblems(input, runs)).toEqual(
    foldProblems(nodes, ordered, steps),
  )
  return { input, runs }
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

describe('foldRuns equals foldGraph on the same walks read as runs', () => {
  test.each(fixtures)(
    '%s at 50, 236, 1000 and 5000 bp, clustered or not, boxed or not',
    file => {
      const window: {
        nodes: InputNode[]
        tracks: InputTrack[]
        revisited: number
      } = JSON.parse(readFileSync(file, 'utf8'))
      for (const threshold of [50, 236, 1000, 5000]) {
        for (const cluster of [false, true]) {
          for (const inversions of ['walk', 'box'] as const) {
            agrees(window.nodes, window.tracks, {
              threshold,
              cluster,
              inversions,
              referenceRevisits: window.revisited,
            })
          }
        }
      }
    },
    120_000,
  )

  test('on 3,000 seeded random graphs, each walk read back as runs', () => {
    let compared = 0
    for (let seed = 1; seed <= 3000; seed++) {
      const { nodes, tracks, options } = randomGraph(seed, true)
      const known = new Set(nodes.map(node => node.name))
      const readable = tracks.every(track =>
        track.sequence.every(step => known.has(step.replace(/^-/, ''))),
      )
      const reference = tracks[options.reference ?? 0]!.sequence
      const lengths = new Map(nodes.map(n => [n.name, n.sequenceLength]))
      const placed = reference.every(
        step => (lengths.get(step.replace(/^-/, '')) ?? 0) > 0,
      )
      if (readable && placed) {
        const start = tracks[options.reference ?? 0]!.indexOfFirstBase ?? 0
        const ends = randomEnds(seed, tracks.length - 1, start, start + 5000)
        try {
          agrees(nodes, tracks, options)
          agrees(nodes, tracks, options, ends)
        } catch (error) {
          throw new Error(`seed ${seed}: ${String(error)}`, { cause: error })
        }
        compared += 1
      }
    }
    expect(compared).toBeGreaterThan(2000)
  }, 60_000)
})

describe('a broken reading of the runs fails the equality', () => {
  const window: {
    nodes: InputNode[]
    tracks: InputTrack[]
    revisited: number
  } = JSON.parse(
    readFileSync('test/fixtures/chr15-92768150-92768700.json', 'utf8'),
  )
  const { input, tracks } = stepsToRuns(window.nodes, window.tracks, 0)
  const steps = outsideIdentity(
    foldGraph(window.nodes, tracks, { threshold: 50 }),
  )
  const differs = (broken: RunsInput) =>
    firstDifference(
      outsideIdentity(foldRuns(broken, { threshold: 50 })),
      steps,
    ) !== ''
  const inner = Array.from(input.stretches.offBefore).findIndex(bp => bp >= 50)

  test('unbroken, it agrees', () => {
    expect(differs(input)).toBe(false)
    expect(inner).toBeGreaterThan(0)
  })

  test('a run off the reference 1 bp longer', () => {
    const offBefore = Array.from(input.stretches.offBefore)
    offBefore[inner]! += 1
    expect(
      differs({ ...input, stretches: { ...input.stretches, offBefore } }),
    ).toBe(true)
  })

  test('a stretch walked the other way', () => {
    const against = Array.from(input.stretches.against)
    against[inner] = 1 - against[inner]!
    expect(
      differs({ ...input, stretches: { ...input.stretches, against } }),
    ).toBe(true)
  })

  test('a run off the reference dropped', () => {
    const offBefore = Array.from(input.stretches.offBefore)
    offBefore[inner] = 0
    expect(
      differs({ ...input, stretches: { ...input.stretches, offBefore } }),
    ).toBe(true)
  })
})

describe('runs the fold cannot read are refused, with the reason', () => {
  const input: RunsInput = {
    reference: {
      track: { name: 'ref' },
      nodes: [
        { name: 'a', sequenceLength: 100 },
        { name: 'b', sequenceLength: 10 },
        { name: 'c', sequenceLength: 100 },
      ],
      starts: [1000, 1100, 1110],
    },
    tracks: [{ name: 'hap1' }],
    offsets: [0, 2],
    stretches: {
      starts: [1000, 1110],
      bp: [100, 100],
      against: [0, 0],
      offBefore: [0, 12],
    },
    leadBp: [0],
    tailBp: [0],
  }
  const reason = (broken: RunsInput) => {
    const result = foldRuns(broken)
    return result.folded ? undefined : result.reason
  }

  test('readable runs fold', () => {
    const result = foldRuns(input, { threshold: 10 })
    expect(result.folded).toBe(true)
    expect(foldRunsProblems(input, result)).toEqual([])
  })

  test('a stretch that does not start and end on reference nodes', () => {
    expect(
      reason({
        ...input,
        stretches: { ...input.stretches, bp: [100, 99] },
      }),
    ).toBe(
      "hap1 has a stretch of 99 bp at 1110 that does not start and end on the reference's nodes",
    )
  })

  test('own bp before the first stretch given outside leadBp', () => {
    expect(
      reason({
        ...input,
        stretches: { ...input.stretches, offBefore: [5, 12] },
      }),
    ).toBe('hap1 has 5 bp before its first stretch outside leadBp')
  })

  test('a reference node of no bp', () => {
    expect(
      reason({
        ...input,
        reference: {
          ...input.reference,
          nodes: [
            { name: 'a', sequenceLength: 100 },
            { name: 'b', sequenceLength: 0 },
            { name: 'c', sequenceLength: 110 },
          ],
        },
      }),
    ).toBe(
      'reference node b has no bp, so no stretch can say whether it holds it',
    )
  })

  test('tables of the wrong length', () => {
    expect(reason({ ...input, leadBp: [] })).toBe(
      'the input has 0 leadBp for 1',
    )
  })

  test('a reference whose nodes leave a gap, or that starts where its first node does not', () => {
    expect(
      reason({
        ...input,
        reference: { ...input.reference, starts: [1000, 1100, 1111] },
      }),
    ).toBe('reference node b ends at 1110 and the next starts at 1111')
    expect(
      reason({
        ...input,
        reference: {
          ...input.reference,
          track: { name: 'ref', indexOfFirstBase: 0 },
        },
      }),
    ).toBe('the reference track starts at 0 and its first node at 1000')
  })

  test('positions are the reference starts when its track gives none', () => {
    const result = foldRuns(input, { threshold: 10 })
    expect(result.branches.map(b => [b.refStart, b.refEnd])).toEqual([
      [1100, 1110],
    ])
  })

  test('a threshold under 1 bp', () => {
    expect(reason({ ...input })).toBeUndefined()
    const result = foldRuns(input, { threshold: 0 })
    expect(result.folded ? undefined : result.reason).toBe(
      'the threshold is 0 bp, and a fold needs 1 bp or more',
    )
  })

  test('a reference that passes a node twice', () => {
    expect(
      reason({
        ...input,
        reference: {
          ...input.reference,
          nodes: [
            { name: 'a', sequenceLength: 100 },
            { name: 'b', sequenceLength: 10 },
            { name: 'a', sequenceLength: 100 },
          ],
        },
      }),
    ).toMatch(/^the reference passes 1 nodes of this window more than once/)
    expect(foldRuns(input, { referenceRevisits: 2 }).folded).toBe(false)
  })
})

describe('a walk with no stretch on the reference', () => {
  test('is one node of its own bp, named by the walk, as foldGraph draws it', () => {
    const input: RunsInput = {
      reference: {
        track: { name: 'ref' },
        nodes: [
          { name: 'a', sequenceLength: 100 },
          { name: 'b', sequenceLength: 100 },
        ],
        starts: [0, 100],
      },
      tracks: [{ name: 'hap1' }, { name: 'hap2' }, { name: 'hap3' }],
      offsets: [0, 2, 2, 2],
      stretches: {
        starts: [0, 100],
        bp: [100, 100],
        against: [0, 0],
        offBefore: [0, 5000],
      },
      leadBp: [0, 5000, 3000],
      tailBp: [0, 0, 2000],
    }
    const result = foldRuns(input, { threshold: 50 })
    expect(foldRunsProblems(input, result)).toEqual([])
    if (!result.folded) {
      throw new Error(result.reason)
    }
    expect(result.tracks.map(track => track.sequence.join(' '))).toEqual([
      'a b',
      'a ins:a:5000 b',
      'off:2:5000',
      'off:3:5000',
    ])
    expect(result.members['off:2:5000']).toEqual([])
    expect(result.walks.slice(2).map(walk => walk.steps)).toEqual([[], []])
  })
})

describe('stretches split into single nodes fold the same', () => {
  test('on 3,000 seeded random graphs, with ends', () => {
    let compared = 0
    for (let seed = 1; seed <= 3000; seed++) {
      const { nodes, tracks, options } = randomGraph(seed, true)
      const known = new Set(nodes.map(node => node.name))
      const readable = tracks.every(track =>
        track.sequence.every(step => known.has(step.replace(/^-/, ''))),
      )
      if (readable) {
        const { input } = stepsToRuns(nodes, tracks, options.reference ?? 0)
        const start = input.reference.starts[0] ?? 0
        const ends = randomEnds(seed, input.tracks.length, start, start + 5000)
        const { reference: _, ...rest } = options
        const starts: number[] = []
        const bp: number[] = []
        const against: number[] = []
        const offBefore: number[] = []
        const offsets = [0]
        const nodeStarts = Array.from(input.reference.starts)
        const lengths = input.reference.nodes.map(n => n.sequenceLength)
        input.tracks.forEach((_track, t) => {
          for (let k = input.offsets[t]!; k < input.offsets[t + 1]!; k++) {
            const from = nodeStarts.indexOf(input.stretches.starts[k]!)
            let covered = 0
            const nodesIn: number[] = []
            for (let i = from; covered < input.stretches.bp[k]!; i++) {
              nodesIn.push(i)
              covered += lengths[i]!
            }
            const reversed = input.stretches.against[k] !== 0
            const walked = reversed ? nodesIn.reverse() : nodesIn
            walked.forEach((i, j) => {
              starts.push(nodeStarts[i]!)
              bp.push(lengths[i]!)
              against.push(Number(reversed))
              offBefore.push(j === 0 ? input.stretches.offBefore[k]! : 0)
            })
          }
          offsets.push(starts.length)
        })
        const split: RunsInput = {
          ...input,
          offsets,
          stretches: { starts, bp, against, offBefore },
        }
        try {
          expect(
            firstDifference(
              foldRuns({ ...split, ends }, rest),
              foldRuns({ ...input, ends }, rest),
            ),
          ).toBe('')
        } catch (error) {
          throw new Error(`seed ${seed}: ${String(error)}`, { cause: error })
        }
        compared += 1
      }
    }
    expect(compared).toBeGreaterThan(2500)
  }, 60_000)
})
