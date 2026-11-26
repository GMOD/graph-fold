import { chain, runBounds } from './chain.ts'
import { clusterLeaders, siteKey } from './cluster.ts'
import { haplotypeCounter, haplotypeKey } from './haplotypes.ts'
import { referenceLabel, trackLabel } from './labels.ts'

import type { Anchor } from './chain.ts'
import type { Site } from './cluster.ts'
import type {
  BpSpread,
  Branch,
  BranchAllele,
  BranchCopies,
  ClusterInfo,
  FoldOptions,
  Folded,
  FoldedNode,
  FoldedStep,
  FoldedTrack,
  FoldedWalk,
  InputNode,
  InputTrack,
  TrackVariation,
  Unfolded,
  WalkEnds,
  WalkFields,
} from './types.ts'

type BranchDraft = Omit<Branch, 'tracks' | 'anchored' | 'haplotypes'>

interface Detour extends Site {
  pair: number
}

interface ChainedRun {
  reversed: boolean
  anchors: Anchor[]
  start: number
  end: number
  detours: Detour[]
}

interface OpenEnd {
  boundary: number
  outsideLeft: boolean
  own: number
  beyond: number
  replaced: number
  site?: Site
  description?: string
  emitted: boolean
}

interface Visit {
  node: string
  reversed: boolean
  length: number
  walked: number
  extra: number
  clipped: number
  original?: number
  largestHidden: number
  largestSkipped: number
}

interface BranchTally {
  walks: Set<number>
  alleles: Map<
    string,
    { allele: Omit<BranchAllele, 'haplotypes'>; walks: Set<number> }
  >
}

interface Passes {
  total: number
  against: number
}

