import type { FoldResult, Folded, InputNode, InputTrack } from './types.ts'

function nodeName(step: string) {
  return step.startsWith('-') ? step.slice(1) : step
}

function haplotypes(list: { freq?: number }[]) {
  return list.reduce((sum, track) => sum + (track.freq ?? 1), 0)
}

function foldedProblems(
  nodes: InputNode[],
  tracks: InputTrack[],
  result: Folded,
) {
  const problems: string[] = []
  const inputLength = new Map(
    nodes.map(n => [n.name, n.sequenceLength ?? n.seq?.length ?? 0]),
  )
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
  const bpOf = (sequence: string[], lengths: Map<string, number>) =>
    sequence.reduce((sum, step) => sum + (lengths.get(nodeName(step)) ?? 0), 0)

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

  const counts = [
    ['the tracks hold', haplotypes(result.tracks)],
    ['the walks hold', haplotypes(result.walks)],
    ['the result counts', result.haplotypes],
  ] as const
  for (const [what, count] of counts) {
    if (count !== haplotypes(tracks)) {
      problems.push(
        `${haplotypes(tracks)} haplotypes went in and ${what} ${count}`,
      )
    }
  }
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
    const inputBp = bpOf(tracks[i]?.sequence ?? [], inputLength)
    if (inputBp !== walk.originalBp) {
      problems.push(
        `${walk.name} is ${inputBp} bp in the input and ${walk.originalBp} bp in its walk`,
      )
    }
    const reconciled =
      walk.foldedBp - walk.skippedBp - walk.clippedBp + walk.insertedBp
    if (reconciled !== walk.originalBp) {
      problems.push(
        `${walk.name} is ${walk.originalBp} bp and reconciles to ${reconciled} bp`,
      )
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
    const carried = haplotypes(
      branch.tracks.flatMap(id => result.tracks[id] ?? []),
    )
    if (branch.haplotypes > carried) {
      problems.push(
        `${branch.description} at ${branch.refStart} counts ${branch.haplotypes} haplotypes and its tracks hold ${carried}`,
      )
    }
    const copied = haplotypes(
      (branch.copies ?? []).map(({ haplotypes: freq }) => ({ freq })),
    )
    if (branch.copies !== undefined && copied !== branch.haplotypes) {
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
  return result.folded
    ? foldedProblems(nodes, tracks, result)
    : result.nodes === nodes && result.tracks === tracks
      ? []
      : ['an unfolded result does not hold the nodes and tracks given']
}
