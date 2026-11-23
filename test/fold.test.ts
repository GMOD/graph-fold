import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import {
  bpLabel,
  branchLabel,
  foldGraph,
  foldProblems,
  variationLabel,
} from '../src/index.ts'

import type { FoldOptions, InputNode, InputTrack } from '../src/index.ts'

function graph(
  lengths: Record<string, number>,
  walks: string[],
  freqs: number[] = [],
) {
  const nodes: InputNode[] = Object.entries(lengths).map(
    ([name, sequenceLength]) => ({ name, sequenceLength }),
  )
  const tracks: InputTrack[] = walks.map((walk, i) => ({
    name: i === 0 ? 'ref' : `hap${i}`,
    sequence: walk.split(' '),
    freq: freqs[i] ?? 1,
  }))
  return { nodes, tracks }
}

function fold(
  lengths: Record<string, number>,
  walks: string[],
  options: FoldOptions,
  freqs?: number[],
) {
  const { nodes, tracks } = graph(lengths, walks, freqs)
  const result = foldGraph(nodes, tracks, options)
  expect(foldProblems(nodes, tracks, result)).toEqual([])
  if (!result.folded) {
    throw new Error(result.reason)
  }
  return result
}

const sequences = (result: { tracks: { sequence: string[] }[] }) =>
  result.tracks.map(track => track.sequence.join(' '))

