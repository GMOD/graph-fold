import type {
  InputNode,
  InputTrack,
  RunsInput,
  WalkFields,
} from '../src/index.ts'

function fields({ sequence: _, ...rest }: InputTrack) {
  const walk: WalkFields = rest
  return walk
}

export function stepsToRuns(
  nodes: InputNode[],
  tracks: InputTrack[],
  reference: number,
) {
  const lengthOf = new Map(
    nodes.map(n => [n.name, n.sequenceLength ?? n.seq?.length ?? 0]),
  )
  const refTrack = tracks[reference]!
  const refSteps = refTrack.sequence.map(step => ({
    name: step.replace(/^-/, ''),
    reversed: step.startsWith('-'),
  }))
  const refIndex = new Map(refSteps.map((step, i) => [step.name, i]))
  const refNodes = refSteps.map(({ name }) => ({
    name,
    sequenceLength: lengthOf.get(name) ?? 0,
  }))
  const starts = [refTrack.indexOfFirstBase ?? 0]
  for (const node of refNodes) {
    starts.push(starts.at(-1)! + node.sequenceLength)
  }
  const others = tracks.filter((_, t) => t !== reference)
  const offsets = [0]
  const stretchStarts: number[] = []
  const stretchBp: number[] = []
  const against: number[] = []
  const offBefore: number[] = []
  const leadBp: number[] = []
  const tailBp: number[] = []
  for (const track of others) {
    let off = 0
    let lead: number | undefined
    let last: { from: number; to: number; against: boolean } | undefined
    const close = () => {
      if (last !== undefined) {
        stretchStarts.push(starts[last.from]!)
        stretchBp.push(starts[last.to]! - starts[last.from]!)
        against.push(Number(last.against))
      }
    }
    for (const step of track.sequence) {
      const name = step.replace(/^-/, '')
      const ref = refIndex.get(name)
      if (ref === undefined) {
        off += lengthOf.get(name) ?? 0
      } else {
        const runsAgainst = step.startsWith('-') !== refSteps[ref]!.reversed
        const continues =
          last !== undefined &&
          off === 0 &&
          last.against === runsAgainst &&
          (runsAgainst ? ref === last.from - 1 : ref === last.to)
        if (continues && last !== undefined) {
          last = runsAgainst ? { ...last, from: ref } : { ...last, to: ref + 1 }
        } else {
          close()
          if (lead === undefined) {
            lead = off
            offBefore.push(0)
          } else {
            offBefore.push(off)
          }
          last = { from: ref, to: ref + 1, against: runsAgainst }
          off = 0
        }
      }
    }
    close()
    leadBp.push(lead ?? off)
    tailBp.push(lead === undefined ? 0 : off)
    offsets.push(stretchStarts.length)
  }
  const input: RunsInput = {
    reference: {
      track: fields(refTrack),
      nodes: refNodes,
      starts: starts.slice(0, -1),
    },
    tracks: others.map(fields),
    offsets,
    stretches: {
      starts: stretchStarts,
      bp: stretchBp,
      against,
      offBefore,
    },
    leadBp,
    tailBp,
  }
  return { input, tracks: [refTrack, ...others] }
}
