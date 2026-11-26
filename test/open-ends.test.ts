import { describe, expect, test } from 'vitest'

import {
  END_KINDS,
  branchLabel,
  foldGraph,
  foldProblems,
} from '../src/index.ts'
import { seeded } from './random.ts'

import type {
  Branch,
  EndKind,
  EndTable,
  FoldOptions,
  InputNode,
  InputTrack,
} from '../src/index.ts'

interface End {
  kind: EndKind
  pos: number
  reversed?: boolean
  ownBp?: number
  missingBp?: number
}

const lengths = { a: 1000, b: 1000, c: 1000, d: 1000, x: 500, y: 5 }
const nodes: InputNode[] = Object.entries(lengths).map(
  ([name, sequenceLength]) => ({ name, sequenceLength }),
)
const reference: InputTrack = {
  name: 'ref',
  sequence: ['a', 'b', 'c', 'd'],
  indexOfFirstBase: 10_000,
}

function table(ends: (End | undefined)[]) {
  const result: EndTable = {
    kinds: ends.map(end => end?.kind ?? 'nowhere'),
    pos: ends.map(end => end?.pos ?? Number.NaN),
    reversed: ends.map(end => Number(end?.reversed ?? false)),
    ownBp: ends.map(end => end?.ownBp ?? 0),
    missingBp: ends.map(end => end?.missingBp ?? 0),
  }
  return result
}

function foldEnds(
  walks: { sequence: string; before?: End; after?: End }[],
  options: FoldOptions = {},
) {
  const tracks = [
    reference,
    ...walks.map((walk, i) => ({
      name: `hap${i + 1}`,
      sequence: walk.sequence.split(' '),
    })),
  ]
  const ends = {
    before: table([undefined, ...walks.map(walk => walk.before)]),
    after: table([undefined, ...walks.map(walk => walk.after)]),
  }
  const result = foldGraph(nodes, tracks, {
    threshold: 50,
    ...options,
    ends,
  })
  expect(foldProblems(nodes, tracks, result)).toEqual([])
  if (!result.folded) {
    throw new Error(result.reason)
  }
  return {
    result,
    bare: foldGraph(nodes, tracks, { threshold: 50, ...options }),
    labels: result.branches.map(b => branchLabel(b, result.haplotypes)),
    sequences: result.tracks.map(track => track.sequence.join(' ')),
  }
}