describe('detours under the threshold', () => {
  test('a small replacement joins the reference node', () => {
    const result = fold({ a: 100, b: 10, c: 100, x: 12 }, ['a b c', 'a x c'], {
      threshold: 50,
    })
    expect(result.nodes).toEqual([
      {
        name: 'a~c',
        sequenceLength: 210,
        kind: 'reference',
        refStart: 0,
        refEnd: 210,
      },
    ])
    expect(sequences(result)).toEqual(['a~c', 'a~c'])
    expect(result.branches).toEqual([])
    expect(result.members['a~c']).toEqual(['a', 'b', 'c', 'x'])
    expect(result.walks[1]).toMatchObject({
      originalBp: 212,
      foldedBp: 210,
      insertedBp: 12,
      skippedBp: 10,
      steps: [
        { step: 0, node: 'a~c', insertedBp: 12, skippedBp: 10, clippedBp: 0 },
      ],
    })
  })

  test('an insertion and a deletion one bp short of the threshold fold', () => {
    const result = fold(
      { a: 100, b: 49, c: 100, x: 49 },
      ['a b c', 'a c', 'a x b c'],
      { threshold: 50 },
    )
    expect(sequences(result)).toEqual(['a~c', 'a~c'])
    expect(result.tracks[1]).toMatchObject({ freq: 2, names: ['hap1', 'hap2'] })
  })

  test('a small inversion folds', () => {
    const result = fold({ a: 100, b: 10, c: 100 }, ['a b c', 'a -b c'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a~c', 'a~c'])
    expect(result.walks[1]).toMatchObject({ insertedBp: 10, skippedBp: 10 })
  })

  test('a short tandem repeat of a reference node folds', () => {
    const result = fold({ a: 100, b: 10, c: 100 }, ['a b c', 'a b b b c'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a~c', 'a~c'])
    expect(result.walks[1]).toMatchObject({ insertedBp: 20, skippedBp: 0 })
  })
})

describe('detours at or over the threshold', () => {
  test('an insertion of exactly the threshold is a branch', () => {
    const result = fold(
      { a: 100, b: 100, x: 30, y: 20 },
      ['a b', 'a x y b'],
      { threshold: 50 },
      [1, 7],
    )
    expect(sequences(result)).toEqual(['a b', 'a ins:a:50 b'])
    expect(result.members['ins:a:50']).toEqual(['x', 'y'])
    expect(result.branches).toEqual([
      {
        kind: 'insertion',
        description: 'insertion',
        length: 50,
        insertedBp: 50,
        deletedBp: 0,
        refStart: 100,
        refEnd: 100,
        haplotypes: 7,
        nodes: ['ins:a:50'],
        from: 'a',
        to: 'b',
        tracks: [1],
        anchored: true,
      },
    ])
  })

  test('a deletion of exactly the threshold is a branch', () => {
    const result = fold(
      { a: 100, b: 20, c: 30, d: 100 },
      ['a b c d', 'a d'],
      { threshold: 50 },
      [1, 3],
    )
    expect(sequences(result)).toEqual(['a b~c d', 'a d'])
    expect(result.branches).toMatchObject([
      {
        kind: 'deletion',
        length: 50,
        refStart: 100,
        refEnd: 150,
        haplotypes: 3,
        from: 'a',
        to: 'd',
      },
    ])
  })

  test('a small allele that replaces a large stretch of reference is a deletion', () => {
    const result = fold({ a: 100, b: 500, c: 100, x: 5 }, ['a b c', 'a x c'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a b c', 'a c'])
    expect(result.branches).toMatchObject([
      { kind: 'deletion', deletedBp: 500 },
    ])
    expect(result.walks[1]).toMatchObject({ insertedBp: 5, skippedBp: 0 })
  })

  test('a large allele over a few reference bp is an insertion, and the walk passes that reference', () => {
    const result = fold({ a: 100, b: 5, c: 100, x: 500 }, ['a b c', 'a x c'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a b~c', 'a ins:a:500 b~c'])
    expect(result.walks[1]).toMatchObject({ insertedBp: 0, skippedBp: 5 })
  })

  test('a large allele over a large stretch of reference is a replacement', () => {
    const result = fold(
      { a: 100, b: 300, c: 100, x: 500 },
      ['a b c', 'a x c'],
      { threshold: 50 },
    )
    expect(sequences(result)).toEqual(['a b c', 'a ins:a:500:c c'])
    expect(result.branches).toMatchObject([
      {
        kind: 'other',
        description: 'replacement',
        insertedBp: 500,
        deletedBp: 300,
      },
    ])
  })

  test('small variants beside a kept branch fold into its flanks', () => {
    const result = fold(
      { a: 100, s: 1, t: 1, b: 100, c: 400, d: 100, e: 3, f: 100 },
      ['a s b c d e f', 'a t b d f'],
      { threshold: 50 },
    )
    expect(sequences(result)).toEqual(['a~b c d~f', 'a~b d~f'])
    expect(result.walks[1]!.steps).toEqual([
      { step: 0, node: 'a~b', insertedBp: 1, skippedBp: 1, clippedBp: 0 },
      { step: 1, node: 'd~f', insertedBp: 0, skippedBp: 3, clippedBp: 0 },
    ])
  })
})

describe('inversions', () => {
  const lengths = { a: 100, b: 30, c: 40, d: 30, e: 100 }

  test('reference walked in reverse stays an inverted block', () => {
    const result = fold(
      lengths,
      ['a b c d e', 'a -d -c -b e'],
      { threshold: 50 },
      [1, 9],
    )
    expect(sequences(result)).toEqual(['a b~d e', 'a -b~d e'])
    expect(result.branches).toEqual([
      {
        kind: 'inversion',
        description: 'inversion',
        length: 100,
        insertedBp: 0,
        deletedBp: 0,
        refStart: 100,
        refEnd: 200,
        haplotypes: 9,
        nodes: ['b~d'],
        from: 'a',
        to: 'e',
        tracks: [1],
        anchored: true,
      },
    ])
    expect(result.walks[1]).toMatchObject({ insertedBp: 0, skippedBp: 0 })
  })

  test('a small variant inside the inversion folds into the inverted block', () => {
    const result = fold(lengths, ['a b c d e', 'a -d -b e'], { threshold: 50 })
    expect(sequences(result)).toEqual(['a b~d e', 'a -b~d e'])
    expect(result.walks[1]).toMatchObject({ insertedBp: 0, skippedBp: 40 })
  })

  test('a walk written against the reference has no inversion', () => {
    const result = fold(lengths, ['a b c d e', '-e -d -c -b -a'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a~e', '-a~e'])
    expect(result.branches).toEqual([])
  })
})

describe('window edges', () => {
  test('flanks shorter than the threshold do not erase an inversion', () => {
    const result = fold({ a: 20, b: 6000, c: 20 }, ['a b c', 'a -b c'], {
      threshold: 5000,
    })
    expect(sequences(result)).toEqual(['a b c', 'a -b c'])
    expect(result.branches).toMatchObject([{ kind: 'inversion', length: 6000 }])
  })

  test('an inversion the window cuts through is kept, and marked open', () => {
    const result = fold({ a: 6000, b: 20, c: 30 }, ['a b c', 'a -c -b'], {
      threshold: 5000,
    })
    expect(sequences(result)).toEqual(['a b~c', 'a -b~c'])
    expect(result.branches).toMatchObject([
      { kind: 'inversion', length: 50, open: true },
    ])
  })

  test('a walk that starts or ends inside a merged node is clipped, not skipped', () => {
    const result = fold({ a: 10, b: 100, c: 100, d: 7 }, ['a b c d', 'b c'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a~d', 'a~d'])
    expect(result.walks[1]).toMatchObject({
      originalBp: 200,
      foldedBp: 217,
      skippedBp: 0,
      clippedBp: 17,
    })
  })

  test('sequence off the reference at a walk end never rejoins in the window, so it is kept however short', () => {
    const result = fold({ a: 100, b: 100, x: 80, y: 8 }, ['a b', 'x a b y'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a~b', 'lead:a:80 a~b tail:b:8'])
    expect(result.branches.map(b => [b.kind, b.insertedBp])).toEqual([
      ['other', 80],
      ['other', 8],
    ])
  })

  test('a walk that ends the threshold or more short of the reference is drawn ending there', () => {
    const result = fold(
      { a: 100, b: 100, c: 7000, x: 5 },
      ['a b c', 'a b x', 'a b'],
      { threshold: 50 },
    )
    expect(sequences(result)).toEqual(['a~b c', 'a~b tail:b:5', 'a~b'])
    expect(result.branches).toMatchObject([
      { kind: 'other', insertedBp: 5 },
      {
        kind: 'other',
        description: 'walk ends inside the window',
        length: 7000,
        refStart: 200,
        refEnd: 200,
        haplotypes: 2,
      },
    ])
    expect(result.walks[1]).toMatchObject({ skippedBp: 0, clippedBp: 0 })
  })
})

describe('a reference that passes a node twice', () => {
  const { nodes, tracks } = graph({ a: 100, b: 10, c: 100, x: 10 }, [
    'a b c b',
    'a x c b',
  ])

  test('is returned unfolded, with the reason', () => {
    const result = foldGraph(nodes, tracks, { threshold: 50 })
    expect(result).toMatchObject({
      folded: false,
      reason: expect.stringMatching(
        /passes 1 nodes of this window more than once/,
      ),
      threshold: 50,
      haplotypes: 2,
      branches: [],
      walks: [],
      members: {},
    })
    expect(result.nodes).toBe(nodes)
    expect(result.tracks).toBe(tracks)
    expect(foldProblems(nodes, tracks, result)).toEqual([])
  })

  test('so is a window of a file whose header counts revisited nodes', () => {
    const single = graph({ a: 100, b: 10, c: 100, x: 10 }, ['a b c', 'a x c'])
    const result = foldGraph(single.nodes, single.tracks, {
      threshold: 50,
      referenceRevisits: 12,
    })
    expect(result).toMatchObject({
      folded: false,
      reason: expect.stringMatching(
        /passes 12 nodes of the graph more than once/,
      ),
    })
    expect(result.tracks).toBe(single.tracks)
  })

  test('a header with no count leaves the window to decide', () => {
    const single = graph({ a: 100, b: 10, c: 100, x: 10 }, ['a b c', 'a x c'])
    expect(
      foldGraph(single.nodes, single.tracks, { referenceRevisits: Number.NaN })
        .folded,
    ).toBe(true)
  })
})

describe('input the fold cannot read', () => {
  test('a step on a node that is not among the nodes is refused, naming the track and node', () => {
    const { nodes, tracks } = graph({ a: 100, b: 100 }, ['a b', 'a z b'])
    const result = foldGraph(nodes, tracks, { threshold: 50 })
    expect(result).toMatchObject({
      folded: false,
      reason: 'hap1 steps node z, which is not among the nodes',
    })
    expect(result.tracks).toBe(tracks)
  })

  test('no reference track is refused', () => {
    expect(foldGraph([], [])).toMatchObject({
      folded: false,
      reason: 'there is no reference walk at track 0',
      haplotypes: 0,
    })
  })
})

describe('what a consumer passed', () => {
  test("a folded track keeps its first walk's own fields, and its sourceTrackID", () => {
    const nodes = [
      { name: 'a', sequenceLength: 100 },
      { name: 'b', sequenceLength: 100 },
      { name: 'x', sequenceLength: 3 },
    ]
    const tracks = [
      { name: 'ref', sequence: ['a', 'b'], sourceTrackID: 4, color: 'grey' },
      { name: 'h1', sequence: ['a', 'x', 'b'], sourceTrackID: 7, color: 'red' },
      { name: 'h2', sequence: ['a', 'b'], sourceTrackID: 7, color: 'blue' },
    ]
    const result = foldGraph(nodes, tracks, { threshold: 50 })
    expect(result.folded && result.tracks).toMatchObject([
      { id: 0, name: 'ref', label: 'ref', sourceTrackID: 4, color: 'grey' },
      {
        id: 1,
        name: 'h1',
        label: '2 haplotypes',
        names: ['h1', 'h2'],
        freq: 2,
        sourceTrackID: 7,
        color: 'red',
      },
    ])
    expect(result.haplotypes).toBe(3)
  })

  test('walks come out in the order of the tracks, wherever the reference is', () => {
    const { nodes, tracks } = graph({ a: 100, b: 100, x: 3 }, [
      'a x b',
      'a b',
      'a b',
    ])
    const result = foldGraph(nodes, tracks, { threshold: 50, reference: 1 })
    expect(result.walks.map(w => [w.name, w.track, w.insertedBp])).toEqual([
      ['ref', 1, 3],
      ['hap1', 0, 0],
      ['hap2', 1, 0],
    ])
    expect(result.folded && result.tracks.map(t => t.label)).toEqual([
      'hap1',
      '2 haplotypes',
    ])
  })
})

describe('labels', () => {
  test('a branch reads kind, size and carriers, and a cluster its range and count', () => {
    const result = fold(
      { a: 500, b: 500, x: 1000, y: 1010, c: 30000, d: 500, z: 20000 },
      ['a b c d', 'a x b c d', 'a y b c d', 'a b d', 'a b z d'],
      { threshold: 50, cluster: true },
      [1, 5, 2, 4, 1],
    )
    expect(result.branches.map(b => branchLabel(b, result.haplotypes))).toEqual(
      [
        'insertion about 1 kb (cluster of 2 lengths), 7 of 13',
        'deletion 30 kb, 4 of 13',
        'replacement 20 kb for 30 kb, 1 of 13',
      ],
    )
    expect(result.tracks.map(variationLabel)).toEqual([
      '1 haplotype on 1 distinct walk, nothing folded away',
      '7 haplotypes on 2 distinct walks, 0 bp to 10 bp folded away in each',
      '4 haplotypes on 1 distinct walk, nothing folded away',
      '1 haplotype on 1 distinct walk, nothing folded away',
    ])
    expect(bpLabel(999)).toBe('999 bp')
    expect(bpLabel(1000)).toBe('1 kb')
    expect(bpLabel(45_516)).toBe('45.5 kb')
    expect(bpLabel(123_456)).toBe('123 kb')
  })
})

describe('what a tube stands for', () => {
  test('the same walk given as two tracks counts as one distinct walk', () => {
    const result = fold(
      { a: 100, b: 10, c: 100 },
      ['a b c', 'a c', 'a c', 'a b c'],
      { threshold: 50 },
    )
    expect(
      result.tracks.map(t => [t.freq, t.variation.walks, t.names.length]),
    ).toEqual([
      [1, 1, 1],
      [3, 2, 3],
    ])
  })

  test('an inversion the window cuts through says so in its label', () => {
    const result = fold({ a: 6000, b: 20, c: 30 }, ['a b c', 'a -c -b'], {
      threshold: 5000,
    })
    expect(result.branches.map(b => branchLabel(b, result.haplotypes))).toEqual(
      [expect.stringMatching(/, 1 of 2, continues past the window$/)],
    )
  })
})

describe('where a branch is', () => {
  test('a branch names the folded tracks that carry it', () => {
    const result = fold(
      { a: 100, b: 100, c: 100, x: 200 },
      ['a b c', 'a c', 'a x b c', 'a x c'],
      { threshold: 50 },
    )
    expect(result.branches.map(b => [b.kind, b.tracks, b.anchored])).toEqual([
      ['insertion', [2], true],
      ['deletion', [1], true],
      ['other', [3], true],
    ])
  })

  test('a branch with no box or jump of its own says so, and where on the reference it applies', () => {
    const result = fold({ a: 100, b: 100, c: 7000 }, ['a b c', 'a b'], {
      threshold: 50,
    })
    expect(result.branches).toEqual([
      {
        kind: 'other',
        description: 'walk ends inside the window',
        length: 7000,
        insertedBp: 0,
        deletedBp: 0,
        refStart: 200,
        refEnd: 200,
        haplotypes: 1,
        nodes: [],
        tracks: [1],
        anchored: false,
      },
    ])
  })
})

describe('a pggb graph', () => {
  const window: {
    nodes: InputNode[]
    tracks: InputTrack[]
    revisited: number
  } = JSON.parse(
    readFileSync(new URL('fixtures/ecoli-pggb.json', import.meta.url), 'utf8'),
  )

  test('folds where its reference passes each node once, as the E. coli K12 example does', () => {
    expect(window.revisited).toBe(0)
    const result = foldGraph(window.nodes, window.tracks, {
      threshold: 50,
      referenceRevisits: window.revisited,
    })
    expect(result.folded).toBe(true)
    expect(foldProblems(window.nodes, window.tracks, result)).toEqual([])
  })

  test('is refused where the file counts a revisited node', () => {
    expect(
      foldGraph(window.nodes, window.tracks, { referenceRevisits: 1 }).folded,
    ).toBe(false)
  })
})

describe('a haplotype that walks reference twice', () => {
  test('a large repeat is kept as a branch of kind other', () => {
    const result = fold({ a: 100, b: 300, c: 100 }, ['a b c', 'a b b c'], {
      threshold: 50,
    })
    expect(sequences(result)).toEqual(['a b c', 'a b b c'])
    expect(result.branches).toMatchObject([
      {
        kind: 'other',
        description: 'reference walked twice',
        length: 300,
        nodes: ['b'],
      },
    ])
  })
})

describe('clustering near-equal alleles', () => {
  const lengths = { a: 500, b: 500, x: 1000, y: 1010, z: 2000 }
  const walks = ['a b', 'a x b', 'a y b', 'a z b']
  const freqs = [1, 5, 2, 4]

  test('is off by default: every length is its own branch, none marked', () => {
    const result = fold(lengths, walks, { threshold: 50 }, freqs)
    expect(result.branches.map(b => [b.insertedBp, b.haplotypes])).toEqual([
      [1000, 5],
      [1010, 2],
      [2000, 4],
    ])
    expect(result.branches.some(b => b.cluster !== undefined)).toBe(false)
    expect(result.nodes.some(n => n.cluster !== undefined)).toBe(false)
  })

  test('when on, a merged branch and its node say they are a cluster', () => {
    const result = fold(lengths, walks, { threshold: 50, cluster: true }, freqs)
    const cluster = {
      members: 2,
      minLength: 1000,
      maxLength: 1010,
      haplotypes: 7,
    }
    expect(sequences(result)).toEqual([
      'a b',
      'a ins:a:1000 b',
      'a ins:a:2000 b',
    ])
    expect(result.branches).toMatchObject([
      {
        insertedBp: 1000,
        haplotypes: 7,
        cluster,
        alleles: [
          { insertedBp: 1000, haplotypes: 5 },
          { insertedBp: 1010, haplotypes: 2 },
        ],
      },
      { insertedBp: 2000, haplotypes: 4 },
    ])
    expect(result.branches[1]!.cluster).toBeUndefined()
    expect(result.nodes.find(n => n.name === 'ins:a:1000')?.cluster).toEqual(
      cluster,
    )
    expect(result.members['ins:a:1000']).toEqual(['x', 'y'])
    expect(result.walks[2]).toMatchObject({
      originalBp: 2010,
      foldedBp: 2000,
      insertedBp: 10,
      steps: [{ step: 1, node: 'ins:a:1000', insertedBp: 10 }],
    })
  })

  test('the tolerance decides what joins', () => {
    const result = fold(
      lengths,
      walks,
      { threshold: 50, cluster: true, clusterTolerance: 0.001 },
      freqs,
    )
    expect(result.branches).toHaveLength(3)
  })

  test('deletions whose breakpoints differ by a few percent join, and the walk reconciles', () => {
    const result = fold(
      { a: 500, b: 10, c: 1000, d: 500 },
      ['a b c d', 'a d', 'a b d'],
      { threshold: 50, cluster: true },
      [1, 6, 2],
    )
    expect(sequences(result)).toEqual(['a b~c d', 'a d'])
    expect(result.branches).toMatchObject([
      {
        kind: 'deletion',
        deletedBp: 1010,
        haplotypes: 8,
        cluster: {
          members: 2,
          minLength: 1000,
          maxLength: 1010,
          haplotypes: 8,
        },
      },
    ])
    expect(result.walks[2]).toMatchObject({
      originalBp: 1010,
      foldedBp: 1000,
      insertedBp: 10,
    })
  })
})

describe('chr15:92768150-92768700 of the HPRC v2.1 graph', () => {
  const window: {
    nodes: InputNode[]
    tracks: InputTrack[]
    revisited: number
  } = JSON.parse(
    readFileSync(
      new URL('fixtures/chr15-92768150-92768700.json', import.meta.url),
      'utf8',
    ),
  )
  const foldAt = (threshold: number) => {
    const result = foldGraph(window.nodes, window.tracks, {
      threshold,
      referenceRevisits: window.revisited,
    })
    expect(foldProblems(window.nodes, window.tracks, result)).toEqual([])
    return result
  }

  test('at 50 bp keeps the six alleles with their carriers', () => {
    const result = foldAt(50)
    expect(window.nodes).toHaveLength(439)
    expect(window.tracks).toHaveLength(88)
    expect(result.nodes).toHaveLength(15)
    expect(result.tracks.map(t => t.freq)).toEqual([1, 151, 177, 2, 39, 92, 2])
    expect(
      result.branches.map(b => [
        b.description,
        b.insertedBp,
        b.deletedBp,
        b.refStart,
        b.haplotypes,
      ]),
    ).toEqual([
      ['insertion', 50, 0, 92768131, 177],
      ['insertion', 51, 0, 92768131, 2],
      ['insertion', 99, 0, 92768250, 310],
      ['deletion', 0, 74, 92768558, 310],
      ['deletion', 0, 156, 92768737, 39],
      ['deletion', 0, 80, 92768749, 271],
      ['replacement', 159, 71, 92769429, 2],
    ])
  })

  test('every original node is held by one folded node or more', () => {
    const held = new Set(Object.values(foldAt(50).members).flat())
    expect(window.nodes.filter(n => !held.has(n.name))).toEqual([])
  })

  test('at 1000 bp is one node', () => {
    const result = foldAt(1000)
    expect(result.nodes).toHaveLength(1)
    expect(result.tracks.map(t => t.freq)).toEqual([1, 463])
    expect(result.branches).toEqual([])
  })
})

describe("inversions: 'box'", () => {
  const lengths = { a: 100, b: 30, c: 40, d: 30, e: 100 }
  const box = { threshold: 50, inversions: 'box' as const }

  test('the default is the walk through the reference node, reversed', () => {
    const walks = ['a b c d e', 'a -d -c -b e']
    expect(fold(lengths, walks, { threshold: 50 })).toEqual(
      fold(lengths, walks, { threshold: 50, inversions: 'walk' }),
    )
  })

  test('a carrier stored forward steps through a copy of the block, forward', () => {
    const result = fold(lengths, ['a b c d e', 'a -d -c -b e'], box, [1, 9])
    expect(sequences(result)).toEqual(['a b~d e', 'a inv:b~d e'])
    expect(result.nodes.find(n => n.name === 'inv:b~d')).toEqual({
      name: 'inv:b~d',
      sequenceLength: 100,
      kind: 'branch',
      refStart: 100,
      refEnd: 200,
      invertedOf: 'b~d',
    })
    expect(result.members['inv:b~d']).toEqual(['b', 'c', 'd'])
    expect(result.branches).toMatchObject([
      { kind: 'inversion', length: 100, haplotypes: 9, nodes: ['inv:b~d'] },
    ])
    expect(result.walks[1]).toMatchObject({ insertedBp: 0, skippedBp: 0 })
  })

  test('a carrier stored back to front steps through the copy the way it travels', () => {
    const result = fold(lengths, ['a b c d e', '-e b c d -a'], box)
    expect(sequences(result)).toEqual(['a b~d e', '-e -inv:b~d -a'])
    expect(result.branches).toMatchObject([
      { kind: 'inversion', nodes: ['inv:b~d'] },
    ])
  })

  test('a non-carrier stored back to front gets no box', () => {
    const result = fold(lengths, ['a b c d e', '-e -d -c -b -a'], box)
    expect(sequences(result)).toEqual(['a~e', '-a~e'])
    expect(result.nodes.some(n => n.invertedOf !== undefined)).toBe(false)
  })

  test('a small variant inside the block folds into the copy', () => {
    const result = fold({ ...lengths, x: 3 }, ['a b c d e', 'a -d x -b e'], box)
    expect(sequences(result)).toEqual(['a b~d e', 'a inv:b~d e'])
    expect(result.members['inv:b~d']).toEqual(['b', 'c', 'd', 'x'])
    expect(result.members['b~d']).toEqual(['b', 'c', 'd'])
    expect(result.walks[1]!.steps).toEqual([
      { step: 1, node: 'inv:b~d', insertedBp: 3, skippedBp: 40, clippedBp: 0 },
    ])
  })

  test('an inversion the window cuts through is boxed and stays open', () => {
    const result = fold({ a: 6000, b: 20, c: 30 }, ['a b c', 'a -c -b'], {
      threshold: 5000,
      inversions: 'box',
    })
    expect(sequences(result)).toEqual(['a b~c', 'a inv:b~c'])
    expect(result.branches).toMatchObject([
      { kind: 'inversion', open: true, nodes: ['inv:b~c'] },
    ])
  })

  test('two inversions in one window get a copy each', () => {
    const result = fold(
      { a: 100, b: 100, c: 100, d: 100, e: 100 },
      ['a b c d e', 'a -b c d e', 'a b c -d e', 'a -b c -d e'],
      box,
    )
    expect(sequences(result)).toEqual([
      'a b c d e',
      'a inv:b c d e',
      'a b c inv:d e',
      'a inv:b c inv:d e',
    ])
    expect(result.branches.map(b => [b.nodes, b.haplotypes])).toEqual([
      [['inv:b'], 2],
      [['inv:d'], 2],
    ])
  })

  test('a block another branch cuts is a copy of each piece, in the order the carrier walks them', () => {
    const result = fold(
      { a: 100, b: 100, c: 100, d: 100, e: 100 },
      ['a b c d e', 'a -d -c -b e', 'a b d e'],
      box,
    )
    expect(sequences(result)).toEqual([
      'a b c d e',
      'a inv:d inv:c inv:b e',
      'a b d e',
    ])
    expect(result.branches.find(b => b.kind === 'inversion')?.nodes).toEqual([
      'inv:b',
      'inv:c',
      'inv:d',
    ])
  })

  test('an insertion inside the block is a node of its own, walked the way the carrier travels', () => {
    const result = fold(
      { a: 100, b: 100, c: 100, d: 100, x: 200 },
      ['a b c d', 'a -c x -b d', 'a b x c d'],
      box,
    )
    expect(sequences(result)).toEqual([
      'a b c d',
      'a inv:c inv:ins:b:200 inv:b d',
      'a b ins:b:200 c d',
    ])
    expect(result.nodes.find(n => n.name === 'inv:ins:b:200')).toMatchObject({
      kind: 'branch',
      sequenceLength: 200,
    })
    expect(
      result.nodes.find(n => n.name === 'inv:ins:b:200')?.invertedOf,
    ).toBeUndefined()
    expect(result.branches.find(b => b.kind === 'insertion')).toMatchObject({
      haplotypes: 2,
      nodes: ['inv:ins:b:200', 'ins:b:200'],
    })
  })

  test('a copy takes a name no input node has', () => {
    const result = fold(
      { a: 100, b: 100, c: 100, 'inv:b': 5 },
      ['a b c', 'a -b c', 'a inv:b b c'],
      box,
    )
    expect(sequences(result)).toEqual(['a b c', "a inv:b' c", 'a b c'])
    expect(result.nodes.find(n => n.invertedOf === 'b')?.name).toBe("inv:b'")
  })

  test('the chr15 window, which has no inversion, folds the same either way', () => {
    const window: { nodes: InputNode[]; tracks: InputTrack[] } = JSON.parse(
      readFileSync(
        new URL('fixtures/chr15-92768150-92768700.json', import.meta.url),
        'utf8',
      ),
    )
    expect(foldGraph(window.nodes, window.tracks, box)).toEqual(
      foldGraph(window.nodes, window.tracks, { threshold: 50 }),
    )
  })
})

describe('what a track hides', () => {
  test('a track counts the walks it stands for and the spread of what was folded away, by haplotype', () => {
    const result = fold(
      { a: 100, b: 10, c: 100, x: 4, y: 30 },
      ['a b c', 'a c', 'a x b c', 'a b y c', 'a b c'],
      { threshold: 50 },
      [1, 5, 2, 1, 3],
    )
    expect(sequences(result)).toEqual(['a~c', 'a~c'])
    expect(result.tracks[0]!.variation).toEqual({
      walks: 1,
      foldedAwayBp: { min: 0, median: 0, max: 0 },
      insertedBp: { min: 0, median: 0, max: 0 },
      skippedBp: { min: 0, median: 0, max: 0 },
    })
    expect(result.tracks[1]).toMatchObject({
      freq: 11,
      variation: {
        walks: 4,
        foldedAwayBp: { min: 0, median: 10, max: 30 },
        insertedBp: { min: 0, median: 0, max: 30 },
        skippedBp: { min: 0, median: 0, max: 10 },
      },
    })
  })
})
