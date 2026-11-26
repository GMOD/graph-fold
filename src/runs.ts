import { foldGraph, unfolded } from './fold.ts'

import type {
  EndTable,
  FoldResult,
  InputTrack,
  ReferenceNode,
  RunsFoldOptions,
  RunsInput,
  WalkFields,
} from './types.ts'

export function referenceIndex({ reference }: RunsInput) {
  const { nodes, starts } = reference
  const offsets = [0]
  for (const node of nodes) {
    offsets.push(offsets.at(-1)! + node.sequenceLength)
  }
  const atStart = new Map<number, number>()
  const atEnd = new Map<number, number>()
  nodes.forEach((node, i) => {
    atStart.set(starts[i]!, i)
    atEnd.set(starts[i]! + node.sequenceLength, i + 1)
  })
  const span = (start: number, bp: number) => {
    const from = atStart.get(start)
    const to = atEnd.get(start + bp)
    return from !== undefined &&
      to !== undefined &&
      to > from &&
      bp === offsets[to]! - offsets[from]!
      ? { from, to }
      : undefined
  }
  return { offsets, span }
}

export function whyRunsUnreadable(
  input: RunsInput,
  referenceRevisits: number | undefined,
) {
  const { reference, tracks, offsets, stretches, leadBp, tailBp } = input
  const { span } = referenceIndex(input)
  const names = reference.nodes.map(node => node.name)
  const repeats = names.length - new Set(names).size
  const trackName = (t: number) => tracks[t]?.name ?? `track ${t + 1}`
  const shapes = [
    [offsets.length, tracks.length + 1, 'offsets'],
    [leadBp.length, tracks.length, 'leadBp'],
    [tailBp.length, tracks.length, 'tailBp'],
    [reference.starts.length, reference.nodes.length, 'reference starts'],
  ] as const
  const misshapen = shapes.find(([found, wanted]) => found !== wanted)
  const stretchProblem = () => {
    for (let t = 0; t < tracks.length; t++) {
      for (let k = offsets[t]!; k < offsets[t + 1]!; k++) {
        const start = stretches.starts[k]!
        const bp = stretches.bp[k]!
        if (span(start, bp) === undefined) {
          return `${trackName(t)} has a stretch of ${bp} bp at ${start} that does not start and end on the reference's nodes`
        }
        if (k === offsets[t] && stretches.offBefore[k] !== 0) {
          return `${trackName(t)} has ${stretches.offBefore[k]} bp before its first stretch outside leadBp`
        }
      }
    }
    return undefined
  }
  const unplaced = reference.nodes.find(node => node.sequenceLength <= 0)
  return reference.nodes.length === 0
    ? 'there is no reference walk'
    : unplaced !== undefined
      ? `reference node ${unplaced.name} has no bp, so no stretch can say whether it holds it`
      : misshapen !== undefined
        ? `the input has ${misshapen[0]} ${misshapen[2]} for ${misshapen[1]}`
        : (stretchProblem() ??
          (referenceRevisits !== undefined && referenceRevisits > 0
            ? `the reference passes ${referenceRevisits} nodes of the graph more than once, so a run off it may be a copy of reference sequence and not a variant`
            : repeats > 0
              ? `the reference passes ${repeats} nodes of this window more than once, so a run off it may be a copy of reference sequence and not a variant`
              : undefined))
}

function expanded<T extends WalkFields>(input: RunsInput<T>) {
  const { reference, tracks, offsets, stretches, leadBp, tailBp } = input
  const { span } = referenceIndex(input)
  const names = reference.nodes.map(node => node.name)
  const synthetic = new Map<string, number>()
  const off = (site: string, bp: number) => {
    const name = `run:${site}:${bp}`
    synthetic.set(name, bp)
    return name
  }
  const walks = tracks.map((track, t) => {
    const sequence: string[] = []
    let before = '^'
    for (let k = offsets[t]!; k < offsets[t + 1]!; k++) {
      const { from, to } = span(stretches.starts[k]!, stretches.bp[k]!)!
      const against = stretches.against[k] !== 0
      const first = against ? to - 1 : from
      const own = k === offsets[t] ? leadBp[t]! : stretches.offBefore[k]!
      const firstStep = against ? `-${names[first]}` : names[first]!
      if (own > 0) {
        sequence.push(off(`${before}~${firstStep}`, own))
      }
      for (let i = 0; i < to - from; i++) {
        const ref = against ? to - 1 - i : from + i
        sequence.push(against ? `-${names[ref]}` : names[ref]!)
      }
      before = sequence.at(-1)!
    }
    const tail =
      offsets[t] === offsets[t + 1] ? leadBp[t]! + tailBp[t]! : tailBp[t]!
    if (tail > 0) {
      sequence.push(off(`${before}~$`, tail))
    }
    const walk: T & InputTrack = { ...track, sequence }
    return walk
  })
  const nodes: ReferenceNode[] = [
    ...reference.nodes,
    ...[...synthetic].map(([name, sequenceLength]) => ({
      name,
      sequenceLength,
    })),
  ]
  const referenceTrack: T & InputTrack = { ...reference.track, sequence: names }
  return { nodes, tracks: [referenceTrack, ...walks] }
}

function afterReference(table: EndTable) {
  const shifted: EndTable = {
    kinds: ['unknown', ...table.kinds],
    pos: [Number.NaN, ...Array.from(table.pos)],
    reversed: [0, ...Array.from(table.reversed)],
    ownBp: [0, ...Array.from(table.ownBp)],
    missingBp: [0, ...Array.from(table.missingBp)],
  }
  return shifted
}

export function foldRuns<T extends WalkFields>(
  input: RunsInput<T>,
  options: RunsFoldOptions = {},
) {
  const reason = whyRunsUnreadable(input, options.referenceRevisits)
  const steps = reason === undefined ? expanded(input) : undefined
  const result: FoldResult<ReferenceNode, T> =
    steps === undefined
      ? unfolded(
          input.reference.nodes,
          [input.reference.track, ...input.tracks],
          options.threshold ?? 50,
          reason ?? '',
        )
      : foldGraph(steps.nodes, steps.tracks, {
          ...options,
          reference: 0,
          ...(input.ends === undefined
            ? {}
            : {
                ends: {
                  before: afterReference(input.ends.before),
                  after: afterReference(input.ends.after),
                },
              }),
        })
  const named = new Set(input.reference.nodes.map(node => node.name))
  return {
    ...result,
    members: Object.fromEntries(
      Object.entries(result.members).map(([node, held]) => [
        node,
        held.filter(name => named.has(name)),
      ]),
    ),
  }
}