describe('a walk that leaves the reference outside the window', () => {
  test('before it, rejoining inside it, is a deletion that continues past the window', () => {
    const { result, labels, sequences } = foldEnds([
      {
        sequence: 'c d',
        before: { kind: 'beyond', pos: 8000, ownBp: 0 },
      },
    ])
    expect(labels).toEqual(['deletion 4 kb, 1 of 2, continues past the window'])
    expect(result.branches[0]).toMatchObject({
      kind: 'deletion',
      insertedBp: 0,
      deletedBp: 4000,
      refStart: 10_000,
      refEnd: 12_000,
      open: true,
      beyond: 8000,
      nodes: [],
      to: 'c~d',
      anchored: false,
    })
    expect(sequences).toEqual(['a~b c~d', 'c~d'])
  })

  test('after it, with sequence of its own, is a replacement that hangs a node of its true bp from the breakpoint', () => {
    const { result, labels, sequences } = foldEnds([
      {
        sequence: 'a b',
        after: { kind: 'beyond', pos: 15_000, ownBp: 2363 },
      },
      {
        sequence: 'a b x',
        after: { kind: 'beyond', pos: 15_000, ownBp: 2363 },
      },
    ])
    expect(labels).toEqual([
      'replacement 2.4 kb for 3 kb, 2 of 3, continues past the window',
    ])
    expect(result.branches[0]).toMatchObject({
      kind: 'other',
      insertedBp: 2363,
      deletedBp: 3000,
      refStart: 12_000,
      refEnd: 14_000,
      beyond: 15_000,
      nodes: ['open:b:right:2363:15000'],
      from: 'a~b',
      anchored: true,
    })
    expect(sequences).toEqual(['a~b c~d', 'a~b open:b:right:2363:15000'])
    expect(result.walks.slice(1).map(walk => walk.steps)).toEqual([
      [
        {
          step: 1,
          node: 'open:b:right:2363:15000',
          insertedBp: 0,
          skippedBp: 0,
          clippedBp: 2363,
          largestInsertedBp: 0,
          largestSkippedBp: 0,
        },
      ],
      [
        {
          step: 1,
          node: 'open:b:right:2363:15000',
          insertedBp: 0,
          skippedBp: 0,
          clippedBp: 1863,
          largestInsertedBp: 0,
          largestSkippedBp: 0,
        },
      ],
    ])
  })

  test('walked against the reference, in both directions', () => {
    const { result, labels, sequences } = foldEnds([
      {
        sequence: '-b -a',
        before: { kind: 'beyond', pos: 15_000, reversed: true, ownBp: 0 },
      },
      {
        sequence: '-d -c',
        after: { kind: 'beyond', pos: 9000, reversed: true, ownBp: 600 },
      },
    ])
    expect(labels).toEqual([
      'replacement 600 bp for 3 kb, 1 of 3, continues past the window',
      'deletion 3 kb, 1 of 3, continues past the window',
    ])
    expect(result.branches.map(b => [b.refStart, b.refEnd, b.beyond])).toEqual([
      [10_000, 12_000, 9000],
      [12_000, 14_000, 15_000],
    ])
    expect(sequences).toEqual(['a~b c~d', '-a~b', '-c~d open:c:left:600:9000'])
  })

  test('a far step against the walk, or on the wrong side, draws and says nothing', () => {
    const { labels, sequences } = foldEnds([
      {
        sequence: 'a b',
        after: { kind: 'beyond', pos: 15_000, reversed: true, ownBp: 0 },
      },
      {
        sequence: 'c d',
        before: { kind: 'elsewhere', pos: 15_000, ownBp: 800 },
      },
    ])
    expect(labels).toEqual([])
    expect(sequences).toEqual(['a~b c~d', 'a~b', 'c~d'])
  })

  test('alleles near in size cluster when clustering is on, and not with an allele inside the window', () => {
    const walks = [
      {
        sequence: 'a b',
        after: { kind: 'beyond' as const, pos: 15_000, ownBp: 935 },
      },
      {
        sequence: 'a b',
        after: { kind: 'beyond' as const, pos: 15_000, ownBp: 935 },
      },
      {
        sequence: 'a b',
        after: { kind: 'beyond' as const, pos: 15_000, ownBp: 927 },
      },
      {
        sequence: 'a b',
        after: { kind: 'beyond' as const, pos: 16_000, ownBp: 935 },
      },
    ]
    expect(foldEnds(walks).labels).toEqual([
      'replacement 935 bp for 3 kb, 2 of 5, continues past the window',
      'replacement 927 bp for 3 kb, 1 of 5, continues past the window',
      'replacement 935 bp for 4 kb, 1 of 5, continues past the window',
    ])
    const clustered = foldEnds(walks, { cluster: true })
    expect(clustered.labels).toEqual([
      'replacement 927 bp to 935 bp for 3 kb (cluster of 2 lengths), 3 of 5, continues past the window',
      'replacement 935 bp for 4 kb, 1 of 5, continues past the window',
    ])
    expect(clustered.sequences.slice(1)).toEqual([
      'a~b open:b:right:935:15000',
      'a~b open:b:right:935:16000',
    ])
  })
})

describe('ends the fold does not draw', () => {
  const starts = (before: End) => foldEnds([{ sequence: 'c d', before }]).labels

  test('a walk with no step on the reference before its piece is said to start inside the window', () => {
    expect(starts({ kind: 'nowhere', pos: Number.NaN })).toEqual([
      'walk starts inside the window 2 kb, 1 of 2',
    ])
  })

  test('an end on the edge of what was read, a departure with bp the file lacks, and one whose far end is inside the window say nothing', () => {
    for (const end of [
      { kind: 'edge' as const, pos: Number.NaN },
      { kind: 'beyond' as const, pos: 8000, missingBp: 10 },
      { kind: 'elsewhere' as const, pos: 11_000 },
    ]) {
      const { result, labels, sequences } = foldEnds([
        { sequence: 'c d', before: end },
      ])
      expect(labels).toEqual([])
      expect(sequences).toEqual(['a~b c~d', 'c~d'])
      expect(result.walks[1]!.steps).toEqual([])
    }
  })

  test('an end of any kind but beyond draws no stub of the bp past it and says nothing', () => {
    for (const kind of ['edge', 'nowhere', 'elsewhere'] as const) {
      const far = kind === 'elsewhere' ? 15_000 : Number.NaN
      const { result, labels, sequences } = foldEnds([
        { sequence: 'x c d', before: { kind, pos: far, ownBp: 500 } },
        { sequence: 'a b x', after: { kind, pos: far, ownBp: 500 } },
      ])
      expect(sequences).toEqual(['a~b c~d', 'c~d', 'a~b'])
      expect(labels).toEqual(
        kind === 'nowhere'
          ? [
              'walk starts inside the window 2 kb, 1 of 3',
              'walk ends inside the window 2 kb, 1 of 3',
            ]
          : [],
      )
      expect(
        result.walks
          .slice(1)
          .map(walk => walk.steps.map(step => step.insertedBp)),
      ).toEqual([[500], [500]])
    }
  })

  test('a departure with bp the file lacks draws no stub either', () => {
    const { labels, sequences } = foldEnds([
      {
        sequence: 'x c d',
        before: { kind: 'beyond', pos: 8000, ownBp: 600, missingBp: 100 },
      },
    ])
    expect(labels).toEqual([])
    expect(sequences).toEqual(['a~b c~d', 'c~d'])
  })

  test('the two ends of one departure back on the reference 902 bp on draw no stub', () => {
    const { labels, sequences } = foldEnds([
      {
        sequence: 'a b x',
        after: { kind: 'elsewhere', pos: 12_902, ownBp: 1000 },
      },
      {
        sequence: 'x c d',
        before: { kind: 'elsewhere', pos: 12_000, ownBp: 1000 },
      },
    ])
    expect(labels).toEqual([])
    expect(sequences).toEqual(['a~b c~d', 'a~b', 'c~d'])
  })

  test('a departure under the threshold draws nothing, and its few bp in the window fold into the reference', () => {
    const { result, bare, labels, sequences } = foldEnds([
      {
        sequence: 'y a b c d',
        before: { kind: 'beyond', pos: 9995, ownBp: 5 },
      },
    ])
    expect(labels).toEqual([])
    expect(sequences).toEqual(['a~d', 'a~d'])
    expect(result.walks[1]!.steps[0]).toMatchObject({
      insertedBp: 5,
      largestInsertedBp: 5,
    })
    expect(bare.tracks.map(track => track.sequence.join(' '))).toEqual([
      'a~d',
      'lead:a:5 a~d',
    ])
  })
})

