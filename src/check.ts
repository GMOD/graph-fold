import type { FoldResult, InputNode, InputTrack } from './types.ts'

function nodeName(step: string) {
  return step.startsWith('-') ? step.slice(1) : step
}

export function foldProblems(
  nodes: InputNode[],
  tracks: InputTrack[],
  result: FoldResult,
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
      b.from !== undefined && b.to !== undefined
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
      if (result.folded && before !== undefined) {
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

  const haplotypes = (list: { freq?: number }[]) =>
    list.reduce((sum, track) => sum + (track.freq ?? 1), 0)
  if (haplotypes(tracks) !== haplotypes(result.tracks)) {
    problems.push(
      `${haplotypes(tracks)} haplotypes went in and ${haplotypes(result.tracks)} came out`,
    )
  }
  if (haplotypes(tracks) !== haplotypes(result.walks)) {
    problems.push(
      `${haplotypes(tracks)} haplotypes went in and the walks hold ${haplotypes(result.walks)}`,
    )
  }

  const inputBp = new Map<string, number[]>()
  tracks.forEach((track, i) => {
    const name = track.name ?? `track ${i}`
    inputBp.set(name, [
      ...(inputBp.get(name) ?? []),
      bpOf(track.sequence, inputLength),
    ])
  })
  for (const walk of result.walks) {
    const track = result.tracks[walk.track]
    const drawnBp = track ? bpOf(track.sequence, foldedLength) : Number.NaN
    if (drawnBp !== walk.foldedBp) {
      problems.push(
        `${walk.name} is ${walk.foldedBp} bp folded and its track ${drawnBp} bp`,
      )
    }
    if (!inputBp.get(walk.name)?.includes(walk.originalBp)) {
      problems.push(`${walk.name} is not ${walk.originalBp} bp in the input`)
    }
    const reconciled =
      walk.foldedBp - walk.skippedBp - walk.clippedBp + walk.insertedBp
    if (reconciled !== walk.originalBp) {
      problems.push(
        `${walk.name} is ${walk.originalBp} bp and reconciles to ${reconciled} bp`,
      )
    }
  }
  return problems
}
