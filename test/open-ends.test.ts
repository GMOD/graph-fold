import { describe, expect, test } from 'vitest'

import { branchLabel, foldGraph, foldProblems } from '../src/index.ts'

import type {
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
    kinds: ends.map(end => end?.kind ?? 'ends'),
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
      nodes: ['open:b:2363:15000'],
      from: 'a~b',
      anchored: true,
    })
    expect(sequences).toEqual(['a~b c~d', 'a~b open:b:2363:15000'])
    expect(result.walks.slice(1).map(walk => walk.steps)).toEqual([
      [
        {
          step: 1,
          node: 'open:b:2363:15000',
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
          node: 'open:b:2363:15000',
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
    expect(sequences).toEqual(['a~b c~d', '-a~b', '-c~d open:c:600:9000'])
  })

  test('a far step against the walk, or on the wrong side, says so', () => {
    const { labels } = foldEnds([
      {
        sequence: 'a b',
        after: { kind: 'elsewhere', pos: 15_000, reversed: true, ownBp: 0 },
      },
      {
        sequence: 'c d',
        before: { kind: 'elsewhere', pos: 15_000, ownBp: 800 },
      },
    ])
    expect(labels).toEqual([
      'rejoins the reference outside the window, reversed, 1 of 3, continues past the window',
      'leaves the reference outside the window, out of order, 800 bp of its own, 1 of 3, continues past the window',
    ])
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
      'a~b open:b:935:15000',
      'a~b open:b:935:16000',
    ])
  })
})

describe('ends the fold does not draw', () => {
  const starts = (before: End) => foldEnds([{ sequence: 'c d', before }]).labels

  test('a walk that truly starts inside the window says so', () => {
    expect(starts({ kind: 'ends', pos: Number.NaN })).toEqual([
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

  test('says nothing on the edge, and keeps what the walk has of its own there', () => {
    const { labels, sequences } = foldEnds([
      { sequence: 'y c d', before: { kind: 'edge', pos: Number.NaN } },
    ])
    expect(labels).toEqual([
      'sequence off the reference before the walk first meets it 5 bp, 1 of 2',
    ])
    expect(sequences).toEqual(['a~b c~d', 'lead:c:5 c~d'])
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