describe('what the fold reads past an end keeps its counts true', () => {
  test('walks that start at one breakpoint for different reasons are not one track', () => {
    const { result } = foldEnds([
      { sequence: 'c d', before: { kind: 'beyond', pos: 8000, ownBp: 0 } },
      { sequence: 'c d', before: { kind: 'beyond', pos: 2000, ownBp: 0 } },
      { sequence: 'c d', before: { kind: 'nowhere', pos: Number.NaN } },
    ])
    expect(result.branches).toHaveLength(3)
    for (const branch of result.branches) {
      expect(
        branch.tracks.reduce(
          (sum, id) => sum + result.tracks[id]!.haplotypes,
          0,
        ),
      ).toBe(branch.haplotypes)
    }
  })

  test('an inversion at an end past which the walk has no step on the reference does not continue past the window', () => {
    const { labels } = foldEnds([
      { sequence: 'a b -d -c', after: { kind: 'nowhere', pos: Number.NaN } },
    ])
    expect(labels).toEqual(['inversion 2 kb, 1 of 2'])
  })

  test('one departure read from a contig written either way is one branch', () => {
    const { labels } = foldEnds([
      { sequence: 'a b', after: { kind: 'beyond', pos: 15_000, ownBp: 0 } },
      {
        sequence: '-b -a',
        before: { kind: 'beyond', pos: 15_000, reversed: true, ownBp: 0 },
      },
    ])
    expect(labels).toEqual(['deletion 3 kb, 2 of 3, continues past the window'])
  })

  test('kinds may be the numbers of END_KINDS', () => {
    const tracks = [
      { name: 'ref', sequence: ['a', 'b', 'c', 'd'], indexOfFirstBase: 10_000 },
      { name: 'hap1', sequence: ['c', 'd'] },
    ]
    const row = (kind: number, pos: number) => ({
      kinds: Uint8Array.of(3, kind),
      pos: [Number.NaN, pos],
      reversed: [0, 0],
      ownBp: [0, 0],
      missingBp: [0, 0],
    })
    const result = foldGraph(nodes, tracks, {
      ends: {
        before: row(END_KINDS.indexOf('beyond'), 8000),
        after: row(3, Number.NaN),
      },
    })
    expect(result.branches.map(b => b.description)).toEqual(['deletion'])
  })

  test('ends the fold cannot read are refused, with the reason', () => {
    const tracks = [reference, { name: 'hap1', sequence: ['c', 'd'] }]
    const reason = (before: EndTable) => {
      const result = foldGraph(nodes, tracks, {
        ends: { before, after: table([undefined, undefined]) },
      })
      return result.folded ? undefined : result.reason
    }
    expect(reason(table([undefined]))).toBe(
      'ends.before has 1 kinds for 2 walks',
    )
    expect(reason({ ...table([undefined, undefined]), kinds: [3, 9] })).toBe(
      'ends.before gives hap1 the end kind 9',
    )
    expect(
      reason(table([undefined, { kind: 'beyond', pos: Number.NaN }])),
    ).toBe(
      'ends.before gives hap1 a departure without a finite position and own bp',
    )
  })
})

