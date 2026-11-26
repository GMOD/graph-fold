import { haplotypeCounter } from './haplotypes.ts'

import type {
  FoldResult,
  Folded,
  InputNode,
  InputTrack,
  RunsInput,
  WalkFields,
} from './types.ts'

function nodeName(step: string) {
  return step.startsWith('-') ? step.slice(1) : step
}

function bpOf(sequence: string[], lengths: Map<string, number>) {
  return sequence.reduce(
    (sum, step) => sum + (lengths.get(nodeName(step)) ?? 0),
    0,
  )
}

function records(list: { freq?: number }[]) {
  return list.reduce((sum, track) => sum + (track.freq ?? 1), 0)
}

function foldedProblems(
  tracks: WalkFields[],
  inputBp: (track: number) => number,
  result: Folded<WalkFields>,
) {
  const problems: string[] = []
  const foldedLength = new Map(
    result.nodes.map(n => [n.name, n.sequenceLength]),
  )
  const kindOf = new Map(result.nodes.map(n => [n.name, n.kind]))
  const backbone = new Map(
    (result.tracks[0]?.sequence ?? []).map((step, i) => [nodeName(step), i]),
  )
  const jumps = new Set(
    result.branches.flatMap(b =>
      b.kind !== 'inversion' && b.from !== undefined && b.to !== undefined
        ? [`${b.from}>${b.to}`, `${b.to}>${b.from}`]
        : [],
    ),
  )

  for (const track of result.tracks) {
    track.sequence.forEach((step, s) => {
      const name = nodeName(step)
      if (!foldedLength.has(name)) {
        problems.push(`${track.name} steps ${name}, which is not a folded node`)
      }
      const before = track.sequence[s - 1]
      if (before !== undefined) {
        const from = nodeName(before)
        const a = backbone.get(from)
        const b = backbone.get(name)
        const reversed = step.startsWith('-')
        const explained =
          kindOf.get(from) === 'branch' ||
          kindOf.get(name) === 'branch' ||
          a === undefined ||
          b === undefined ||
          before.startsWith('-') !== reversed ||
          b - a === (reversed ? -1 : 1) ||
          (reversed ? b >= a : b <= a) ||
          jumps.has(`${from}>${name}`)
        if (!explained) {
          problems.push(
            `${track.name} jumps from ${from} to ${name}, which no branch reports`,
          )
        }
      }
    })
  }

  const haplotypesIn = haplotypeCounter(tracks)
  const walksOn = result.tracks.map((): number[] => [])
  result.walks.forEach((walk, i) => {
    walksOn[walk.track]?.push(i)
  })
  const haplotypesOn = (ids: number[]) =>
    haplotypesIn(ids.flatMap(id => walksOn[id] ?? []))
  const counts = [
    [
      'walk records',
      'the tracks hold',
      records(tracks),
      records(result.tracks),
    ],
    ['walk records', 'the walks hold', records(tracks), records(result.walks)],
    [
      'haplotypes',
      'the tracks hold',
      haplotypesIn(tracks.keys()),
      haplotypesOn(result.tracks.map(track => track.id)),
    ],
    [
      'haplotypes',
      'the result counts',
      haplotypesIn(tracks.keys()),
      result.haplotypes,
    ],
  ] as const
  for (const [unit, what, went, count] of counts) {
    if (count !== went) {
      problems.push(`${went} ${unit} went in and ${what} ${count}`)
    }
  }
  result.tracks.forEach((track, id) => {
    const held = haplotypesOn([id])
    if (track.haplotypes !== held) {
      problems.push(
        `${track.name} counts ${track.haplotypes} haplotypes and its walks are ${held}`,
      )
    }
  })
  if (result.walks.length !== tracks.length) {
    problems.push(
      `${tracks.length} tracks went in and ${result.walks.length} walks came out`,
    )
  }

  result.walks.forEach((walk, i) => {
    const track = result.tracks[walk.track]
    const drawnBp = track ? bpOf(track.sequence, foldedLength) : Number.NaN
    if (drawnBp !== walk.foldedBp) {
      problems.push(
        `${walk.name} is ${walk.foldedBp} bp folded and its track ${drawnBp} bp`,
      )
    }
    const bp = inputBp(i)
    if (bp !== walk.originalBp) {
      problems.push(
        `${walk.name} is ${bp} bp in the input and ${walk.originalBp} bp in its walk`,
      )
    }
    const reconciled =
      walk.foldedBp - walk.skippedBp - walk.clippedBp + walk.insertedBp
    if (reconciled !== walk.originalBp) {
      problems.push(
        `${walk.name} is ${walk.originalBp} bp and reconciles to ${reconciled} bp`,
      )
    }
    const notUnder = `not under the threshold of ${result.threshold} bp`
    for (const step of walk.steps) {
      if (step.largestInsertedBp >= result.threshold) {
        problems.push(
          `${walk.name} hides ${step.largestInsertedBp} bp off the reference in ${step.node}, ${notUnder}`,
        )
      }
      if (step.largestSkippedBp >= result.threshold) {
        problems.push(
          `${walk.name} hides a skip of ${step.largestSkippedBp} bp of the reference in ${step.node}, ${notUnder}`,
        )
      }
    }
  })
  for (const branch of result.branches) {
    if (
      branch.tracks.length === 0 ||
      branch.tracks.some(id => result.tracks[id] === undefined)
    ) {
      problems.push(
        `${branch.description} at ${branch.refStart} names no track, or one that is not there`,
      )
    }
    const carried = haplotypesOn(branch.tracks)
    if (branch.haplotypes > carried) {
      problems.push(
        `${branch.description} at ${branch.refStart} counts ${branch.haplotypes} haplotypes and its tracks hold ${carried}`,
      )
    }
    const copied = (branch.copies ?? []).reduce(
      (sum, copy) => sum + copy.haplotypes,
      0,
    )
    if (branch.copies !== undefined && copied < branch.haplotypes) {
      problems.push(
        `${branch.description} at ${branch.refStart} counts ${branch.haplotypes} haplotypes and its copies ${copied}`,
      )
    }
  }
  return problems
}

export function foldProblems<N extends InputNode, T extends InputTrack>(
  nodes: N[],
  tracks: T[],
  result: FoldResult<N, T>,
) {
  const inputLength = new Map(
    nodes.map(n => [n.name, n.sequenceLength ?? n.seq?.length ?? 0]),
  )
  return result.folded
    ? foldedProblems(
        tracks,
        track => bpOf(tracks[track]?.sequence ?? [], inputLength),
        result,
      )
    : result.nodes === nodes && result.tracks === tracks
      ? []
      : ['an unfolded result does not hold the nodes and tracks given']
}

export function foldRunsProblems<N extends InputNode, T extends WalkFields>(
  input: RunsInput<T>,
  result: FoldResult<N, T>,
) {
  const { reference, tracks, offsets, stretches, leadBp, tailBp } = input
  const walkBp = (t: number) => {
    let bp = leadBp[t]! + tailBp[t]!
    for (let k = offsets[t]!; k < offsets[t + 1]!; k++) {
      bp += stretches.bp[k]! + (k > offsets[t]! ? stretches.offBefore[k]! : 0)
    }
    return bp
  }
  const referenceBp = reference.nodes.reduce(
    (sum, node) => sum + node.sequenceLength,
    0,
  )
  return result.folded
    ? foldedProblems(
        [reference.track, ...tracks],
        track => (track === 0 ? referenceBp : walkBp(track - 1)),
        result,
      )
    : []
}