function times(count: number) {
  return count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`
}

function repeatDescription(passes: Passes[]) {
  const totals = passes.map(p => p.total)
  const against = new Set(passes.map(p => p.against))
  const least = Math.min(...totals)
  const most = Math.max(...totals)
  const walked = least === most ? times(most) : `${least} to ${most} times`
  const reversed =
    against.size > 1
      ? ', reversed on some passes'
      : against.has(0)
        ? ''
        : `, ${times(passes[0]!.against)} reversed`
  return `reference walked ${walked}${reversed}`
}

function stretchesOf(keys: (string | undefined)[]) {
  const stretches: { from: number; to: number }[] = []
  keys.forEach((key, s) => {
    if (key !== undefined) {
      const last = stretches.at(-1)
      if (last?.to === s && keys[s - 1] === key) {
        last.to = s + 1
      } else {
        stretches.push({ from: s, to: s + 1 })
      }
    }
  })
  return stretches
}

function parseStep(step: string) {
  return step.startsWith('-')
    ? { name: step.slice(1), reversed: true }
    : { name: step, reversed: false }
}

function stepText(name: string, reversed: boolean) {
  return reversed ? `-${name}` : name
}

function lengthOfNode({ sequenceLength, seq }: InputNode) {
  return sequenceLength ?? seq?.length ?? 0
}

function trackName(track: InputTrack, index: number) {
  return track.name ?? `track ${index}`
}

function spread(amounts: { bp: number; freq: number }[]) {
  const sorted = [...amounts].sort((a, b) => a.bp - b.bp)
  const half = sorted.reduce((sum, a) => sum + a.freq, 0) / 2
  let passed = 0
  let median = 0
  let found = false
  for (const { bp, freq } of sorted) {
    passed += freq
    if (!found && passed >= half) {
      median = bp
      found = true
    }
  }
  const result: BpSpread = {
    min: sorted[0]?.bp ?? 0,
    median,
    max: sorted.at(-1)?.bp ?? 0,
  }
  return result
}

function variationOf(
  walks: { insertedBp: number; skippedBp: number; freq: number }[],
) {
  const result: TrackVariation = {
    foldedAwayBp: spread(
      walks.map(w => ({ bp: w.insertedBp + w.skippedBp, freq: w.freq })),
    ),
    insertedBp: spread(walks.map(w => ({ bp: w.insertedBp, freq: w.freq }))),
    skippedBp: spread(walks.map(w => ({ bp: w.skippedBp, freq: w.freq }))),
  }
  return result
}

const noVariation = variationOf([{ insertedBp: 0, skippedBp: 0, freq: 1 }])

function haplotypesOf(tracks: WalkFields[]) {
  return haplotypeCounter(tracks)(tracks.keys())
}

export function unfolded<N extends InputNode, T extends WalkFields>(
  nodes: N[],
  tracks: T[],
  threshold: number,
  reason: string,
) {
  const result: Unfolded<N, T> = {
    folded: false,
    reason,
    threshold,
    haplotypes: haplotypesOf(tracks),
    nodes,
    tracks,
    members: {},
    branches: [],
    walks: [],
  }
  return result
}

function whyUnfoldable(
  nodes: InputNode[],
  tracks: InputTrack[],
  reference: number,
  referenceRevisits: number | undefined,
) {
  const sequence = tracks[reference]?.sequence ?? []
  const names = sequence.map(step => parseStep(step).name)
  const repeats = names.length - new Set(names).size
  const known = new Set(nodes.map(n => n.name))
  const missing = tracks.flatMap((track, index) => {
    const step = track.sequence.find(s => !known.has(parseStep(s).name))
    return step === undefined
      ? []
      : [
          `${trackName(track, index)} steps node ${parseStep(step).name}, which is not among the nodes`,
        ]
  })[0]
  return sequence.length === 0
    ? `there is no reference walk at track ${reference}`
    : (missing ??
        (referenceRevisits !== undefined && referenceRevisits > 0
          ? `the reference passes ${referenceRevisits} nodes of the graph more than once, so a run off it may be a copy of reference sequence and not a variant`
          : repeats > 0
            ? `the reference passes ${repeats} nodes of this window more than once, so a run off it may be a copy of reference sequence and not a variant`
            : undefined))
}

function foldWindow<T extends InputTrack>(
  nodes: InputNode[],
  tracks: T[],
  reference: number,
  threshold: number,
  cluster: boolean,
  tolerance: number,
  boxed: boolean,
  ends: WalkEnds | undefined,
) {
  const haplotypesIn = haplotypeCounter(tracks)
  const lengths = new Map(nodes.map(n => [n.name, lengthOfNode(n)]))
  const lengthOf = (name: string) => lengths.get(name) ?? 0
  const refTrack = tracks[reference]!
  const refName = trackName(refTrack, reference)
  const refSteps = refTrack.sequence.map(parseStep)
  const refIndex = new Map(refSteps.map((step, i) => [step.name, i]))
  const offsets = [0]
  for (const step of refSteps) {
    offsets.push(offsets.at(-1)! + lengthOf(step.name))
  }
  const refBase = refTrack.indexOfFirstBase ?? 0
  const refPos = (boundary: number) => refBase + offsets[boundary]!
  const refBp = (from: number, to: number) => offsets[to]! - offsets[from]!
  const deletedOf = (site: Site) =>
    site.beyond === undefined
      ? refBp(site.left, site.right)
      : Math.abs(refPos(site.left) - site.beyond)

  const openEnd = (
    index: number,
    starts: boolean,
    run: ChainedRun,
    held: number,
  ) => {
    const table = starts ? ends?.before : ends?.after
    const pos = table?.pos[index] ?? Number.NaN
    const outside = pos <= refPos(0) || pos >= refPos(refSteps.length)
    const departs =
      table?.kinds[index] === 'departure' && table.missingBp[index] === 0
    const outsideLeft = starts !== run.reversed
    const boundary = outsideLeft ? run.start : run.end
    const at = refPos(boundary)
    const own = Math.max(table?.ownBp[index] ?? 0, held)
    const replaced = Math.abs(at - pos)
    const farReversed = (table?.reversed[index] !== 0) !== run.reversed
    const inOrder = outsideLeft ? pos <= at : pos >= at
    const verb = starts ? 'leaves' : 'rejoins'
    const description = farReversed
      ? `${verb} the reference outside the window, reversed`
      : inOrder
        ? undefined
        : `${verb} the reference outside the window, out of order`
    const inserted = own >= threshold ? own : 0
    const end: OpenEnd = {
      boundary,
      outsideLeft,
      own,
      beyond: pos,
      replaced,
      emitted: own >= threshold || replaced >= threshold,
      ...(description === undefined
        ? { site: { left: boundary, right: boundary, inserted, beyond: pos } }
        : { description }),
    }
    return departs && outside ? end : undefined
  }

  const walks = tracks.flatMap((track, index) => {
    const name = trackName(track, index)
    const steps = track.sequence.map(parseStep)
    const prefix = [0]
    for (const step of steps) {
      prefix.push(prefix.at(-1)! + lengthOf(step.name))
    }
    const anchors = steps.flatMap((step, at) => {
      const ref = refIndex.get(step.name)
      return ref === undefined
        ? []
        : [
            {
              ref,
              reversed: step.reversed !== refSteps[ref]!.reversed,
              step: at,
            },
          ]
    })
    const runs = chain(anchors, offsets, threshold).map(run => {
      const detours: Detour[] = []
      run.anchors.forEach((anchor, pair) => {
        if (pair > 0) {
          const before = run.anchors[pair - 1]!
          const inserted = prefix[anchor.step]! - prefix[before.step + 1]!
          const left = Math.min(before.ref, anchor.ref) + 1
          const right = Math.max(before.ref, anchor.ref)
          const deleted = refBp(left, right)
          if (inserted >= threshold || deleted >= threshold) {
            detours.push({
              pair,
              left,
              right: deleted >= threshold ? right : left,
              inserted: inserted >= threshold ? inserted : 0,
            })
          }
        }
      })
      const chained: ChainedRun = { ...run, ...runBounds(run), detours }
      return chained
    })
    const firstRun = runs[0]
    const lastRun = runs.at(-1)
    return index === reference
      ? []
      : [
          {
            index,
            name,
            freq: track.freq ?? 1,
            steps,
            prefix,
            runs,
            opens: [
              firstRun === undefined
                ? undefined
                : openEnd(
                    index,
                    true,
                    firstRun,
                    prefix[firstRun.anchors[0]!.step]!,
                  ),
              lastRun === undefined
                ? undefined
                : openEnd(
                    index,
                    false,
                    lastRun,
                    prefix.at(-1)! - prefix[lastRun.anchors.at(-1)!.step + 1]!,
                  ),
            ],
          },
        ]
  })

  const siteWalks = new Map<string, { site: Site; walks: Set<number> }>()
  const tallySite = (site: Site, index: number) => {
    const seen = siteWalks.get(siteKey(site)) ?? { site, walks: new Set() }
    siteWalks.set(siteKey(site), { site, walks: seen.walks.add(index) })
  }
  for (const { runs, index, opens } of walks) {
    for (const { detours } of runs) {
      for (const { left, right, inserted } of detours) {
        tallySite({ left, right, inserted }, index)
      }
    }
    for (const open of opens) {
      if (open?.site !== undefined && open.emitted) {
        tallySite(open.site, index)
      }
    }
  }
  const siteTally = new Map(
    [...siteWalks].map(([key, { site, walks: carried }]) => [
      key,
      { site, haplotypes: haplotypesIn(carried) },
    ]),
  )
  const leaderOf = cluster
    ? clusterLeaders(siteTally, offsets, tolerance, deletedOf)
    : new Map<string, Site>()

  const inRefOrder = <T>(run: ChainedRun, items: T[]) =>
    run.reversed ? [...items].reverse() : items

  const drawnDetours = (run: ChainedRun) => {
    const led = run.detours.map(detour => ({
      ...detour,
      ...leaderOf.get(siteKey(detour)),
      pair: detour.pair,
    }))
    const bounds = [
      run.start,
      ...inRefOrder(run, led).flatMap(d => [d.left, d.right]),
      run.end,
    ]
    const ordered = bounds.every(
      (bound, k) =>
        k === 0 ||
        (k === 1 || k === bounds.length - 1
          ? bound > bounds[k - 1]!
          : bound >= bounds[k - 1]!),
    )
    return ordered ? led : run.detours
  }

  const drawn = walks.map(walk => ({
    ...walk,
    runs: walk.runs.map(run => ({ ...run, drawn: drawnDetours(run) })),
  }))

  const unwalkedPast = (boundary: number, leftward: boolean) =>
    leftward ? refBp(0, boundary) : refBp(boundary, refSteps.length)
  const breakpoints = new Set([0, refSteps.length])
  for (const { runs, opens } of drawn) {
    for (const open of opens) {
      if (open?.emitted === true) {
        breakpoints.add(open.boundary)
      }
    }
    runs.forEach((run, r) => {
      const entered = run.reversed ? run.end : run.start
      const left = run.reversed ? run.start : run.end
      if (r > 0 || unwalkedPast(entered, !run.reversed) >= threshold) {
        breakpoints.add(entered)
      }
      if (
        r < runs.length - 1 ||
        unwalkedPast(left, run.reversed) >= threshold
      ) {
        breakpoints.add(left)
      }
      for (const detour of run.drawn) {
        breakpoints.add(detour.left)
        breakpoints.add(detour.right)
      }
    })
  }
  const bounds = [...breakpoints].sort((a, b) => a - b)
  const segmentOf: number[] = []
  const segments = bounds.slice(0, -1).map((start, segment) => {
    const end = bounds[segment + 1]!
    for (let ref = start; ref < end; ref++) {
      segmentOf.push(segment)
    }
    const first = refSteps[start]!.name
    const last = refSteps[end - 1]!.name
    return {
      name: end - start === 1 ? first : `${first}~${last}`,
      start,
      end,
      length: refBp(start, end),
    }
  })
  const segmentNames = (from: number, to: number) =>
    from < to
      ? segments
          .slice(segmentOf[from], segmentOf[to - 1]! + 1)
          .map(segment => segment.name)
      : []

  const foldedNodes = new Map<string, FoldedNode>()
  const members = new Map<string, Set<string>>()
  for (const { name, start, end, length } of segments) {
    foldedNodes.set(name, {
      name,
      sequenceLength: length,
      kind: 'reference',
      refStart: refPos(start),
      refEnd: refPos(end),
    })
    members.set(name, new Set(refSteps.slice(start, end).map(s => s.name)))
  }
  const branchNode = (name: string, length: number, at?: Site) => {
    if (!foldedNodes.has(name)) {
      foldedNodes.set(name, {
        name,
        sequenceLength: length,
        kind: 'branch',
        ...(at === undefined
          ? {}
          : { refStart: refPos(at.left), refEnd: refPos(at.right) }),
      })
      members.set(name, new Set())
    }
    return name
  }

  const unusedName = (name: string): string =>
    lengths.has(name) ? unusedName(`${name}'`) : name
  const invertedCopy = (name: string) => {
    const original = foldedNodes.get(name)!
    const copy = unusedName(`inv:${name}`)
    if (!foldedNodes.has(copy)) {
      foldedNodes.set(copy, {
        ...original,
        name: copy,
        kind: 'branch',
        invertedOf: name,
      })
      members.set(copy, new Set(members.get(name)))
    }
    return copy
  }
  const insideInversion = (name: string, length: number, at: Site) =>
    branchNode(unusedName(`inv:${name}`), length, at)

  const branches = new Map<string, BranchDraft>()
  const carriers = new Map<string, Set<number>>()
  const tallies = new Map<string, BranchTally>()
  const carry = (
    key: string,
    walk: { index: number },
    branch: () => BranchDraft,
  ) => {
    branches.set(key, branches.get(key) ?? branch())
    carriers.set(key, (carriers.get(key) ?? new Set()).add(walk.index))
  }
  const repeats = new Map<string, Map<number, Passes>>()
  const piecesOf = (run: ChainedRun & { drawn: Detour[] }) => {
    const detours = inRefOrder(run, run.drawn)
    const cuts = [
      run.start,
      ...detours.flatMap(d => [d.left, d.right]),
      run.end,
    ]
    return detours
      .map((_, k) => k)
      .concat(detours.length)
      .map(k => ({
        from: cuts[2 * k]!,
        to: cuts[2 * k + 1]!,
        detour: detours[k],
      }))
  }
  const segmentsIn = (from: number, to: number) =>
    from < to
      ? segments
          .slice(segmentOf[from], segmentOf[to - 1]! + 1)
          .map((_, k) => segmentOf[from]! + k)
      : []

  const foldedWalks = drawn.map(walk => {
    const { steps, prefix, runs } = walk
    const visits: Visit[] = []
    const absorb = (visit: Visit, from: number, to: number) => {
      const bp = prefix[to]! - prefix[from]!
      const held = members.get(visit.node)!
      for (const step of steps.slice(from, to)) {
        held.add(step.name)
      }
      if (visit.original === undefined) {
        visit.extra += bp
      } else {
        visit.original += bp
      }
    }
    const hide = (visit: Visit, from: number, to: number) => {
      absorb(visit, from, to)
      visit.largestHidden = Math.max(
        visit.largestHidden,
        prefix[to]! - prefix[from]!,
      )
    }
    const ownVisit = (node: string, length: number, reversed: boolean) => {
      const visit: Visit = {
        node,
        reversed,
        length,
        walked: 0,
        extra: 0,
        clipped: 0,
        original: 0,
        largestHidden: 0,
        largestSkipped: 0,
      }
      return visit
    }
    const stretch = (
      label: string,
      description: string,
      from: number,
      to: number,
      boundary: number,
      fallback: Visit | undefined,
    ) => {
      const bp = prefix[to]! - prefix[from]!
      if (bp >= threshold || (fallback === undefined && bp > 0)) {
        const node = branchNode(`${label}:${bp}`, bp)
        const visit = ownVisit(node, bp, false)
        absorb(visit, from, to)
        visits.push(visit)
        carry(node, walk, () => ({
          kind: 'other',
          description,
          length: bp,
          insertedBp: bp,
          deletedBp: 0,
          refStart: refPos(boundary),
          refEnd: refPos(boundary),
          nodes: [node],
        }))
      } else {
        if (fallback !== undefined && to > from) {
          hide(fallback, from, to)
        }
      }
    }
    const strandBp = [0, 0]
    for (const run of runs) {
      strandBp[Number(run.reversed)]! += run.anchors.reduce(
        (bp, a) => bp + refBp(a.ref, a.ref + 1),
        0,
      )
    }
    const flanksAgree = runs[0]?.reversed === runs.at(-1)?.reversed
    const mostlyReversed = flanksAgree
      ? runs[0]?.reversed === true
      : strandBp[1]! > strandBp[0]!
    const refNameAt = (ref: number) => refSteps[ref]!.name
    const walkEnd = (boundary: number, leftward: boolean, starts: boolean) => {
      const unwalked = unwalkedPast(boundary, leftward)
      if (unwalked >= threshold && leftward === (starts !== mostlyReversed)) {
        carry(`end:${boundary}:${leftward}:${starts}`, walk, () => ({
          kind: 'other',
          description: starts
            ? 'walk starts inside the window'
            : 'walk ends inside the window',
          length: unwalked,
          insertedBp: 0,
          deletedBp: 0,
          refStart: refPos(boundary),
          refEnd: refPos(boundary),
          nodes: [],
        }))
      }
    }

    const against = (run: ChainedRun) => run.reversed !== mostlyReversed
    const passes: Passes[] = segments.map(() => ({ total: 0, against: 0 }))
    for (const run of runs) {
      for (const { from, to } of piecesOf(run)) {
        for (const s of segmentsIn(from, to)) {
          passes[s]!.total += 1
          passes[s]!.against += Number(against(run))
        }
      }
    }
    const reportDetour = (drawnSite: Site, original: Site, node?: string) => {
      const key = `detour:${siteKey(drawnSite)}`
      const deletedBp = refBp(drawnSite.left, drawnSite.right)
      const listed = branches.get(key)
      if (
        listed !== undefined &&
        node !== undefined &&
        !listed.nodes.includes(node)
      ) {
        listed.nodes.push(node)
      }
      carry(key, walk, () => ({
        kind:
          drawnSite.inserted > 0 && deletedBp > 0
            ? 'other'
            : drawnSite.inserted > 0
              ? 'insertion'
              : 'deletion',
        description:
          drawnSite.inserted > 0 && deletedBp > 0
            ? 'replacement'
            : drawnSite.inserted > 0
              ? 'insertion'
              : 'deletion',
        length: Math.max(drawnSite.inserted, deletedBp),
        insertedBp: drawnSite.inserted,
        deletedBp,
        refStart: refPos(drawnSite.left),
        refEnd: refPos(drawnSite.right),
        nodes: node === undefined ? [] : [node],
        from: segments[segmentOf[drawnSite.left - 1]!]!.name,
        to: segments[segmentOf[drawnSite.right]!]!.name,
      }))
      const tally = tallies.get(key) ?? {
        walks: new Set(),
        alleles: new Map(),
      }
      const seen = tally.alleles.get(siteKey(original)) ?? {
        allele: {
          refStart: refPos(original.left),
          refEnd: refPos(original.right),
          insertedBp: original.inserted,
          deletedBp: refBp(original.left, original.right),
        },
        walks: new Set(),
      }
      tally.walks.add(walk.index)
      tally.alleles.set(siteKey(original), {
        ...seen,
        walks: seen.walks.add(walk.index),
      })
      tallies.set(key, tally)
    }

    const reportOpen = (open: OpenEnd) => {
      const drawnSite =
        open.site === undefined
          ? undefined
          : (leaderOf.get(siteKey(open.site)) ?? open.site)
      const inserted =
        drawnSite?.inserted ?? (open.own >= threshold ? open.own : 0)
      const deletedBp =
        drawnSite !== undefined && open.replaced >= threshold
          ? open.replaced
          : 0
      const at = refPos(open.boundary)
      const key =
        drawnSite === undefined
          ? `open:${open.boundary}:${open.beyond}:${inserted}:${open.description}`
          : `open:${siteKey(drawnSite)}`
      const inside = refNameAt(
        open.outsideLeft ? open.boundary : open.boundary - 1,
      )
      const node =
        inserted > 0
          ? branchNode(`open:${inside}:${inserted}:${open.beyond}`, inserted)
          : undefined
      const span = open.outsideLeft
        ? { refStart: refPos(0), refEnd: at }
        : { refStart: at, refEnd: refPos(refSteps.length) }
      const kind =
        open.description !== undefined || (inserted > 0 && deletedBp > 0)
          ? 'other'
          : inserted > 0
            ? 'insertion'
            : 'deletion'
      if (open.emitted) {
        carry(key, walk, () => ({
          kind,
          description:
            open.description ?? (kind === 'other' ? 'replacement' : kind),
          length: Math.max(inserted, deletedBp),
          insertedBp: inserted,
          deletedBp,
          ...(deletedBp > 0 ? span : { refStart: at, refEnd: at }),
          nodes: node === undefined ? [] : [node],
          ...(open.outsideLeft
            ? { to: segments[segmentOf[open.boundary]!]!.name }
            : { from: segments[segmentOf[open.boundary - 1]!]!.name }),
          open: true,
          beyond: open.beyond,
        }))
        if (open.site !== undefined) {
          const tally = tallies.get(key) ?? {
            walks: new Set(),
            alleles: new Map(),
          }
          const original = siteKey(open.site)
          const seen = tally.alleles.get(original) ?? {
            allele: {
              ...(open.replaced >= threshold
                ? span
                : { refStart: at, refEnd: at }),
              insertedBp: open.site.inserted,
              deletedBp: open.replaced >= threshold ? open.replaced : 0,
            },
            walks: new Set(),
          }
          tally.walks.add(walk.index)
          tally.alleles.set(original, {
            ...seen,
            walks: seen.walks.add(walk.index),
          })
          tallies.set(key, tally)
        }
      }
      return open.emitted ? node : undefined
    }
    const openVisit = (
      open: OpenEnd,
      node: string,
      from: number,
      to: number,
    ) => {
      const visit = ownVisit(node, foldedNodes.get(node)!.sequenceLength, false)
      absorb(visit, from, to)
      visit.clipped = Math.max(0, open.own - (prefix[to]! - prefix[from]!))
      visits.push(visit)
    }

    for (const stretch of stretchesOf(
      passes.map(p => (p.total > 1 ? `${p.total}:${p.against}` : undefined)),
    )) {
      const from = segments[stretch.from]!.start
      const to = segments[stretch.to - 1]!.end
      const walked = passes[stretch.from]!
      const names = segmentNames(from, to)
      const key = `repeat:${from}:${to}:${walked.against > 0}`
      if (refBp(from, to) >= threshold) {
        repeats.set(
          key,
          (repeats.get(key) ?? new Map<number, Passes>()).set(
            walk.index,
            walked,
          ),
        )
        carry(key, walk, () => ({
          kind: 'other',
          description: 'reference walked twice',
          length: refBp(from, to),
          insertedBp: 0,
          deletedBp: 0,
          refStart: refPos(from),
          refEnd: refPos(to),
          nodes:
            boxed && walked.against > 0
              ? [...names, ...names.map(invertedCopy)]
              : names,
        }))
      }
    }
    const junctions = new Set(
      runs.flatMap((run, r) => [
        ...(r > 0 ? [run.reversed ? run.end : run.start] : []),
        ...(r < runs.length - 1 ? [run.reversed ? run.start : run.end] : []),
      ]),
    )
    const jumped = runs.flatMap(run =>
      run.drawn.filter(detour => detour.right > detour.left),
    )
    for (const stretch of stretchesOf(
      passes.map(p => (p.total === 0 ? 'unwalked' : undefined)),
    )) {
      const left = segments[stretch.from]!.start
      const right = segments[stretch.to - 1]!.end
      const site = { left, right, inserted: 0 }
      if (
        refBp(left, right) >= threshold &&
        junctions.has(left) &&
        junctions.has(right) &&
        jumped.every(detour => detour.right <= left || detour.left >= right)
      ) {
        reportDetour(site, site)
      }
    }

    runs.forEach((run, r) => {
      const first = run.anchors[0]!
      const before = runs[r - 1]
      const entered = run.reversed ? run.end : run.start
      const leadOpen = before === undefined ? walk.opens[0] : undefined
      const leadNode = leadOpen === undefined ? undefined : reportOpen(leadOpen)
      if (before === undefined) {
        if (leadOpen === undefined) {
          walkEnd(entered, !run.reversed, true)
          stretch(
            `lead:${refNameAt(first.ref)}`,
            'sequence off the reference before the walk first meets it',
            0,
            first.step,
            entered,
            undefined,
          )
        } else if (leadNode !== undefined) {
          openVisit(leadOpen, leadNode, 0, first.step)
        }
      } else {
        const reached = before.reversed ? before.start : before.end
        stretch(
          `join:${stepText(refNameAt(before.anchors.at(-1)!.ref), before.reversed)}:${stepText(refNameAt(first.ref), run.reversed)}`,
          'sequence off the reference between two breakpoints',
          before.anchors.at(-1)!.step + 1,
          first.step,
          reached,
          visits.at(-1),
        )
        if (before.reversed === run.reversed) {
          const from = Math.min(entered, reached)
          const to = Math.max(entered, reached)
          if (segmentsIn(from, to).every(s => passes[s]!.total < 2)) {
            carry(`back:${from}:${to}:${run.reversed}`, walk, () => ({
              kind: 'other',
              description: 'reference walked out of order',
              length: refBp(from, to),
              insertedBp: 0,
              deletedBp: 0,
              refStart: refPos(from),
              refEnd: refPos(to),
              nodes: segmentNames(from, to),
            }))
          }
        }
      }
      const boxing = boxed && against(run)
      const pieces = piecesOf(run)
      const passed = pieces.flatMap(({ from, to }) => segmentsIn(from, to))
      const alone = passed.filter(s => passes[s]!.total === 1)
      const whole = alone.length === passed.length
      const start = whole ? run.start : (segments[alone[0] ?? 0]?.start ?? 0)
      const end = whole ? run.end : (segments[alone.at(-1) ?? 0]?.end ?? 0)
      const aloneBp = alone.reduce((bp, s) => bp + segments[s]!.length, 0)
      if (against(run) && (whole || aloneBp >= threshold)) {
        const open = r === 0 || r === runs.length - 1
        carry(`inversion:${start}:${end}:${open}`, walk, () => ({
          kind: 'inversion',
          description: 'inversion',
          length: refBp(start, end),
          insertedBp: 0,
          deletedBp: 0,
          refStart: refPos(start),
          refEnd: refPos(end),
          nodes: boxed
            ? segmentNames(start, end).map(invertedCopy)
            : segmentNames(start, end),
          ...(start > 0 ? { from: segments[segmentOf[start - 1]!]!.name } : {}),
          ...(end < refSteps.length
            ? { to: segments[segmentOf[end]!]!.name }
            : {}),
          ...(open ? { open } : {}),
        }))
      }

      const bySegment = new Map<number, Visit>()
      const byPair = new Map<number, Visit>()
      const elements: Visit[] = []
      const covered: [number, number][] = []
      for (const { from, to, detour } of pieces) {
        covered.push([from, to])
        for (const s of segmentsIn(from, to)) {
          const segment = segments[s]!
          const visit: Visit = {
            node: boxing ? invertedCopy(segment.name) : segment.name,
            reversed: boxing ? mostlyReversed : run.reversed,
            length: segment.length,
            walked: 0,
            extra: 0,
            clipped:
              segment.length -
              refBp(Math.max(from, segment.start), Math.min(to, segment.end)),
            largestHidden: 0,
            largestSkipped: 0,
          }
          bySegment.set(s, visit)
          elements.push(visit)
        }
        if (detour !== undefined && detour.inserted > 0) {
          const name =
            detour.right > detour.left
              ? `ins:${refNameAt(detour.left - 1)}:${detour.inserted}:${refNameAt(detour.right)}`
              : `ins:${refNameAt(detour.left - 1)}:${detour.inserted}`
          const node = boxing
            ? insideInversion(name, detour.inserted, detour)
            : branchNode(name, detour.inserted, detour)
          const visit = ownVisit(
            node,
            detour.inserted,
            boxing ? mostlyReversed : run.reversed,
          )
          byPair.set(detour.pair, visit)
          elements.push(visit)
        }
      }
      const runVisits = inRefOrder(run, elements)
      for (const visit of runVisits) {
        visits.push(visit)
      }
      if (leadOpen !== undefined && leadNode === undefined && first.step > 0) {
        hide(runVisits[0]!, 0, first.step)
      }

      let home = runVisits[0]!
      run.anchors.forEach((anchor, pair) => {
        if (pair > 0) {
          const before = run.anchors[pair - 1]!
          const drawnAs = byPair.get(pair)
          if (drawnAs === undefined) {
            hide(home, before.step + 1, anchor.step)
          } else {
            absorb(drawnAs, before.step + 1, anchor.step)
          }
          const left = Math.min(before.ref, anchor.ref) + 1
          const right = Math.max(before.ref, anchor.ref)
          const skipDrawn = run.drawn.some(
            d => d.pair === pair && d.right > d.left,
          )
          if (!skipDrawn && right > left) {
            for (const s of segmentsIn(left, right)) {
              const visit = bySegment.get(s) ?? home
              visit.largestSkipped = Math.max(
                visit.largestSkipped,
                refBp(left, right),
              )
            }
          }
        }
        const visit = covered.some(
          ([from, to]) => anchor.ref >= from && anchor.ref < to,
        )
          ? bySegment.get(segmentOf[anchor.ref]!)
          : undefined
        if (visit === undefined) {
          absorb(home, anchor.step, anchor.step + 1)
        } else {
          visit.walked += refBp(anchor.ref, anchor.ref + 1)
          home = visit
        }
      })

      run.drawn.forEach(detour => {
        reportDetour(
          detour,
          run.detours.find(d => d.pair === detour.pair)!,
          byPair.get(detour.pair)?.node,
        )
      })

      if (r === runs.length - 1) {
        const last = run.anchors.at(-1)!
        const left = run.reversed ? run.start : run.end
        const tailOpen = walk.opens[1]
        const tailNode =
          tailOpen === undefined ? undefined : reportOpen(tailOpen)
        if (tailOpen === undefined) {
          stretch(
            `tail:${refNameAt(last.ref)}`,
            'sequence off the reference after the walk last leaves it',
            last.step + 1,
            steps.length,
            left,
            undefined,
          )
          walkEnd(left, run.reversed, false)
        } else if (tailNode !== undefined) {
          openVisit(tailOpen, tailNode, last.step + 1, steps.length)
        } else if (steps.length > last.step + 1) {
          hide(visits.at(-1)!, last.step + 1, steps.length)
        }
      }
    })

    const ownBp = prefix.at(-1)!
    if (runs.length === 0 && ownBp > 0) {
      const node = branchNode(`off:${walk.index}:${ownBp}`, ownBp)
      const visit = ownVisit(node, ownBp, false)
      absorb(visit, 0, steps.length)
      visits.push(visit)
    }

    const foldedSteps: FoldedStep[] = visits.flatMap((visit, step) => {
      const { node, length, walked, extra, clipped, original } = visit
      const { largestHidden, largestSkipped } = visit
      const insertedBp =
        original === undefined
          ? extra
          : Math.max(0, original + clipped - length)
      const skippedBp =
        original === undefined
          ? length - clipped - walked
          : Math.max(0, length - clipped - original)
      return insertedBp > 0 ||
        skippedBp > 0 ||
        clipped > 0 ||
        largestHidden > 0 ||
        largestSkipped > 0
        ? [
            {
              step,
              node,
              insertedBp,
              skippedBp,
              clippedBp: clipped,
              largestInsertedBp: largestHidden,
              largestSkippedBp: largestSkipped,
            },
          ]
        : []
    })
    const total = (pick: (step: FoldedStep) => number) =>
      foldedSteps.reduce((sum, step) => sum + pick(step), 0)
    return {
      walk,
      sequence: visits.map(v => stepText(v.node, v.reversed)),
      originalBp: prefix.at(-1)!,
      foldedBp: visits.reduce((sum, v) => sum + v.length, 0),
      insertedBp: total(s => s.insertedBp),
      skippedBp: total(s => s.skippedBp),
      clippedBp: total(s => s.clippedBp),
      steps: foldedSteps,
    }
  })

  const clusterOf = (key: string) => {
    const tally = tallies.get(key)
    const alleles = [...(tally?.alleles.values() ?? [])].map(
      ({ allele, walks: carried }) => ({
        ...allele,
        haplotypes: haplotypesIn(carried),
      }),
    )
    const sizes = alleles.map(a =>
      a.insertedBp > 0 ? a.insertedBp : a.deletedBp,
    )
    const info: ClusterInfo | undefined =
      tally !== undefined && alleles.length > 1
        ? {
            members: alleles.length,
            minLength: Math.min(...sizes),
            maxLength: Math.max(...sizes),
            haplotypes: haplotypesIn(tally.walks),
          }
        : undefined
    return info === undefined
      ? undefined
      : {
          cluster: info,
          alleles: alleles.sort(
            (a, b) =>
              b.haplotypes - a.haplotypes ||
              a.refStart - b.refStart ||
              a.insertedBp - b.insertedBp,
          ),
        }
  }
  const groups = new Map<string, number[]>()
  foldedWalks.forEach(({ sequence }, w) => {
    const key = sequence.join()
    groups.set(key, [...(groups.get(key) ?? []), w])
  })
  const trackOfWalk = new Map<number, number>()
  const refHaplotypes = haplotypesIn([reference])
  const refFolded: FoldedTrack<T> = {
    ...refTrack,
    id: 0,
    name: refName,
    label: referenceLabel(refName, refHaplotypes),
    sequence: segments.map(segment => segment.name),
    freq: refTrack.freq ?? 1,
    haplotypes: refHaplotypes,
    sourceTrackID: refTrack.sourceTrackID ?? 0,
    names: [refName],
    variation: noVariation,
  }
  const haplotypeTracks = [...groups.values()].map((group, g) => {
    const held = group.map(w => foldedWalks[w]!)
    const first = held[0]!
    const id = g + 1
    for (const { walk } of held) {
      trackOfWalk.set(walk.index, id)
    }
    const freq = held.reduce((sum, { walk }) => sum + walk.freq, 0)
    const haplotypes = haplotypesIn(held.map(({ walk }) => walk.index))
    const names = held.map(({ walk }) => walk.name)
    const byHaplotype = new Map<
      string | number,
      { name: string; insertedBp: number; skippedBp: number; freq: number }
    >()
    for (const { walk, insertedBp, skippedBp } of held) {
      const key = haplotypeKey(tracks, walk.index)
      const seen = byHaplotype.get(key)
      byHaplotype.set(
        key,
        seen === undefined
          ? {
              name: tracks[walk.index]!.haplotype ?? walk.name,
              insertedBp,
              skippedBp,
              freq: walk.freq,
            }
          : {
              ...seen,
              insertedBp: seen.insertedBp + insertedBp,
              skippedBp: seen.skippedBp + skippedBp,
              freq: Math.max(seen.freq, walk.freq),
            },
      )
    }
    const track: FoldedTrack<T> = {
      ...tracks[first.walk.index]!,
      id,
      name: first.walk.name,
      label: trackLabel(
        haplotypes,
        held.length === 1 ? names : [...byHaplotype.values()].map(h => h.name),
      ),
      sequence: first.sequence,
      freq,
      haplotypes,
      sourceTrackID: tracks[first.walk.index]!.sourceTrackID ?? id,
      names,
      variation: variationOf([...byHaplotype.values()]),
    }
    return track
  })
  const refLength = offsets.at(-1)!
  const refWalk: FoldedWalk = {
    name: refName,
    freq: refFolded.freq,
    track: 0,
    originalBp: refLength,
    foldedBp: refLength,
    insertedBp: 0,
    skippedBp: 0,
    clippedBp: 0,
    steps: [],
  }
  const walkOfInput = new Map(
    foldedWalks.map(({ walk, sequence: _, ...amounts }) => {
      const folded: FoldedWalk = {
        name: walk.name,
        freq: walk.freq,
        track: trackOfWalk.get(walk.index) ?? 0,
        ...amounts,
      }
      return [walk.index, folded]
    }),
  )
  const copiesOf = (key: string) => {
    const walked = [...(repeats.get(key) ?? [])]
    const counts = new Map<string, { passes: Passes; walks: number[] }>()
    for (const [index, passes] of walked) {
      const key = `${passes.total}:${passes.against}`
      counts.set(key, {
        passes,
        walks: [...(counts.get(key)?.walks ?? []), index],
      })
    }
    const copies = [...counts.values()].map(({ passes, walks: held }) => {
      const count: BranchCopies = {
        passes: passes.total,
        reversed: passes.against,
        haplotypes: haplotypesIn(held),
        tracks: [...new Set(held.map(w => trackOfWalk.get(w) ?? 0))].sort(
          (a, b) => a - b,
        ),
      }
      return count
    })
    return walked.length > 0
      ? {
          description: repeatDescription(walked.map(([, p]) => p)),
          copies: copies.sort(
            (a, b) => a.passes - b.passes || a.reversed - b.reversed,
          ),
        }
      : {}
  }
  const branchList = [...branches].map(([key, draft]) => {
    const clustered = clusterOf(key)
    if (clustered !== undefined) {
      for (const name of draft.nodes) {
        const node = foldedNodes.get(name)
        if (node !== undefined) {
          node.cluster = clustered.cluster
        }
      }
    }
    const branch: Branch = {
      ...draft,
      haplotypes: haplotypesIn(carriers.get(key) ?? []),
      ...clustered,
      ...copiesOf(key),
      tracks: [
        ...new Set(
          [...(carriers.get(key) ?? [])].map(w => trackOfWalk.get(w) ?? 0),
        ),
      ].sort((a, b) => a - b),
      anchored:
        draft.nodes.length > 0 ||
        (draft.from !== undefined && draft.to !== undefined),
    }
    return branch
  })
  const result: Folded<T> = {
    folded: true,
    threshold,
    haplotypes: haplotypesOf(tracks),
    nodes: [...foldedNodes.values()],
    tracks: [refFolded, ...haplotypeTracks],
    members: Object.fromEntries(
      [...members].map(([name, held]) => [name, [...held]]),
    ),
    branches: branchList.sort(
      (a, b) => a.refStart - b.refStart || a.refEnd - b.refEnd,
    ),
    walks: tracks.map((_, index) => walkOfInput.get(index) ?? refWalk),
  }
  return result
}

export function foldGraph<N extends InputNode, T extends InputTrack>(
  nodes: N[],
  tracks: T[],
  options: FoldOptions = {},
) {
  const {
    threshold = 50,
    cluster = false,
    clusterTolerance = 0.05,
    reference = 0,
    referenceRevisits,
    inversions = 'walk',
    ends,
  } = options
  const reason = whyUnfoldable(nodes, tracks, reference, referenceRevisits)
  return reason === undefined
    ? foldWindow(
        nodes,
        tracks,
        reference,
        threshold,
        cluster,
        clusterTolerance,
        inversions === 'box',
        ends,
      )
    : unfolded(nodes, tracks, threshold, reason)
}