describe("an open branch is the whole graph's branch, cut by the window", () => {
  test('on 500 seeded random graphs, for each departure across a window edge', () => {
    let matched = 0
    for (let seed = 1; seed <= 500; seed++) {
      const random = seeded(seed)
      const count = 12 + random.below(20)
      const names = Array.from({ length: count }, (_, i) => `r${i}`)
      const all: InputNode[] = names.map(name => ({
        name,
        sequenceLength: 50 + random.below(2000),
      }))
      const walks = Array.from({ length: 6 }, (_, w) => {
        const sequence: string[] = []
        let i = 0
        while (i < count) {
          const roll = random.next()
          if (roll < 0.15) {
            i += 1 + random.below(6)
          } else if (roll < 0.25) {
            const name = `x${w}:${i}`
            all.push({ name, sequenceLength: random.below(3000) })
            sequence.push(name)
            i += random.below(3)
          } else {
            sequence.push(names[i]!)
            i += 1
          }
        }
        return sequence
      })
      const threshold = 50 + random.below(2000)
      const lengths = new Map(all.map(n => [n.name, n.sequenceLength ?? 0]))
      const at = [10_000]
      for (const name of names) {
        at.push(at.at(-1)! + lengths.get(name)!)
      }
      const index = new Map(names.map((name, i) => [name, i]))
      const whole = foldGraph(
        all,
        [
          { name: 'ref', sequence: names, indexOfFirstBase: 10_000 },
          ...walks.map((sequence, w) => ({ name: `hap${w}`, sequence })),
        ],
        { threshold },
      )
      const from = 2 + random.below(4)
      const to = count - 2 - random.below(4)
      const inside = (step: string) => {
        const i = index.get(step)
        return i !== undefined && i >= from && i < to
      }
      const pieces = walks.flatMap(sequence => {
        const first = sequence.findIndex(inside)
        const last = sequence.findLastIndex(inside)
        const end = (side: 'before' | 'after') => {
          const outward =
            side === 'before'
              ? sequence.slice(0, first).reverse()
              : sequence.slice(last + 1)
          const far = outward.findIndex(step => index.has(step))
          const ownBp = outward
            .slice(0, far < 0 ? outward.length : far)
            .reduce((bp, step) => bp + lengths.get(step)!, 0)
          const ref = far < 0 ? undefined : index.get(outward[far]!)!
          return ref === undefined
            ? { kind: 'nowhere' as const, pos: Number.NaN, ownBp }
            : {
                kind: 'beyond' as const,
                pos: side === 'before' ? at[ref + 1]! : at[ref]!,
                ownBp,
              }
        }
        return first < 0
          ? []
          : [
              {
                sequence: sequence.slice(first, last + 1).join(' '),
                before: end('before'),
                after: end('after'),
              },
            ]
      })
      const window = foldGraph(
        all,
        [
          {
            name: 'ref',
            sequence: names.slice(from, to),
            indexOfFirstBase: at[from]!,
          },
          ...pieces.map((piece, w) => ({
            name: `hap${w}`,
            sequence: piece.sequence.split(' '),
          })),
        ],
        {
          threshold,
          ends: {
            before: table([undefined, ...pieces.map(piece => piece.before)]),
            after: table([undefined, ...pieces.map(piece => piece.after)]),
          },
        },
      )
      if (!whole.folded || !window.folded) {
        throw new Error(`seed ${seed} did not fold`)
      }
      const crossing = whole.branches.filter(
        b =>
          b.kind !== 'inversion' &&
          b.refEnd > b.refStart &&
          ((b.refStart <= at[from]! &&
            b.refEnd >= at[from]! &&
            b.refEnd < at[to]!) ||
            (b.refStart > at[from]! &&
              b.refStart <= at[to]! &&
              b.refEnd >= at[to]!)),
      )
      const open = window.branches.filter(
        b => b.beyond !== undefined && b.deletedBp > 0,
      )
      const shape = (b: Branch, left: number, right: number) =>
        [b.kind, b.insertedBp, b.deletedBp, left, right, b.haplotypes].join()
      expect(
        open
          .map(b =>
            b.beyond! <= at[from]!
              ? shape(b, b.beyond!, b.refEnd)
              : shape(b, b.refStart, b.beyond!),
          )
          .sort(),
      ).toEqual(crossing.map(b => shape(b, b.refStart, b.refEnd)).sort())
      matched += open.length
    }
    expect(matched).toBeGreaterThan(200)
  })
})
