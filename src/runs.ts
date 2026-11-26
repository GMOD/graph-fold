import { foldWindow, unfolded, whyRefused } from './fold.ts'

import type { Anchor } from './chain.ts'
import type { CoreWalk, FoldWindow } from './fold.ts'
import type {
  FoldResult,
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

function whyRunsUnreadable(
  input: RunsInput,
  { span }: ReturnType<typeof referenceIndex>,
  threshold: number,
  referenceRevisits: number | undefined,
) {
  const { reference, tracks, offsets, stretches, leadBp, tailBp } = input
  const { nodes, starts, track } = reference
  const gap = nodes.findIndex(
    (node, i) =>
      i + 1 < nodes.length &&
      starts[i]! + node.sequenceLength !== starts[i + 1],
  )
  const base = track.indexOfFirstBase
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
        : gap >= 0
          ? `reference node ${nodes[gap]!.name} ends at ${starts[gap]! + nodes[gap]!.sequenceLength} and the next starts at ${starts[gap + 1]}`
          : base !== undefined && base !== starts[0]
            ? `the reference track starts at ${base} and its first node at ${starts[0]}`
            : (stretchProblem() ??
              whyRefused(threshold, referenceRevisits, repeats))
}

interface Stretch {
  step: number
  from: number
  to: number
  reversed: boolean
}

function namesBetween(names: string[], stretches: Stretch[]) {
  return function* (from: number, to: number) {
    let lo = 0
    let hi = stretches.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      const { step, from: first, to: last } = stretches[mid]!
      if (step + last - first > from) {
        hi = mid
      } else {
        lo = mid + 1
      }
    }
    for (let k = lo; k < stretches.length && stretches[k]!.step < to; k++) {
      const stretch = stretches[k]!
      const end = Math.min(to, stretch.step + stretch.to - stretch.from)
      for (let s = Math.max(from, stretch.step); s < end; s++) {
        const i = s - stretch.step
        yield names[stretch.reversed ? stretch.to - 1 - i : stretch.from + i]!
      }
    }
  }
}

function runsWindow<T extends WalkFields>(
  input: RunsInput<T>,
  { offsets: refOffsets, span }: ReturnType<typeof referenceIndex>,
) {
  const { reference, tracks, offsets, stretches, leadBp, tailBp } = input
  const names = reference.nodes.map(node => node.name)
  const named = new Set(names)
  const walks = tracks.map((track, t) => {
    const anchors: Anchor[] = []
    const held: Stretch[] = []
    const first = offsets[t]!
    const last = offsets[t + 1]!
    let step = 0
    let bp = 0
    const own = (more: number) => {
      if (more > 0) {
        step += 1
        bp += more
      }
    }
    own(first === last ? leadBp[t]! + tailBp[t]! : leadBp[t]!)
    for (let k = first; k < last; k++) {
      own(k > first ? stretches.offBefore[k]! : 0)
      const { from, to } = span(stretches.starts[k]!, stretches.bp[k]!)!
      const reversed = stretches.against[k] !== 0
      anchors.push({ from, to, reversed, at: step, bp })
      held.push({ step, from, to, reversed })
      step += to - from
      bp += refOffsets[to]! - refOffsets[from]!
    }
    own(first === last ? 0 : tailBp[t]!)
    const walk: CoreWalk = {
      index: t + 1,
      row: t,
      name: track.name ?? `track ${t + 1}`,
      freq: track.freq ?? 1,
      anchors,
      steps: step,
      bp,
      hold: namesBetween(names, held),
    }
    return walk
  })
  const window: FoldWindow<T> = {
    tracks: [reference.track, ...tracks],
    reference: 0,
    refNames: names,
    refLengths: reference.nodes.map(node => node.sequenceLength),
    refBase: reference.starts[0] ?? 0,
    walks,
    taken: name => named.has(name),
  }
  return window
}

export function foldRuns<T extends WalkFields>(
  input: RunsInput<T>,
  options: RunsFoldOptions = {},
) {
  const {
    threshold = 50,
    cluster = false,
    clusterTolerance = 0.05,
    referenceRevisits,
    inversions = 'walk',
  } = options
  const index = referenceIndex(input)
  const reason = whyRunsUnreadable(input, index, threshold, referenceRevisits)
  const result: FoldResult<ReferenceNode, T> =
    reason === undefined
      ? foldWindow(
          runsWindow(input, index),
          threshold,
          cluster,
          clusterTolerance,
          inversions === 'box',
          input.ends,
        )
      : unfolded(
          input.reference.nodes,
          [input.reference.track, ...input.tracks],
          threshold,
          reason,
        )
  return result
}
