import type {
  EndTable,
  FoldOptions,
  InputNode,
  InputTrack,
} from '../src/index.ts'

export function seeded(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const below = (n: number) => Math.floor(next() * n)
  const chance = (p: number) => next() < p
  const pick = <T>(items: readonly T[]) => items[below(items.length)]!
  return { next, below, chance, pick }
}

type Random = ReturnType<typeof seeded>

function nodeLength(random: Random) {
  return random.chance(0.03)
    ? 0
    : random.chance(0.15)
      ? 100 + random.below(2500)
      : 1 + random.below(60)
}

function flip(step: string) {
  return step.startsWith('-') ? step.slice(1) : `-${step}`
}

function randomWalk(random: Random, refSteps: string[], offNode: () => string) {
  const n = refSteps.length
  const sequence: string[] = []
  const off = (count: number) => {
    for (let k = 0; k < count; k++) {
      const node = offNode()
      sequence.push(random.chance(0.2) ? `-${node}` : node)
    }
  }
  if (random.chance(0.05)) {
    off(1 + random.below(3))
  } else {
    const start = random.chance(0.6) ? 0 : random.below(n)
    const end = random.chance(0.6) ? n : start + random.below(n - start + 1)
    let i = start
    let backs = 0
    if (random.chance(0.1)) {
      off(1 + random.below(2))
    }
    let ended = false
    while (i < end && !ended) {
      const roll = random.next()
      if (roll < 0.66) {
        sequence.push(refSteps[i]!)
        i += 1
      } else if (roll < 0.74) {
        i += 1 + random.below(4)
      } else if (roll < 0.82) {
        off(1 + random.below(3))
      } else if (roll < 0.86) {
        i += 1 + random.below(2)
        off(1 + random.below(2))
      } else if (roll < 0.91) {
        const k = Math.min(1 + random.below(6), end - i)
        for (let j = i + k - 1; j >= i; j--) {
          sequence.push(flip(refSteps[j]!))
        }
        i += k
      } else if (roll < 0.94 && backs < 3) {
        backs += 1
        i = Math.max(start, i - 1 - random.below(5))
      } else if (roll < 0.97 && backs < 3 && i + 6 < end) {
        backs += 1
        for (let j = i + 3; j < i + 6; j++) {
          sequence.push(refSteps[j]!)
        }
        for (let j = i; j < i + 3; j++) {
          sequence.push(refSteps[j]!)
        }
        i += 6
      } else if (roll < 0.98) {
        ended = true
      } else {
        sequence.push(refSteps[i]!)
        i += 1
      }
    }
    if (random.chance(0.1)) {
      off(1 + random.below(2))
    }
  }
  return random.chance(0.15) ? sequence.reverse().map(flip) : sequence
}

export function randomGraph(seed: number, placed = false) {
  const random = seeded(seed)
  const refCount = 3 + random.below(30)
  const refNames = Array.from({ length: refCount }, (_, i) => `r${i}`)
  const nodes: InputNode[] = refNames.map(name => ({
    name,
    sequenceLength: placed
      ? Math.max(1, nodeLength(random))
      : nodeLength(random),
  }))
  const refSteps = refNames.map(name =>
    random.chance(0.1) ? `-${name}` : name,
  )
  if (random.chance(0.03)) {
    refSteps.push(refSteps[0]!)
  }
  const pool: string[] = []
  const offNode = () => {
    const shared = pool.length > 0 && random.chance(0.4)
    const name = shared ? random.pick(pool) : `x${pool.length}`
    if (!shared) {
      pool.push(name)
      nodes.push({ name, sequenceLength: nodeLength(random) })
    }
    return name
  }
  const walkCount = 1 + random.below(9)
  const haplotypes = 1 + random.below(walkCount)
  const named = random.chance(0.5)
  const walks: InputTrack[] = Array.from({ length: walkCount }, (_, w) => ({
    ...(random.chance(0.95) ? { name: `hap${w}` } : {}),
    sequence: random.chance(0.02) ? [] : randomWalk(random, refSteps, offNode),
    ...(random.chance(0.7) ? {} : { freq: 1 + random.below(3) }),
    ...(named ? { haplotype: `h${random.below(haplotypes)}` } : {}),
    ...(random.chance(0.3) ? { indexOfFirstBase: random.below(1000) } : {}),
    ...(random.chance(0.2) ? { sourceTrackID: random.below(50) } : {}),
  }))
  if (random.chance(0.4) && walks.length > 1) {
    walks.push({ ...walks[random.below(walks.length)]!, name: 'copy' })
  }
  if (random.chance(0.01)) {
    walks[0]!.sequence.push('nowhere')
  }
  const reference = random.chance(0.85) ? 0 : random.below(walks.length + 1)
  const refTrack: InputTrack = {
    name: 'ref',
    sequence: refSteps,
    indexOfFirstBase: random.below(100_000),
    ...(random.chance(0.2) ? { freq: 2 } : {}),
  }
  const tracks = [
    ...walks.slice(0, reference),
    refTrack,
    ...walks.slice(reference),
  ]
  const options: FoldOptions = {
    threshold: random.pick([1, 5, 20, 50, 100, 300, 1000]),
    cluster: random.chance(0.5),
    ...(random.chance(0.3)
      ? { clusterTolerance: random.pick([0.05, 0.2, 0.5]) }
      : {}),
    ...(reference > 0 || random.chance(0.1) ? { reference } : {}),
    ...(random.chance(0.3)
      ? { referenceRevisits: random.pick([0, Number.NaN, 0, 1]) }
      : {}),
    inversions: random.chance(0.3) ? 'box' : 'walk',
  }
  return { nodes, tracks, options }
}

export function randomEnds(
  seed: number,
  tracks: number,
  from: number,
  to: number,
) {
  const random = seeded(seed * 7919 + 17)
  const table = () => {
    const ends = Array.from({ length: tracks }, () => ({
      kind: random.pick(['beyond', 'elsewhere', 'edge', 'ends'] as const),
      pos: random.pick([
        from - random.below(5000),
        to + random.below(5000),
        from + random.below(Math.max(1, to - from)),
      ]),
      reversed: Number(random.chance(0.2)),
      ownBp: random.pick([0, random.below(60), random.below(5000)]),
      missingBp: random.chance(0.1) ? 1 + random.below(100) : 0,
    }))
    const result: EndTable = {
      kinds: ends.map(end => end.kind),
      pos: ends.map(end => end.pos),
      reversed: ends.map(end => end.reversed),
      ownBp: ends.map(end => end.ownBp),
      missingBp: ends.map(end => end.missingBp),
    }
    return result
  }
  return { before: table(), after: table() }
}
